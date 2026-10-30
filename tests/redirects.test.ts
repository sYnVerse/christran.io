import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Redirects and Sitemap Configuration', () => {
  const redirectsPath = path.resolve('public/_redirects');

  it('should have a public/_redirects file', () => {
    expect(fs.existsSync(redirectsPath)).toBe(true);
  });

  it('should parse valid redirect rules with status codes', () => {
    const content = fs.readFileSync(redirectsPath, 'utf-8');
    const lines = content
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'));

    expect(lines.length).toBeGreaterThan(0);

    for (const line of lines) {
      const parts = line.split(/\s+/);
      expect(parts.length).toBeGreaterThanOrEqual(2);

      const [from, to, status] = parts;
      expect(from.startsWith('/')).toBe(true);
      expect(to.length).toBeGreaterThan(0);

      if (status) {
        const statusCode = parseInt(status, 10);
        expect([301, 302, 307, 308, 200]).toContain(statusCode);
      }
    }
  });

  it('should correctly extract sitemap custom pages as in astro.config.mjs', () => {
    const siteUrl = 'https://christran.io';
    const content = fs.readFileSync(redirectsPath, 'utf-8');
    const redirectUrls = content
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const parts = line.split(/\s+/);
        const fromPath = parts[0];
        if (fromPath && fromPath.startsWith('/') && fromPath !== '/sitemap.xml') {
          return `${siteUrl}${fromPath}`;
        }
        return null;
      })
      .filter((url): url is string => url !== null);

    expect(redirectUrls.length).toBeGreaterThan(0);
    for (const url of redirectUrls) {
      expect(url.startsWith('https://christran.io/')).toBe(true);
      expect(url).not.toContain('/sitemap.xml');
    }
  });
});
