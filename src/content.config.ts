import { glob } from "astro/loaders";
import { defineCollection } from "astro:content";
import { blogSchema, portfolioSchema } from "./content/schemas";

const blog = defineCollection({
  // Load Markdown and MDX files in the `src/content/blog/` directory.
  loader: glob({ base: "./src/content/blog", pattern: "**/*.{md,mdx}" }),
  // Type-check frontmatter using a schema
  schema: blogSchema,
});

const portfolio = defineCollection({
  // Load Markdown and MDX files in the `src/content/portfolio/` directory.
  loader: glob({ base: "./src/content/portfolio", pattern: "**/*.{md,mdx}" }),
  schema: portfolioSchema,
});

export const collections = { blog, portfolio };
