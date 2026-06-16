import { getCollection } from 'astro:content';

export async function GET() {
  const posts = await getCollection('blog');
  const projects = await getCollection('portfolio');
  
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
    let body = proj.data.description + ' ' + (proj.data.tags || []).join(' ') + ' ' + (proj.data.techStack || []).join(' ');
    
    if (proj.body) {
      const cleanBody = proj.body
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      body += ' ' + cleanBody;
    }

    return {
      title: proj.data.title,
      description: proj.data.description,
      body: body,
      url: `/portfolio/${proj.id}/`,
      type: 'project',
      date: null,
      tags: [...(proj.data.tags || []), ...(proj.data.techStack || [])]
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
