import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Resend } from 'resend';
import cron from 'node-cron';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Serve static dashboard files
app.use(express.static(path.join(__dirname, 'public')));

// Configuration
const PORT = process.env.PORT || 5000;
const BLOG_CONTENT_PATH = path.resolve(__dirname, process.env.BLOG_CONTENT_PATH || '../../src/content/blog');
const DATA_DIR = path.join(__dirname, 'data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

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

// Helper to get Gemini Client
function getGeminiModel() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set in environment variables.');
  }
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  return genAI.getGenerativeModel({ 
    model: "gemini-2.5-flash",
    generationConfig: { responseMimeType: "application/json" }
  });
}

function getGeminiTextModel() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set in environment variables.');
  }
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  return genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
}

// Helper to get Resend Client
function getResend() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not set in environment variables.');
  }
  return new Resend(process.env.RESEND_API_KEY);
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
async function generateBlogIdeas() {
  const existingPosts = await getExistingPostsContext();
  const model = getGeminiModel();
  
  const contextText = existingPosts.length > 0 
    ? `Here are some of the existing blog posts on the site for reference:\n${existingPosts.map(p => `- Title: "${p.title}"\n  Description: "${p.description}"\n  Tags: ${JSON.stringify(p.tags)}`).join('\n')}`
    : 'The blog is new and does not have any posts yet.';

  const prompt = `You are a blog post idea generator for Chris Tran's personal website and blog (christran.io). 
  Chris is a tech enthusiast, software engineer, and system builder who writes about technical topics, hardware, automation, software engineering, and clean code.
  
  ${contextText}
  
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

  const result = await model.generateContent(prompt);
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
  
  fs.writeFileSync(path.join(DATA_DIR, 'ideas.json'), JSON.stringify(ideasWithIds, null, 2));
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

  const dashboardUrl = 'https://blog.christran.io';

  
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

// Generate draft logic
async function generateDraft(idea) {
  const model = getGeminiTextModel();
  
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
  heroImage: "/img/${idea.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.webp"
  description: "${idea.description.replace(/"/g, '\\"')}"
  tags: ${JSON.stringify(idea.tags)}
  ---
  
  Return only the complete Markdown content, including the YAML frontmatter. Do not wrap the entire output in a markdown block (e.g. do not wrap the frontmatter and content in \`\`\`markdown ... \`\`\`). Just output raw markdown text.`;

  const result = await model.generateContent(prompt);
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
  
  // Convert markdown to very basic HTML for preview in email
  const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 20px; color: #334155;">
      <h2 style="color: #6366f1; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">📝 Draft Generated: ${title}</h2>
      <p>Hi Chris, your blog post draft has been generated. You can review the draft below or edit it in your local dashboard.</p>
      
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; font-family: monospace; white-space: pre-wrap; font-size: 14px; color: #334155; line-height: 1.6; margin: 20px 0; max-height: 500px; overflow-y: auto;">
        ${draftContent.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}
      </div>
      
      <div style="margin-top: 30px; text-align: center;">
        <a href="https://blog.christran.io" style="background-color: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Open Dashboard to Edit & Commit</a>
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

  const result = await model.generateContent(prompt);
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

// --- Endpoints ---

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
    const ideas = await generateBlogIdeas();
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
    const { content, slug } = req.body;
    if (!content || !slug) {
      return res.status(400).json({ success: false, error: 'Missing content or slug.' });
    }
    
    // Ensure slug is clean
    const safeSlug = slug.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
    const filename = `${safeSlug}.md`;
    const finalPath = path.join(BLOG_CONTENT_PATH, filename);
    
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
    // 1. Status check to make sure file is there
    const relativeFilePath = path.join('src', 'content', 'blog', filename);
    
    console.log(`Git workflow starting for file: ${relativeFilePath}`);
    
    // git add
    const addResult = await execPromise(`git add ${relativeFilePath}`);
    console.log('Git Add output:', addResult.stdout, addResult.stderr);
    
    // git commit
    const commitResult = await execPromise(`git commit -m "${message.replace(/"/g, '\\"')}"`);
    console.log('Git Commit output:', commitResult.stdout, commitResult.stderr);
    
    // git push
    const pushResult = await execPromise(`git push`);
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

// Daily Cron Job (Runs every day at 9:00 AM)
// Schedule syntax: minute hour day-of-month month day-of-week
cron.schedule('0 9 * * *', async () => {
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
