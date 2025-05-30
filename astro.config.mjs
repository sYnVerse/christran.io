// @ts-check
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";

import cloudflare from "@astrojs/cloudflare";

// https://astro.build/config
export default defineConfig({
  site: "https://example.com",
  integrations: [mdx(), sitemap()],
  adapter: cloudflare({
    platformProxy: {
      enabled: true,
    },
  }),
  headers: {
    // Images
    '/**/*.{jpg,jpeg,png,gif,webp,svg,ico}': [
      {
        key: 'Cache-Control',
        value: 'public, max-age=31536000, stale-while-revalidate=86400'
      }
    ],
    // Fonts
    '/**/*.{woff,woff2,eot,ttf,otf}': [
      {
        key: 'Cache-Control',
        value: 'public, max-age=31536000, stale-while-revalidate=86400'
      }
    ],
    // Media files
    '/**/*.{mp3,mp4,webm,ogg,wav}': [
      {
        key: 'Cache-Control',
        value: 'public, max-age=31536000, stale-while-revalidate=86400'
      }
    ],
    // Scripts and stylesheets
    '/**/*.{js,css,mjs}': [
      {
        key: 'Cache-Control',
        value: 'public, max-age=31536000, stale-while-revalidate=86400'
      }
    ]
  }
});
