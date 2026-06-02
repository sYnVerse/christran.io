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
    slug: 'homelab',
    title: 'Enterprise Home Lab',
    description:
      'Enterprise-grade testing environment built on decommissioned Dell PowerEdge servers. Simulates complex network topologies, manages virtualized infrastructure, and provides a dedicated space for continuous skill development.',
    category: 'infrastructure',
    tags: ['Infrastructure Virtualization', 'Network Simulation', 'Hardware Restoration'],
    techStack: ['Proxmox', 'pfSense', 'Docker', 'Ansible'],
    image: '/img/projects/homelab.webp',
    detailUrl: '/portfolio/homelab',
    featured: true,
    order: 1,
  },
  {
    slug: 'synapse',
    title: 'sYnapse',
    description:
      'A unified agentic trading platform acting as a secure multi-broker gateway. Integrates with Alpaca (equities) and Tradovate (futures) API endpoints to manage account positions, place custom market/limit orders, and orchestrate autonomous strategy execution running entirely on Cloudflare Workers and Durable Objects.',
    category: 'app',
    tags: ['Algorithmic Trading', 'Finance', 'Authentication', 'Durable Objects'],
    techStack: ['Cloudflare Workers', 'React', 'D1 Database', 'Durable Objects', 'OpenAuth.js', 'Vite'],
    image: '/img/projects/synapse.jpeg',
    liveUrl: 'https://synapse.christran.io',
    sourceUrl: 'https://github.com/sYnVerse/sYnapse',
    featured: true,
    order: 2,
  },
  {
    slug: 'todo',
    title: 'sYnX',
    description:
      'A modern task management application for organizing and tracking personal and professional tasks. Features an intuitive interface, priority levels, due dates, and progress tracking to stay productive.',
    category: 'app',
    tags: ['Task Management', 'Productivity', 'Web App'],
    techStack: ['Cloudflare Workers', 'KV Storage', 'TypeScript'],
    image: '/img/projects/todo.webp',
    liveUrl: 'https://synx.christran.io',
    featured: true,
    order: 3,
  },
  {
    slug: 'f1-wiki',
    title: 'F1 Fandom Wiki',
    description:
      'Administrator and contributor to the comprehensive Formula 1 wiki on Fandom. Managing content, community guidelines, and technical aspects of one of the largest F1 knowledge bases online.',
    category: 'community',
    tags: ['Wiki Administration', 'Community Management', 'Content Curation'],
    techStack: ['MediaWiki', 'Lua', 'CSS'],
    image: '/img/projects/f1-wiki.webp',
    liveUrl: 'https://f1.fandom.com',
    featured: true,
    order: 4,
  },
  {
    slug: 'f1-fandom',
    title: 'F1 Wiki Automator',
    description:
      'A Cloudflare Worker and SPA dashboard that automates Formula 1 Fandom Wiki page management. Fetches live Grand Prix results, standings, and practice times via the Jolpica F1 API, scrapes practice HTML from Formula1.com, generates formatted MediaWiki wikitext, and deploys edits automatically using bot credentials.',
    category: 'app',
    tags: ['Automation', 'MediaWiki', 'Cloudflare Workers', 'API Integration'],
    techStack: ['Cloudflare Workers', 'TypeScript', 'MediaWiki API', 'Jolpica F1 API', 'KV Storage'],
    image: '/img/projects/f1-fandom.png',
    liveUrl: 'https://f1-wiki.christran.io',
    sourceUrl: 'https://github.com/sYnVerse/f1-fandom',
    featured: true,
    order: 5,
  },
  {
    slug: 'ai-image-gen',
    title: 'illusYn',
    description:
      'AI-powered text-to-image generation platform that transforms written descriptions into stunning visual artwork. Leverages advanced models to generate custom images from text prompts, perfect for content creators and designers.',
    category: 'app',
    tags: ['AI Art', 'Image Generation', 'Creative'],
    techStack: ['Cloudflare Workers', 'TypeScript', 'Workers AI'],
    image: '/img/projects/ai-image-gen.webp',
    liveUrl: 'https://illusyn.christran.io',
    featured: true,
    order: 6,
  },
  {
    slug: 'ai-chat',
    title: 'AI Chat',
    description:
      'Large Language Model interface for AI-powered text generation and conversation. Provides access to advanced language models for content creation, analysis, and interactive conversations with customizable parameters.',
    category: 'app',
    tags: ['AI', 'Language Model', 'Text Generation'],
    techStack: ['Cloudflare Workers', 'TypeScript', 'Workers AI'],
    image: '/img/projects/ai-chat.webp',
    liveUrl: 'https://llm.christran.io',
    featured: false,
    order: 7,
  },
  {
    slug: 'chat',
    title: 'Chat',
    description:
      'Real-time chat application for seamless communication and collaboration. Built with modern web technologies, featuring instant messaging, user authentication, and responsive design for desktop and mobile.',
    category: 'app',
    tags: ['Real-time Chat', 'Communication', 'WebSocket'],
    techStack: ['Cloudflare Workers', 'Durable Objects', 'WebSocket'],
    image: '/img/projects/chat.webp',
    liveUrl: 'https://chat.christran.io',
    featured: false,
    order: 8,
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
