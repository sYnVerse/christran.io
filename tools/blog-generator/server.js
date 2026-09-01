import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Resend } from 'resend';
import cron from 'node-cron';
import { exec } from 'child_process';
import { promisify } from 'util';
import sharp from 'sharp';

const execPromise = promisify(exec);

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve static dashboard files
app.use(express.static(path.join(__dirname, 'public')));

// Configuration
const PORT = process.env.PORT || 5000;
const BLOG_CONTENT_PATH = path.resolve(__dirname, process.env.BLOG_CONTENT_PATH || '../../src/content/blog');
const ASSETS_IMG_PATH = path.resolve(__dirname, process.env.ASSETS_IMG_PATH || '../../src/assets/img/blog');
const DATA_DIR = path.join(__dirname, 'data');

const REPO_ROOT = path.resolve(__dirname, '../..');


// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(ASSETS_IMG_PATH)) {
  fs.mkdirSync(ASSETS_IMG_PATH, { recursive: true });
}

// Serve temporary generated images
app.use('/api/temp-images', express.static(DATA_DIR));



// Initial API checks
const hasGeminiKey = !!process.env.GEMINI_API_KEY;
const hasResendKey = !!process.env.RESEND_API_KEY;
const userEmail = process.env.USER_EMAIL || '';
const senderEmail = process.env.SENDER_EMAIL || 'onboarding@resend.dev';

console.log('Blog Generator Server Initializing...');
console.log(`- Content Path: ${BLOG_CONTENT_PATH}`);
console.log(`- Gemini API Key: ${hasGeminiKey ? 'Present' : 'MISSING'}`);
console.log(`- Resend API Key: ${hasResendKey ? 'Present' : 'MISSING'}`);
console.log(`- User Email: ${userEmail || 'MISSING'}`);
console.log(`- Sender Email: ${senderEmail}`);

const TEXT_MODEL_CHAIN = [
  'gemini-3.5-flash',
  'gemini-3-flash-preview',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash-lite',
];

const IMAGE_MODEL_CHAIN = [
  'gemini-3.1-flash-image',
  'gemini-3-pro-image',
  'gemini-2.5-flash-image',
];

function isRateLimitError(error) {
  const message = (error?.message || String(error)).toLowerCase();
  const status = error?.status || error?.statusCode || error?.cause?.status;
  if (status === 429) return true;
  return message.includes('resource_exhausted') ||
    message.includes('resource has been exhausted') ||
    message.includes('too many requests') ||
    message.includes(' 429 ') ||
    message.includes(': 429');
}

async function generateGeminiText(prompt, isJson = false) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set in environment variables.');
  }

  let lastError;
  for (let i = 0; i < TEXT_MODEL_CHAIN.length; i++) {
    const modelName = TEXT_MODEL_CHAIN[i];
    try {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const generationConfig = isJson ? { responseMimeType: 'application/json' } : {};
      const model = genAI.getGenerativeModel({ model: modelName, generationConfig });
      const result = await model.generateContent(prompt);
      console.log(`Text generated successfully using model: ${modelName}`);
      return result;
    } catch (error) {
      lastError = error;
      if (isRateLimitError(error) && i < TEXT_MODEL_CHAIN.length - 1) {
        console.warn(`Rate limit hit on ${modelName}, stepping down to ${TEXT_MODEL_CHAIN[i + 1]}...`);
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

async function generateAIImageBuffer(promptText) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set in environment variables.');
  }

  let lastError;
  for (let i = 0; i < IMAGE_MODEL_CHAIN.length; i++) {
    const modelName = IMAGE_MODEL_CHAIN[i];
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${process.env.GEMINI_API_KEY}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }],
          generationConfig: {
            responseModalities: ['IMAGE'],
            imageConfig: { aspectRatio: '16:9' },
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        const error = new Error(`Gemini Image API error (${modelName}): ${response.status} ${response.statusText} - ${errorText}`);
        error.status = response.status;
        if (isRateLimitError(error) && i < IMAGE_MODEL_CHAIN.length - 1) {
          console.warn(`Rate limit hit on ${modelName}, stepping down to ${IMAGE_MODEL_CHAIN[i + 1]}...`);
          continue;
        }
        throw error;
      }

      const data = await response.json();
      const parts = data.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData?.data) {
          console.log(`Image generated successfully using model: ${modelName}`);
          return Buffer.from(part.inlineData.data, 'base64');
        }
      }
      throw new Error(`No image data in response from ${modelName}`);
    } catch (error) {
      lastError = error;
      if (isRateLimitError(error) && i < IMAGE_MODEL_CHAIN.length - 1) {
        console.warn(`Rate limit hit on ${modelName}, stepping down to ${IMAGE_MODEL_CHAIN[i + 1]}...`);
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

// Helper to get Gemini Client (wrapper with rate-limit fallback)
function getGeminiModel() {
  return {
    generateContent: (prompt) => generateGeminiText(prompt, true),
  };
}

function getGeminiTextModel() {
  return {
    generateContent: (prompt) => generateGeminiText(prompt, false),
  };
}


// Helper to get Resend Client
function getResend() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not set in environment variables.');
  }
  return new Resend(process.env.RESEND_API_KEY);
}

// Helper to retry async operations (like API requests) with exponential backoff
async function retryCall(fn, retries = 10, delayMs = 60000) {
  try {
    return await fn();
  } catch (error) {
    if (retries <= 0) {
      throw error;
    }
    console.warn(`API call failed (503/429/FetchError). Retrying in ${delayMs}ms... (Remaining retries: ${retries}). Error: ${error.message}`);
    await new Promise(resolve => setTimeout(resolve, delayMs));
    return retryCall(fn, retries - 1, delayMs * 2);
  }
}

// Read existing blog posts metadata for context
async function getExistingPostsContext() {

  try {
    if (!fs.existsSync(BLOG_CONTENT_PATH)) {
      return [];
    }
    const files = fs.readdirSync(BLOG_CONTENT_PATH).filter(f => f.endsWith('.md') || f.endsWith('.mdx'));
    const posts = [];

    for (const file of files) {
      const filepath = path.join(BLOG_CONTENT_PATH, file);
      const content = fs.readFileSync(filepath, 'utf-8');

      // Simple frontmatter parser
      const match = content.match(/^---\r?\n([\s\S]+?)\r?\n---/);
      if (match) {
        const fm = match[1];
        const titleMatch = fm.match(/title:\s*"([^"]+)"|title:\s*'([^']+)'|title:\s*(.+)/);
        const descMatch = fm.match(/description:\s*"([^"]+)"|description:\s*'([^']+)'|description:\s*(.+)/);
        const tagsMatch = fm.match(/tags:\s*\[([^\]]+)\]/);

        posts.push({
          title: titleMatch ? (titleMatch[1] || titleMatch[2] || titleMatch[3]) : file,
          description: descMatch ? (descMatch[1] || descMatch[2] || descMatch[3]) : '',
          tags: tagsMatch ? tagsMatch[1].split(',').map(t => t.trim().replace(/['"]/g, '')) : []
        });
      }
    }
    return posts.slice(0, 10); // Return up to 10 posts for context
  } catch (error) {
    console.error('Error reading existing posts:', error);
    return [];
  }
}

// Generate blog ideas logic
async function generateBlogIdeas(keywords = '') {
  const existingPosts = await getExistingPostsContext();
  const model = getGeminiModel();

  const contextText = existingPosts.length > 0
    ? `Here are some of the existing blog posts on the site for reference:\n${existingPosts.map(p => `- Title: "${p.title}"\n  Description: "${p.description}"\n  Tags: ${JSON.stringify(p.tags)}`).join('\n')}`
    : 'The blog is new and does not have any posts yet.';

  let keywordInstruction = '';
  if (keywords && keywords.trim()) {
    keywordInstruction = `\nCRITICAL: You MUST brainstorm and generate ideas specifically based on or closely related to these custom keywords/themes: "${keywords.trim()}". Align these ideas with Chris's writing style and context.`;
  }

  const prompt = `You are a blog post idea generator for Chris Tran's personal website and blog (christran.io). 
  Chris is a tech enthusiast, software engineer, and system builder who writes about technical topics, hardware, automation, software engineering, and clean code.
  
  ${contextText}
  ${keywordInstruction}
  
  Generate exactly 3 fresh, interesting, and highly engaging blog post ideas that fit his style. For each idea, provide:
  - A short, catchy title
  - A description/hook (1-2 sentences summarizing the angle of the post)
  - A brief outline (3 bullet points showing the logical flow)
  - Suggested tags (3-5 tags)
  
  Return the output as a valid JSON object matching this structure:
  {
    "ideas": [
      {
        "title": "Title of the post",
        "description": "Short description of the blog post.",
        "outline": [
          "Point 1 to cover",
          "Point 2 to cover",
          "Point 3 to cover"
        ],
        "tags": ["Tag1", "Tag2", "Tag3"]
      }
    ]
  }
  Do not return any other text, markdown formatting, or HTML wrap outside the JSON object itself. Make sure the JSON is perfectly valid.`;

  const result = await retryCall(() => model.generateContent(prompt));
  const text = result.response.text();


  // Clean JSON response (in case Gemini wraps it in ```json ... ```)
  const cleanJsonText = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
  const parsedData = JSON.parse(cleanJsonText);

  // Save generated ideas to data/ideas.json
  const ideasWithIds = parsedData.ideas.map((idea, index) => ({
    id: `idea_${Date.now()}_${index}`,
    ...idea,
    generatedAt: new Date().toISOString()
  }));

  const filepath = path.join(DATA_DIR, 'ideas.json');
  let existingIdeas = [];
  if (fs.existsSync(filepath)) {
    try {
      existingIdeas = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
      if (!Array.isArray(existingIdeas)) {
        existingIdeas = [];
      }
    } catch (e) {
      existingIdeas = [];
    }
  }

  const allIdeas = [...ideasWithIds, ...existingIdeas];
  const limitedIdeas = allIdeas.slice(0, 50);
  fs.writeFileSync(filepath, JSON.stringify(limitedIdeas, null, 2));

  return ideasWithIds;
}

// Send ideas via email
async function sendIdeasEmail(ideas) {
  if (!userEmail) {
    throw new Error('USER_EMAIL environment variable is not configured.');
  }
  const resend = getResend();

  const ideasHtml = ideas.map((idea, idx) => `
    <div style="margin-bottom: 24px; padding: 16px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #f8fafc;">
      <h3 style="margin-top: 0; color: #1e293b; font-size: 18px;">${idx + 1}. ${idea.title}</h3>
      <p style="color: #475569; font-style: italic; margin-bottom: 12px;">"${idea.description}"</p>
      <strong style="color: #64748b; font-size: 14px; display: block; margin-bottom: 4px;">Proposed Outline:</strong>
      <ul style="margin-top: 0; padding-left: 20px; color: #334155;">
        ${idea.outline.map(pt => `<li>${pt}</li>`).join('')}
      </ul>
      <div style="margin-top: 12px;">
        ${idea.tags.map(tag => `<span style="display: inline-block; background-color: #e2e8f0; color: #475569; padding: 2px 8px; border-radius: 4px; font-size: 12px; margin-right: 6px;">#${tag}</span>`).join('')}
      </div>
    </div>
  `).join('');

  const dashboardUrl = process.env.DASHBOARD_URL || 'http://localhost:5000';


  const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #334155;">
      <h2 style="color: #6366f1; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 20px;">💡 Daily Blog Post Ideas</h2>
      <p style="font-size: 16px; line-height: 1.5;">Hi Chris, here are your blog ideas generated for today, <strong>${new Date().toLocaleDateString()}</strong>:</p>
      
      ${ideasHtml}
      
      <div style="margin-top: 30px; text-align: center;">
        <a href="${dashboardUrl}" style="background-color: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Open Dashboard to Write & Publish</a>
      </div>
      <p style="font-size: 12px; color: #94a3b8; text-align: center; margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 20px;">
        Sent automatically by Christran.io Blog Post Generator Tool.
      </p>
    </div>
  `;

  await resend.emails.send({
    from: senderEmail,
    to: userEmail,
    subject: `💡 Blog Post Ideas for ${new Date().toLocaleDateString()}`,
    html: htmlContent
  });
}

// Generate a WebP hero image using Gemini image models with fallback chain
async function generateImagenHeroImage(title, description, slug) {
  if (!process.env.GEMINI_API_KEY) {
    console.warn('Skipping image generation: GEMINI_API_KEY missing.');
    return '/img/google-antigravity.png'; // fallback to existing image
  }

  const promptText = `A professional, high-quality modern blog header illustration. Title: "${title}". Description: "${description}". Sleek vector graphic, minimalist digital art style, dark background with vibrant glowing accents of neon purple and deep cyan. No text, no words, no letters, no typography, no logos.`;

  console.log(`Generating AI Hero Image for slug: ${slug}...`);
  try {
    const buffer = await retryCall(() => generateAIImageBuffer(promptText));
    const filename = `${slug}.webp`;
    const outputPath = path.join(ASSETS_IMG_PATH, filename);

    console.log(`Converting generated image to optimized WebP at: ${outputPath}`);
    await sharp(buffer)
      .webp({ quality: 85 })
      .toFile(outputPath);

    console.log(`✅ AI Hero Image successfully generated and saved: /img/${filename}`);
    return `/img/${filename}`;
  } catch (error) {
    console.error('❌ Gemini image generation failed:', error.message);
    console.log('🔄 Falling back to free high-quality stock photo via LoremFlickr...');
    try {
      const fallbackUrl = 'https://loremflickr.com/1024/576/technology,coding,hardware,minimalist';

      const response = await fetch(fallbackUrl);
      if (!response.ok) {
        throw new Error(`LoremFlickr API failed: ${response.status} ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const filename = `${slug}.webp`;
      const outputPath = path.join(ASSETS_IMG_PATH, filename);

      console.log(`Converting fetched image to optimized WebP at: ${outputPath}`);
      await sharp(buffer)
        .webp({ quality: 85 })
        .toFile(outputPath);

      console.log(`✅ Fallback Hero Image successfully saved: /img/${filename}`);
      return `/img/${filename}`;
    } catch (fallbackError) {
      console.error('❌ Failed to generate fallback Hero Image:', fallbackError);
      // Fall back to a default image in the assets/img/ folder
      return '/img/google-antigravity.png';
    }
  }
}



// Generate draft logic
async function generateDraft(idea) {
  const model = getGeminiTextModel();

  // Generate default slug for the image filename
  const slug = idea.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  // Generate the AI hero image first
  const heroImageUrl = await generateImagenHeroImage(idea.title, idea.description, slug);

  const prompt = `You are a professional technical writer and tech blogger. You are drafting a blog post for Chris Tran's personal site (christran.io).
  
  Topic Details:
  - Title: "${idea.title}"
  - Description: "${idea.description}"
  - Outline:
    ${idea.outline.map((pt, idx) => `  ${idx + 1}. ${pt}`).join('\n')}
  - Tags: ${JSON.stringify(idea.tags)}
  
  Write a comprehensive, engaging, and highly informative blog post based on this outline.
  
  Writing Style Guidelines:
  - Tone: Engaging, expert yet accessible, personal (use "I" when sharing perspectives), and authoritative.
  - Structure: Use clear Markdown headings (H2, H3), paragraphs, bullet points, code blocks (if applicable), and bold text for emphasis.
  - Context: It must read like a polished article on a personal engineering/tech website, not an AI summary.
  - Length: Aim for 800 - 1200 words. Include an interesting introduction, body sections corresponding to the outline points, and a solid conclusion.
  
  CRITICAL: You must begin the post with Astro-compatible YAML frontmatter. It should be formatted exactly like this:
  ---
  title: "${idea.title.replace(/"/g, '\\"')}"
  author: "Chris Tran"
  pubDate: "${new Date().toISOString().split('T')[0]}"
  heroImage: "${heroImageUrl}"
  description: "${idea.description.replace(/"/g, '\\"')}"
  tags: ${JSON.stringify(idea.tags)}
  ---
  
  Return only the complete Markdown content, including the YAML frontmatter. Do not wrap the entire output in a markdown block (e.g. do not wrap the frontmatter and content in \`\`\`markdown ... \`\`\`). Just output raw markdown text.`;

  const result = await retryCall(() => model.generateContent(prompt));
  const draftText = result.response.text();


  // Clean draft text (remove leading/trailing markdown blocks if the LLM added them)
  let cleanDraft = draftText.trim();
  if (cleanDraft.startsWith('```markdown')) {
    cleanDraft = cleanDraft.replace(/^```markdown\s*/i, '').replace(/```\s*$/, '').trim();
  } else if (cleanDraft.startsWith('```')) {
    cleanDraft = cleanDraft.replace(/^```\s*/, '').replace(/```\s*$/, '').trim();
  }

  // Save active draft to server
  const activeDraft = {
    idea,
    content: cleanDraft,
    generatedAt: new Date().toISOString()
  };
  fs.writeFileSync(path.join(DATA_DIR, 'active-draft.json'), JSON.stringify(activeDraft, null, 2));

  return cleanDraft;
}

// Send draft email
async function sendDraftEmail(title, draftContent) {
  if (!userEmail) return;
  const resend = getResend();
  const dashboardUrl = process.env.DASHBOARD_URL || 'http://localhost:5000';

  // Convert markdown to very basic HTML for preview in email
  const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 20px; color: #334155;">
      <h2 style="color: #6366f1; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">📝 Draft Generated: ${title}</h2>
      <p>Hi Chris, your blog post draft has been generated. You can review the draft below or edit it in your local dashboard.</p>
      
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; font-family: monospace; white-space: pre-wrap; font-size: 14px; color: #334155; line-height: 1.6; margin: 20px 0; max-height: 500px; overflow-y: auto;">
        ${draftContent.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}
      </div>
      
      <div style="margin-top: 30px; text-align: center;">
        <a href="${dashboardUrl}" style="background-color: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Open Dashboard to Edit & Commit</a>
      </div>

    </div>
  `;

  await resend.emails.send({
    from: senderEmail,
    to: userEmail,
    subject: `📝 Blog Draft: ${title}`,
    html: htmlContent
  });
}

// Refine draft logic
async function refineDraft(currentDraft, suggestion) {
  const model = getGeminiTextModel();

  const prompt = `You are a professional technical editor. I have a draft of a blog post, and I want you to refine it based on specific suggestions.
  
  Suggestions/Feedback:
  "${suggestion}"
  
  Here is the current draft (including YAML frontmatter):
  ${currentDraft}
  
  Apply the feedback carefully. Maintain the Astro-compatible YAML frontmatter at the beginning of the file, updating it if necessary (e.g. if the title changes). Make sure the content flow is natural, the markdown formatting is clean, and the writing style remains cohesive.
  
  Return only the complete updated Markdown content. Do not wrap the output in a markdown block (e.g. do not wrap the frontmatter and content in \`\`\`markdown ... \`\`\`). Just output raw markdown text.`;

  const result = await retryCall(() => model.generateContent(prompt));
  const refinedText = result.response.text();


  let cleanRefined = refinedText.trim();
  if (cleanRefined.startsWith('```markdown')) {
    cleanRefined = cleanRefined.replace(/^```markdown\s*/i, '').replace(/```\s*$/, '').trim();
  } else if (cleanRefined.startsWith('```')) {
    cleanRefined = cleanRefined.replace(/^```\s*/, '').replace(/```\s*$/, '').trim();
  }

  // Update saved active draft
  let activeDraft = {};
  try {
    activeDraft = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'active-draft.json'), 'utf-8'));
  } catch (e) {
    activeDraft = { generatedAt: new Date().toISOString() };
  }

  activeDraft.content = cleanRefined;
  activeDraft.refinedAt = new Date().toISOString();
  fs.writeFileSync(path.join(DATA_DIR, 'active-draft.json'), JSON.stringify(activeDraft, null, 2));

  return cleanRefined;
}

// --- Helpers for Hero Image Manager ---

function parseFrontmatterContent(content) {
  const match = content.match(/^---\r?\n([\s\S]+?)\r?\n---/);
  if (!match) return {};
  const fmText = match[1];
  const result = {};
  fmText.split('\n').forEach(line => {
    const idx = line.indexOf(':');
    if (idx !== -1) {
      const key = line.slice(0, idx).trim();
      const val = line.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
      if (key === 'tags') {
        const tagMatch = val.match(/\[(.*)\]/);
        if (tagMatch) {
          result[key] = tagMatch[1].split(',').map(t => t.trim().replace(/['"]/g, ''));
        } else {
          result[key] = [];
        }
      } else {
        result[key] = val;
      }
    }
  });
  return result;
}

function parseMarkdownFile(filepath) {
  const content = fs.readFileSync(filepath, 'utf-8');
  const slug = path.basename(filepath, path.extname(filepath));
  const fm = parseFrontmatterContent(content);
  return {
    slug,
    title: fm.title || slug,
    heroImage: fm.heroImage || '',
    description: fm.description || '',
    tags: fm.tags || [],
    filename: path.basename(filepath)
  };
}

function updateFrontmatterHeroImage(content, heroImagePath) {
  const match = content.match(/^---\r?\n([\s\S]+?)\r?\n---/);
  if (match) {
    const isCrlf = content.includes('\r\n');
    const newline = isCrlf ? '\r\n' : '\n';
    let fm = match[1];
    if (fm.match(/heroImage:\s*.+/)) {
      fm = fm.replace(/heroImage:\s*.+/, `heroImage: "${heroImagePath}"`);
    } else {
      fm = fm.trim() + `${newline}heroImage: "${heroImagePath}"`;
    }
    return content.replace(/^---\r?\n([\s\S]+?)\r?\n---/, `---${newline}${fm}${newline}---`);
  }
  return `---\nheroImage: "${heroImagePath}"\n---\n${content}`;
}

function updatePostHeroImage(slug, heroImagePath) {
  // 1. Check active draft
  const draftFile = path.join(DATA_DIR, 'active-draft.json');
  if (fs.existsSync(draftFile)) {
    try {
      const draft = JSON.parse(fs.readFileSync(draftFile, 'utf-8'));
      const draftSlug = draft.idea && draft.idea.title
        ? draft.idea.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
        : '';
      if (draftSlug === slug || slug === 'active-draft') {
        draft.content = updateFrontmatterHeroImage(draft.content, heroImagePath);
        fs.writeFileSync(draftFile, JSON.stringify(draft, null, 2));
        console.log(`Updated heroImage in active-draft.json to ${heroImagePath}`);
      }
    } catch (e) {
      console.error('Error updating active draft image frontmatter:', e);
    }
  }

  // 2. Check saved markdown files
  const filename = `${slug}.md`;
  const mdxFilename = `${slug}.mdx`;
  const mdPath = path.join(BLOG_CONTENT_PATH, filename);
  const mdxPath = path.join(BLOG_CONTENT_PATH, mdxFilename);

  if (fs.existsSync(mdPath)) {
    const content = fs.readFileSync(mdPath, 'utf-8');
    const updated = updateFrontmatterHeroImage(content, heroImagePath);
    fs.writeFileSync(mdPath, updated, 'utf-8');
    console.log(`Updated heroImage in ${filename} to ${heroImagePath}`);
  } else if (fs.existsSync(mdxPath)) {
    const content = fs.readFileSync(mdxPath, 'utf-8');
    const updated = updateFrontmatterHeroImage(content, heroImagePath);
    fs.writeFileSync(mdxPath, updated, 'utf-8');
    console.log(`Updated heroImage in ${mdxFilename} to ${heroImagePath}`);
  }
}

// --- Endpoints ---

// Get active draft and all saved blog posts
app.get('/api/posts', (req, res) => {
  try {
    const posts = [];

    // Check if there is an active draft
    const draftFile = path.join(DATA_DIR, 'active-draft.json');
    let activeDraftInfo = null;
    if (fs.existsSync(draftFile)) {
      try {
        const draft = JSON.parse(fs.readFileSync(draftFile, 'utf-8'));
        if (draft && draft.content) {
          const fm = parseFrontmatterContent(draft.content);
          const slug = draft.idea && draft.idea.title
            ? draft.idea.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
            : 'active-draft';
          activeDraftInfo = {
            title: fm.title || (draft.idea ? draft.idea.title : 'Active Draft'),
            slug: slug,
            heroImage: fm.heroImage || '',
            tags: fm.tags || (draft.idea ? draft.idea.tags : []),
            isDraft: true
          };
        }
      } catch (e) {
        console.error('Error reading active draft:', e);
      }
    }

    // Read saved posts from blog path
    if (fs.existsSync(BLOG_CONTENT_PATH)) {
      const files = fs.readdirSync(BLOG_CONTENT_PATH).filter(f => f.endsWith('.md') || f.endsWith('.mdx'));
      for (const file of files) {
        const filepath = path.join(BLOG_CONTENT_PATH, file);
        const post = parseMarkdownFile(filepath);
        posts.push({
          ...post,
          isDraft: false
        });
      }
    }

    res.json({
      activeDraft: activeDraftInfo,
      posts: posts
    });
  } catch (error) {
    console.error('Error fetching posts list:', error);
    res.status(500).json({ error: error.message });
  }
});

// Fetch stock image suggestions and resolve redirects
app.get('/api/images/suggest', async (req, res) => {
  try {
    const { title, keywords, slug } = req.query;
    const searchTerms = keywords || title || 'technology';

    console.log(`Fetching suggestions for keywords: "${searchTerms}", slug: "${slug}"`);

    // Picsum Suggestions (random list page to keep it fresh)
    async function fetchPicsumSuggestions() {
      try {
        const page = Math.floor(Math.random() * 15) + 1;
        const response = await fetch(`https://picsum.photos/v2/list?page=${page}&limit=6`);
        if (!response.ok) throw new Error(`Picsum list failed: ${response.status}`);
        const data = await response.json();
        return data.map(item => ({
          id: 'picsum_' + item.id,
          source: 'Picsum.photos',
          url: `https://picsum.photos/id/${item.id}/1024/576`,
          photographer: item.author
        }));
      } catch (e) {
        console.warn('Picsum API request failed, using fallback random URLs:', e.message);
        return Array.from({ length: 6 }).map((_, i) => ({
          id: `picsum_fallback_${i}`,
          source: 'Picsum.photos',
          url: `https://picsum.photos/1024/576?random=${i + 1}`,
          photographer: 'Random Photographer'
        }));
      }
    }

    // LoremFlickr Suggestions - follow redirect on backend to lock down the exact image
    async function resolveLoremFlickr(terms) {
      try {
        const firstTerm = terms.split(',')[0].trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
        const url = `https://loremflickr.com/1024/576/${encodeURIComponent(firstTerm || 'coding')}`;
        const response = await fetch(url, { redirect: 'follow' });
        if (!response.ok) throw new Error(`LoremFlickr failed: ${response.status}`);
        return [{
          id: 'loremflickr_resolved',
          source: 'LoremFlickr',
          url: response.url,
          photographer: 'LoremFlickr Contributor'
        }];
      } catch (e) {
        console.warn('LoremFlickr resolution failed:', e.message);
        return [{
          id: 'loremflickr_fallback',
          source: 'LoremFlickr',
          url: `https://loremflickr.com/1024/576/${terms.split(',')[0] || 'coding'}`,
          photographer: 'LoremFlickr Contributor'
        }];
      }
    }

    // Placehold.co Text Banner Suggestion
    function getPlaceholderSuggestion(postTitle) {
      const cleanTitle = postTitle || 'Blog Post';
      const encoded = encodeURIComponent(cleanTitle.length > 35 ? cleanTitle.substring(0, 35) + '...' : cleanTitle);
      return [{
        id: 'placehold_co',
        source: 'Placehold.co',
        url: `https://placehold.co/1024x576/0f172a/f8fafc/webp?text=${encoded}`,
        photographer: 'Placehold.co Generator'
      }];
    }

    // Pexels Search
    async function searchPexels(terms) {
      const apiKey = process.env.PEXELS_API_KEY;
      if (!apiKey) return [];
      try {
        const query = terms.split(',')[0].trim();
        const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=6&orientation=landscape`;
        const response = await fetch(url, {
          headers: { Authorization: apiKey }
        });
        if (!response.ok) throw new Error(`Pexels API error: ${response.status}`);
        const data = await response.json();
        return (data.photos || []).map(p => ({
          id: 'pexels_' + p.id,
          source: 'Pexels',
          url: p.src.large2x || p.src.large,
          photographer: p.photographer
        }));
      } catch (e) {
        console.error('Pexels API query failed:', e.message);
        return [];
      }
    }

    // Unsplash Search
    async function searchUnsplash(terms) {
      const accessKey = process.env.UNSPLASH_ACCESS_KEY;
      if (!accessKey) return [];
      try {
        const query = terms.split(',')[0].trim();
        const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=6&orientation=landscape`;
        const response = await fetch(url, {
          headers: { Authorization: `Client-ID ${accessKey}` }
        });
        if (!response.ok) throw new Error(`Unsplash API error: ${response.status}`);
        const data = await response.json();
        return (data.results || []).map(p => ({
          id: 'unsplash_' + p.id,
          source: 'Unsplash',
          url: p.urls.regular || p.urls.full,
          photographer: p.user.name
        }));
      } catch (e) {
        console.error('Unsplash API query failed:', e.message);
        return [];
      }
    }

    // Run searches in parallel
    const [picsumRes, loremRes, placeholdRes, pexelsRes, unsplashRes] = await Promise.allSettled([
      fetchPicsumSuggestions(),
      resolveLoremFlickr(searchTerms),
      Promise.resolve(getPlaceholderSuggestion(title)),
      searchPexels(searchTerms),
      searchUnsplash(searchTerms)
    ]);

    const suggestions = [];

    if (picsumRes.status === 'fulfilled') suggestions.push(...picsumRes.value);
    if (loremRes.status === 'fulfilled') suggestions.push(...loremRes.value);
    if (placeholdRes.status === 'fulfilled') suggestions.push(...placeholdRes.value);
    if (pexelsRes.status === 'fulfilled') suggestions.push(...pexelsRes.value);
    if (unsplashRes.status === 'fulfilled') suggestions.push(...unsplashRes.value);

    // Include Gemini image generator card
    suggestions.push({
      id: 'imagen_4_option',
      source: 'Gemini Image',
      requires_generation: true,
      url: '/img/google-antigravity.png',
      photographer: 'Google Gemini AI'
    });

    res.json({
      success: true,
      suggestions
    });
  } catch (error) {
    console.error('Error fetching image suggestions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Explicitly generate a preview image with Gemini image models
app.post('/api/images/generate-imagen', async (req, res) => {
  try {
    const { title, description, slug } = req.body;
    if (!title || !slug) {
      return res.status(400).json({ success: false, error: 'Missing title or slug.' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(400).json({ success: false, error: 'GEMINI_API_KEY is not set in environment variables.' });
    }

    const promptText = `A professional, high-quality modern blog header illustration. Title: "${title}". Description: "${description || ''}". Sleek vector graphic, minimalist digital art style, dark background with vibrant glowing accents of neon purple and deep cyan. No text, no words, no letters, no typography, no logos.`;

    console.log(`Generating AI Hero Image for slug: ${slug}...`);
    const buffer = await retryCall(() => generateAIImageBuffer(promptText));

    const tempFilename = `temp-${slug}-${Date.now()}.webp`;
    const tempOutputPath = path.join(DATA_DIR, tempFilename);

    await sharp(buffer)
      .webp({ quality: 85 })
      .toFile(tempOutputPath);

    console.log(`✅ Gemini temporary image saved: ${tempOutputPath}`);

    res.json({
      success: true,
      imageUrl: `/api/temp-images/${tempFilename}`,
      tempPath: tempFilename
    });
  } catch (error) {
    console.error('❌ Gemini image generation failed:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Save selected image (remote stock URL or local temp file) to the blog assets path
app.post('/api/images/select', async (req, res) => {
  try {
    const { imageUrl, slug, source, tempPath } = req.body;
    if (!imageUrl || !slug) {
      return res.status(400).json({ success: false, error: 'Missing imageUrl or slug.' });
    }

    const filename = `${slug}.webp`;
    const finalOutputPath = path.join(ASSETS_IMG_PATH, filename);

    console.log(`Saving selected hero image from source: "${source}" for slug: "${slug}"`);

    if ((source === 'Imagen 4' || source === 'Gemini Image') && tempPath) {
      const fullTempPath = path.join(DATA_DIR, tempPath);
      if (fs.existsSync(fullTempPath)) {
        fs.copyFileSync(fullTempPath, finalOutputPath);
        console.log(`✅ Copied temp image to ${finalOutputPath}`);
      } else {
        throw new Error(`Temporary image file not found at: ${fullTempPath}`);
      }
    } else {
      if (imageUrl.startsWith('/api/temp-images/')) {
        const localTempName = imageUrl.replace('/api/temp-images/', '');
        const fullTempPath = path.join(DATA_DIR, localTempName);
        if (fs.existsSync(fullTempPath)) {
          fs.copyFileSync(fullTempPath, finalOutputPath);
          console.log(`✅ Copied relative temp image to ${finalOutputPath}`);
        } else {
          throw new Error(`Temporary image file not found: ${localTempName}`);
        }
      } else {
        console.log(`Downloading remote image URL: ${imageUrl}`);
        const response = await fetch(imageUrl);
        if (!response.ok) {
          throw new Error(`Failed to download remote image: ${response.status} ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        await sharp(buffer)
          .webp({ quality: 85 })
          .toFile(finalOutputPath);

        console.log(`✅ Saved and WebP-optimized remote image to: ${finalOutputPath}`);
      }
    }

    const heroImageFrontmatterPath = `/img/${filename}`;
    updatePostHeroImage(slug, heroImageFrontmatterPath);

    res.json({
      success: true,
      heroImage: heroImageFrontmatterPath
    });
  } catch (error) {
    console.error('Error selecting image:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Handle drag-and-drop manual image uploading (Base64)
app.post('/api/images/upload', async (req, res) => {
  try {
    const { imageBase64, slug } = req.body;
    if (!imageBase64 || !slug) {
      return res.status(400).json({ success: false, error: 'Missing imageBase64 or slug.' });
    }

    console.log(`Processing uploaded image for slug: ${slug}...`);
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, 'base64');

    const filename = `${slug}.webp`;
    const outputPath = path.join(ASSETS_IMG_PATH, filename);

    await sharp(buffer)
      .webp({ quality: 85 })
      .toFile(outputPath);

    console.log(`✅ Successfully saved uploaded WebP image: ${outputPath}`);

    const heroImageFrontmatterPath = `/img/${filename}`;
    updatePostHeroImage(slug, heroImageFrontmatterPath);

    res.json({
      success: true,
      heroImage: heroImageFrontmatterPath
    });
  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});


// Get active config status
app.get('/api/config', (req, res) => {
  res.json({
    hasGeminiKey,
    hasResendKey,
    userEmail,
    senderEmail,
    contentPath: BLOG_CONTENT_PATH
  });
});

// Get currently proposed ideas
app.get('/api/ideas', (req, res) => {
  const filepath = path.join(DATA_DIR, 'ideas.json');
  if (fs.existsSync(filepath)) {
    const data = fs.readFileSync(filepath, 'utf-8');
    return res.json(JSON.parse(data));
  }
  res.json([]);
});

// Generate new ideas
app.post('/api/ideas/generate', async (req, res) => {
  try {
    const { keywords } = req.body;
    const ideas = await generateBlogIdeas(keywords);
    res.json({ success: true, ideas });
  } catch (error) {
    console.error('Error generating ideas:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Send ideas email
app.post('/api/ideas/send-email', async (req, res) => {
  try {
    const filepath = path.join(DATA_DIR, 'ideas.json');
    if (!fs.existsSync(filepath)) {
      return res.status(400).json({ success: false, error: 'No ideas generated yet. Generate ideas first.' });
    }
    const ideas = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
    await sendIdeasEmail(ideas);
    res.json({ success: true, message: 'Ideas sent to email.' });
  } catch (error) {
    console.error('Error sending ideas email:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get active draft
app.get('/api/draft', (req, res) => {
  const filepath = path.join(DATA_DIR, 'active-draft.json');
  if (fs.existsSync(filepath)) {
    const data = fs.readFileSync(filepath, 'utf-8');
    return res.json(JSON.parse(data));
  }
  res.json({ content: '' });
});

// Generate draft from a topic
app.post('/api/draft/generate', async (req, res) => {
  try {
    const { idea } = req.body;
    if (!idea) {
      return res.status(400).json({ success: false, error: 'Missing idea payload.' });
    }

    const draft = await generateDraft(idea);

    // Remove the selected idea from ideas.json
    const filepath = path.join(DATA_DIR, 'ideas.json');
    if (fs.existsSync(filepath)) {
      try {
        const ideas = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
        if (Array.isArray(ideas)) {
          const updatedIdeas = ideas.filter(i => i.id !== idea.id);
          fs.writeFileSync(filepath, JSON.stringify(updatedIdeas, null, 2));
        }
      } catch (err) {
        console.error('Failed to update ideas list after draft generation:', err);
      }
    }

    // Attempt to send email in background (don't block dashboard generation)
    if (hasResendKey && userEmail) {
      sendDraftEmail(idea.title, draft).catch(err => console.error('Failed to email draft:', err));
    }

    res.json({ success: true, content: draft });
  } catch (error) {
    console.error('Error generating draft:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Refine draft using AI instructions
app.post('/api/draft/refine', async (req, res) => {
  try {
    const { content, suggestion } = req.body;
    if (!content || !suggestion) {
      return res.status(400).json({ success: false, error: 'Missing content or suggestion.' });
    }
    const refined = await refineDraft(content, suggestion);
    res.json({ success: true, content: refined });
  } catch (error) {
    console.error('Error refining draft:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Save draft as markdown file in the Astro blog content path
app.post('/api/draft/save', (req, res) => {
  try {
    let { content, slug } = req.body;
    if (!content || !slug) {
      return res.status(400).json({ success: false, error: 'Missing content or slug.' });
    }

    // Ensure slug is clean
    const safeSlug = slug.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
    const filename = `${safeSlug}.md`;
    const finalPath = path.join(BLOG_CONTENT_PATH, filename);

    // Check if the content contains a reference to an image file in frontmatter
    // e.g. heroImage: "/img/some-slug.webp"
    const matchImage = content.match(/heroImage:\s*"\/img\/([^"]+)\.webp"/);
    if (matchImage) {
      const oldImageSlug = matchImage[1];
      if (oldImageSlug !== safeSlug) {
        const oldImgPath = path.join(ASSETS_IMG_PATH, `${oldImageSlug}.webp`);
        const newImgPath = path.join(ASSETS_IMG_PATH, `${safeSlug}.webp`);
        if (fs.existsSync(oldImgPath)) {
          fs.renameSync(oldImgPath, newImgPath);
          console.log(`Renamed image from ${oldImgPath} to ${newImgPath}`);
          // Update the frontmatter value inside the content
          content = content.replace(`heroImage: "/img/${oldImageSlug}.webp"`, `heroImage: "/img/${safeSlug}.webp"`);
        }
      }
    }

    fs.writeFileSync(finalPath, content, 'utf-8');

    res.json({ success: true, filePath: finalPath, filename });
  } catch (error) {
    console.error('Error saving blog post file:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Commit blog post using local git workflow
app.post('/api/git/commit', async (req, res) => {
  try {
    const { message, filename } = req.body;
    if (!message || !filename) {
      return res.status(400).json({ success: false, error: 'Missing commit message or filename.' });
    }

    // Run git commands in sequence
    // 1. Resolve relative paths from repo root
    const relativeFilePath = path.join('src', 'content', 'blog', filename);
    const imageFilename = filename.replace(/\.md$/, '.webp');
    const relativeImagePath = path.join('src', 'assets', 'img', 'blog', imageFilename);

    const fullImagePath = path.join(REPO_ROOT, relativeImagePath);

    console.log(`Git workflow starting in ${REPO_ROOT} for file: ${relativeFilePath}`);

    // Check if the image file exists, and stage it if so
    let gitAddCommand = `git add ${relativeFilePath}`;
    if (fs.existsSync(fullImagePath)) {
      console.log(`Staging associated hero image: ${relativeImagePath}`);
      gitAddCommand += ` ${relativeImagePath}`;
    }

    // git add
    const addResult = await execPromise(gitAddCommand, { cwd: REPO_ROOT });
    console.log('Git Add output:', addResult.stdout, addResult.stderr);

    // git commit
    const commitResult = await execPromise(`git commit -m "${message.replace(/"/g, '\\"')}"`, { cwd: REPO_ROOT });
    console.log('Git Commit output:', commitResult.stdout, commitResult.stderr);

    // git push
    const pushResult = await execPromise(`git push`, { cwd: REPO_ROOT });
    console.log('Git Push output:', pushResult.stdout, pushResult.stderr);

    res.json({
      success: true,
      log: `Git Add:\n${addResult.stdout || 'Done.'}\n\nGit Commit:\n${commitResult.stdout}\n\nGit Push:\n${pushResult.stdout || 'Done.'}`
    });
  } catch (error) {
    console.error('Git Command failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stdout: error.stdout,
      stderr: error.stderr
    });
  }
});


// Daily Cron Job (Runs every day at 8:00 AM)
// Schedule syntax: minute hour day-of-month month day-of-week
cron.schedule('0 8 * * *', async () => {

  console.log('Cron Job Triggered: Generating daily blog ideas...');
  try {
    if (!hasGeminiKey || !hasResendKey || !userEmail) {
      console.warn('Cron skipped: Missing API keys or email config.');
      return;
    }
    const ideas = await generateBlogIdeas();
    await sendIdeasEmail(ideas);
    console.log('Cron successfully sent daily blog ideas.');
  } catch (error) {
    console.error('Error in daily ideas cron job:', error);
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(`🚀 Blog Generator dashboard running at:`);
  console.log(`   👉 http://localhost:${PORT}`);
  console.log(`===================================================`);
});
