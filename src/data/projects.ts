export interface Project {
  slug: string;
  title: string;
  description: string;
  category: 'app' | 'infrastructure' | 'community';
  tags: string[];
  techStack: string[];
  image?: string;
  liveUrl?: string;
  sourceUrl?: string;
  detailUrl?: string;
  featured: boolean;
  order: number;
}

export const projects: Project[] = [
  {
    slug: 'ai-chat',
    title: 'AI Chat',
    description:
      'Large Language Model interface for AI-powered text generation and conversation. Provides access to advanced language models for content creation, analysis, and interactive conversations with customizable parameters.',
    category: 'app',
    tags: ['AI', 'Language Model', 'Text Generation'],
    techStack: ['Cloudflare Workers', 'TypeScript', 'Workers AI'],
    image: '/img/projects/ai-chat.png',
    liveUrl: 'https://llm.christran.io',
    featured: true,
    order: 3,
  },
  {
    slug: 'ai-image-gen',
    title: 'AI Image Generation',
    description:
      'Text-to-Image generation platform that transforms written descriptions into visual artwork. Leverages AI image generation models to create custom images from text prompts, perfect for content creators and designers.',
    category: 'app',
    tags: ['AI Art', 'Image Generation', 'Creative'],
    techStack: ['Cloudflare Workers', 'TypeScript', 'Workers AI'],
    image: '/img/projects/ai-image-gen.png',
    liveUrl: 'https://t2i.christran.io',
    featured: true,
    order: 4,
  },
  {
    slug: 'homelab',
    title: 'Enterprise Home Lab',
    description:
      'Enterprise-grade testing environment built on decommissioned Dell PowerEdge servers. Simulates complex network topologies, manages virtualized infrastructure, and provides a dedicated space for continuous skill development.',
    category: 'infrastructure',
    tags: ['Infrastructure Virtualization', 'Network Simulation', 'Hardware Restoration'],
    techStack: ['Proxmox', 'pfSense', 'Docker', 'Ansible'],
    image: '/img/projects/homelab.png',
    detailUrl: '/portfolio/homelab',
    featured: true,
    order: 1,
  },
  {
    slug: 'chat',
    title: 'Chat',
    description:
      'Real-time chat application for seamless communication and collaboration. Built with modern web technologies, featuring instant messaging, user authentication, and responsive design for desktop and mobile.',
    category: 'app',
    tags: ['Real-time Chat', 'Communication', 'WebSocket'],
    techStack: ['Cloudflare Workers', 'Durable Objects', 'WebSocket'],
    image: '/img/projects/chat.png',
    liveUrl: 'https://chat.christran.io',
    featured: false,
    order: 5,
  },
  {
    slug: 'todo',
    title: 'To-Do List',
    description:
      'A modern task management application for organizing and tracking personal and professional tasks. Features an intuitive interface, priority levels, due dates, and progress tracking to stay productive.',
    category: 'app',
    tags: ['Task Management', 'Productivity', 'Web App'],
    techStack: ['Cloudflare Workers', 'KV Storage', 'TypeScript'],
    image: '/img/projects/todo.png',
    liveUrl: 'https://2do.christran.io',
    featured: false,
    order: 6,
  },
  {
    slug: 'f1-wiki',
    title: 'F1 Fandom Wiki',
    description:
      'Administrator and contributor to the comprehensive Formula 1 wiki on Fandom. Managing content, community guidelines, and technical aspects of one of the largest F1 knowledge bases online.',
    category: 'community',
    tags: ['Wiki Administration', 'Community Management', 'Content Curation'],
    techStack: ['MediaWiki', 'Lua', 'CSS'],
    image: '/img/projects/f1-wiki.png',
    liveUrl: 'https://f1.fandom.com',
    featured: false,
    order: 2,
  },
];

export function getFeaturedProjects(): Project[] {
  return projects
    .filter((p) => p.featured)
    .sort((a, b) => a.order - b.order);
}

export function getProjectsByCategory(category?: string): Project[] {
  if (!category || category === 'all') {
    return [...projects].sort((a, b) => a.order - b.order);
  }
  return projects
    .filter((p) => p.category === category)
    .sort((a, b) => a.order - b.order);
}
