import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Public Headers Configuration', () => {
  const headersPath = path.resolve('public/_headers');

  it('should have a public/_headers file', () => {
    expect(fs.existsSync(headersPath)).toBe(true);
  });

  it('should define long-term immutable caching for static assets', () => {
    const content = fs.readFileSync(headersPath, 'utf-8');
    expect(content).toContain('/_astro/*');
    expect(content).toContain('Cache-Control: public, max-age=31536000, immutable');
  });

  it('should define discovery Link headers on root path', () => {
    const content = fs.readFileSync(headersPath, 'utf-8');
    expect(content).toContain('rel="api-catalog"');
    expect(content).toContain('rel="agent-skills"');
    expect(content).toContain('rel="describedby"');
  });
});
