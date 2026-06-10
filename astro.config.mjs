// @ts-check
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { unified } from "@astrojs/markdown-remark";

import cloudflare from "@astrojs/cloudflare";

const isCloudflareDeployment = !!process.env.CF_PAGES || !!process.env.CF_BUILD;

// https://astro.build/config
export default defineConfig({
  site: "https://christran.io",
  integrations: [mdx(), sitemap()],
  markdown: {
    processor: unified({
      remarkPlugins: [remarkMath],
      rehypePlugins: [rehypeKatex],
    }),
  },
  build: {
    inlineStylesheets: "always",
  },
  ...(isCloudflareDeployment ? {
    adapter: cloudflare({
      prerenderEnvironment: 'node',
    })
  } : {}),
});
