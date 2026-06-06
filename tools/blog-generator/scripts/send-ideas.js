import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Resend } from 'resend';

// Load env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const BLOG_CONTENT_PATH = path.resolve(__dirname, process.env.BLOG_CONTENT_PATH || '../../../src/content/blog');
const DATA_DIR = path.join(__dirname, '../data');

// Ensure data dir exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const geminiKey = process.env.GEMINI_API_KEY;
const resendKey = process.env.RESEND_API_KEY;
const userEmail = process.env.USER_EMAIL;
const senderEmail = process.env.SENDER_EMAIL || 'onboarding@resend.dev';

if (!geminiKey || !resendKey || !userEmail) {
  console.error('Error: Missing environment variables. Make sure GEMINI_API_KEY, RESEND_API_KEY, and USER_EMAIL are set in .env.');
  process.exit(1);
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
    return posts.slice(0, 10);
  } catch (error) {
    console.error('Error reading existing posts:', error);
    return [];
  }
}

// Helper to retry async operations (like API requests) with exponential backoff
async function retryCall(fn, retries = 3, delayMs = 2000) {
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

async function run() {

  console.log('Starting daily blog ideas generation task...');
  
  try {
    const existingPosts = await getExistingPostsContext();
    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-3.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });

    
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

    const result = await retryCall(() => model.generateContent(prompt));
    const text = result.response.text();

    
    const cleanJsonText = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    const parsedData = JSON.parse(cleanJsonText);
    
    const ideasWithIds = parsedData.ideas.map((idea, index) => ({
      id: `idea_${Date.now()}_${index}`,
      ...idea,
      generatedAt: new Date().toISOString()
    }));
    
    // Save ideas
    fs.writeFileSync(path.join(DATA_DIR, 'ideas.json'), JSON.stringify(ideasWithIds, null, 2));
    console.log(`Successfully generated 3 ideas and saved to data/ideas.json`);
    
    // Send email
    console.log(`Sending email to ${userEmail} via Resend...`);
    const resend = new Resend(resendKey);
    
    const ideasHtml = ideasWithIds.map((idea, idx) => `
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

    const port = process.env.PORT || 5000;
    const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #334155;">
        <h2 style="color: #6366f1; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 20px;">💡 Daily Blog Post Ideas</h2>
        <p style="font-size: 16px; line-height: 1.5;">Hi Chris, here are your blog ideas generated for today, <strong>${new Date().toLocaleDateString()}</strong>:</p>
        
        ${ideasHtml}
        
        <div style="margin-top: 30px; text-align: center;">
          <a href="https://blog.christran.io" style="background-color: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Open Dashboard to Write & Publish</a>
        </div>

        <p style="font-size: 12px; color: #94a3b8; text-align: center; margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 20px;">
          Sent automatically by Christran.io Blog Post Generator Tool.
        </p>
      </div>
    `;

    await resend.emails.send({
      from: senderEmail,
      to: userEmail,
      subject: `💡 Blog Post Ideas for ${new Date().toLocaleDateString()} (CLI)`,
      html: htmlContent
    });
    
    console.log('✅ Daily ideas successfully generated and emailed!');
  } catch (error) {
    console.error('❌ Error executing daily task:', error);
    process.exit(1);
  }
}

run();
