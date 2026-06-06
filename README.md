# christran.io

A modern personal website and blog built with **Astro**, deployed on **Cloudflare Workers**.

Visit the live site: [https://christran.io](https://christran.io)

## About

This repository contains the source code for christran.io, a personal website showcasing my work, thoughts, and projects. It's built with modern web technologies and optimized for performance.

## Tech Stack

- **Framework**: [Astro](https://astro.build) (90.9%)
- **Language**: [TypeScript](https://www.typescriptlang.org/) (6%)
- **Styling**: [CSS](https://developer.mozilla.org/en-US/docs/Web/CSS) (2.4%)
- **Hosting**: [Cloudflare Workers](https://workers.cloudflare.com/)

## Features

✨ Fast and performant static site  
📝 Blog with MDX support  
🔍 SEO optimized with sitemap and RSS feed  
🎨 Responsive and clean design  
⚡ Deployed on Cloudflare Workers  
🔄 Automated deployment pipeline  
✍️ Local AI Blog Generator & Editor Dashboard (Gemini + Resend + Imagen 3)  


## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

```bash
# Clone the repository
git clone https://github.com/sYnVerse/christran.io.git
cd christran.io

# Install dependencies
npm install
```

### Development

```bash
# Start local development server
npm run dev
```

The site will be available at `http://localhost:3000` (or the port shown in your terminal).

### Build

```bash
# Build for production
npm run build

# Preview the build locally
npm run preview
```

### Deployment

```bash
# Deploy to Cloudflare Workers
npm run deploy
```

## Project Structure

```
├── src/
│   ├── pages/          # Route-based pages
│   ├── components/     # Reusable Astro/React/Vue components
│   ├── content/        # Blog posts and content collections
│   ├── layouts/        # Layout components
│   ├── styles/         # Global styles
│   └── utils/          # Utility functions
└── tools/
    └── blog-generator/ # Local AI blog creator & editor dashboard
```

## AI Blog Generator Tool

This repository includes a localized, administrative dashboard and automation tool to streamline writing new posts.

### Features
*   **Daily Scheduling**: Automatically generates 3 personalized topic ideas every morning at **8:00 AM** and emails them to you using the **Resend API**.
*   **AI Drafting**: Click a button to generate a complete 1000-word blog post with Astro-compatible frontmatter.
*   **Imagen 3 Integration**: Automatically generates custom, web-optimized `.webp` hero images using Google's **Imagen 3** model, storing them in `src/assets/img/`.
*   **Live Split Editor**: Real-time Markdown editor side-by-side with HTML rendering.
*   **AI Proofreader & Editor**: Send interactive prompts (e.g. *"make the tone more humorous"* or *"add a section comparing X to Y"*) to refine drafts on the fly.
*   **GitHub Publisher**: Commit and push new articles directly to your repo via a built-in terminal box.

### Quick Start
1. Navigate to the tool's directory:
   ```bash
   cd tools/blog-generator
   ```
2. Configure credentials by copying the template:
   ```bash
   cp .env.example .env
   ```
   *Fill in your `GEMINI_API_KEY`, `RESEND_API_KEY`, and `USER_EMAIL` inside the `.env` file.*
3. Run the API verification check:
   ```bash
   npm run test-apis
   ```
4. Start the server (runs the cron job and serves the dashboard):
   ```bash
   npm start
   ```
5. Open your browser and navigate to:
   👉 **http://localhost:5000**


## Available Commands

| Command | Action |
| :--- | :--- |
| `npm run dev` | Start local dev server at `http://localhost:3000` |
| `npm run build` | Build your production site to `./dist/` |
| `npm run preview` | Preview your build locally before deploying |
| `npm run check` | Run type checking and validation |
| `npm run deploy` | Deploy to Cloudflare Workers |
| `npm run cf-typegen` | Generate Cloudflare types |

## Learning Resources

- [Astro Documentation](https://docs.astro.build)
- [Astro Discord Community](https://astro.build/chat)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)

## License

This project is private. For inquiries about the code or design, please reach out.

---

Built with ❤️ by [sYnVerse](https://github.com/sYnVerse)
