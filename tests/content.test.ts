import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'yaml';
import { z } from 'zod';

const blogSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  pubDate: z.coerce.date(),
  updatedDate: z.coerce.date().optional(),
  heroImage: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

const portfolioSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  category: z.enum(['app', 'infrastructure', 'community']),
  tags: z.array(z.string()),
  techStack: z.array(z.string()),
  image: z.string().optional(),
  liveUrl: z.string().optional(),
  sourceUrl: z.string().optional(),
  featured: z.boolean(),
  order: z.number(),
});

function extractFrontmatter(filePath: string): Record<string, unknown> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) {
    throw new Error(`No frontmatter block found in ${filePath}`);
  }
  return yaml.parse(match[1]) || {};
}

describe('Content Collections Frontmatter Schema Validation', () => {
  const blogDir = path.resolve('src/content/blog');
  const portfolioDir = path.resolve('src/content/portfolio');

  describe('Blog Posts', () => {
    const blogFiles = fs.readdirSync(blogDir).filter((file) => file.endsWith('.md') || file.endsWith('.mdx'));

    it('should find blog posts', () => {
      expect(blogFiles.length).toBeGreaterThan(0);
    });

    blogFiles.forEach((file) => {
      it(`should validate frontmatter for blog: ${file}`, () => {
        const filePath = path.join(blogDir, file);
        const frontmatter = extractFrontmatter(filePath);
        const parsed = blogSchema.safeParse(frontmatter);

        if (!parsed.success) {
          throw new Error(`Validation failed for ${file}: ${JSON.stringify(parsed.error.format())}`);
        }

        expect(parsed.success).toBe(true);
        expect(isNaN(parsed.data.pubDate.getTime())).toBe(false);
      });
    });
  });

  describe('Portfolio Entries', () => {
    const portfolioFiles = fs.readdirSync(portfolioDir).filter((file) => file.endsWith('.md') || file.endsWith('.mdx'));

    it('should find portfolio entries', () => {
      expect(portfolioFiles.length).toBeGreaterThan(0);
    });

    portfolioFiles.forEach((file) => {
      it(`should validate frontmatter for portfolio: ${file}`, () => {
        const filePath = path.join(portfolioDir, file);
        const frontmatter = extractFrontmatter(filePath);
        const parsed = portfolioSchema.safeParse(frontmatter);

        if (!parsed.success) {
          throw new Error(`Validation failed for ${file}: ${JSON.stringify(parsed.error.format())}`);
        }

        expect(parsed.success).toBe(true);
        expect(parsed.data.order).toBeGreaterThan(0);
      });
    });
  });
});
