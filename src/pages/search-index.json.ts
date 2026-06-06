import { getCollection } from 'astro:content';
import { projects } from '../data/projects';
import fs from 'fs';
import path from 'path';

export async function GET() {
  const posts = await getCollection('blog');
  
  const blogIndex = posts.map(post => ({
    title: post.data.title,
    description: post.data.description,
    body: post.body || '',
    url: `/blog/${post.id}/`,
    type: 'blog',
    date: post.data.pubDate.toISOString(),
    tags: []
  }));

  const projectIndex = projects.map(proj => {
    let body = proj.description + ' ' + (proj.tags || []).join(' ') + ' ' + (proj.techStack || []).join(' ');
    
    if (proj.slug) {
      try {
        const filePath = path.resolve(`./src/pages/portfolio/${proj.slug}.astro`);
        if (fs.existsSync(filePath)) {
          const fileContent = fs.readFileSync(filePath, 'utf8');
          // Strip frontmatter
          const contentWithoutFrontmatter = fileContent.replace(/^---[\s\S]*?---/, '');
          // Strip style tags
          const contentWithoutStyle = contentWithoutFrontmatter.replace(/<style>[\s\S]*?<\/style>/gi, '');
          // Strip script tags
          const contentWithoutScript = contentWithoutStyle.replace(/<script>[\s\S]*?<\/script>/gi, '');
          // Strip HTML tags
          const textOnly = contentWithoutScript.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
          body += ' ' + textOnly;
        }
      } catch (e) {
        console.error(`Error reading detail page for ${proj.slug}:`, e);
      }
    }

    return {
      title: proj.title,
      description: proj.description,
      body: body,
      url: proj.detailUrl || proj.liveUrl || `/portfolio`,
      type: 'project',
      date: null,
      tags: [...(proj.tags || []), ...(proj.techStack || [])]
    };
  });

  const index = [...blogIndex, ...projectIndex];

  return new Response(JSON.stringify(index), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=0, must-revalidate'
    }
  });
}
