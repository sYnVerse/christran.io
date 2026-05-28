import { getCollection } from 'astro:content';
import { projects } from '../data/projects';

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

  const projectIndex = projects.map(proj => ({
    title: proj.title,
    description: proj.description,
    body: proj.description + ' ' + (proj.tags || []).join(' ') + ' ' + (proj.techStack || []).join(' '),
    url: proj.detailUrl || proj.liveUrl || `/portfolio`,
    type: 'project',
    date: null,
    tags: [...(proj.tags || []), ...(proj.techStack || [])]
  }));

  const index = [...blogIndex, ...projectIndex];

  return new Response(JSON.stringify(index), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600'
    }
  });
}
