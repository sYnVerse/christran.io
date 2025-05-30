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
    // Match all image files in any directory
    '/*': [
      {
        key: 'Cache-Control',
        value: 'public, max-age=31536000, immutable'
      }
    ],
    '/*/*': [
      {
        key: 'Cache-Control',
        value: 'public, max-age=31536000, immutable'
      }
    ],
    '/*/*/*': [
      {
        key: 'Cache-Control',
        value: 'public, max-age=31536000, immutable'
      }
    ]
  }
});
