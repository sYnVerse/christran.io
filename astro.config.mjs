// @ts-check
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { unified } from "@astrojs/markdown-remark";
import fs from "node:fs";
import { parseRedirectUrls } from "./src/lib/sitemap-redirects.mjs";

import cloudflare from "@astrojs/cloudflare";

const isCloudflareDeployment = !!process.env.CF_PAGES || !!process.env.CF_BUILD;

const siteUrl = "https://christran.io";

// Read and parse public/_redirects to add to sitemap
/** @type {string[]} */
let redirectUrls = [];
try {
  const redirectsPath = new URL("./public/_redirects", import.meta.url);
  const fileContent = fs.readFileSync(redirectsPath, "utf-8");
  redirectUrls = parseRedirectUrls(fileContent, siteUrl);
} catch (error) {
  console.error("Failed to read public/_redirects", error);
}

// https://astro.build/config
export default defineConfig({
  site: siteUrl,
  integrations: [
    mdx(),
    sitemap({
      customPages: redirectUrls,
    }),
  ],
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
