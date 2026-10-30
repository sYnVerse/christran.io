import { describe, it, expect } from 'vitest';

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightText(text: string, query: string): string {
  if (!query) return text;
  const escapedQuery = escapeRegExp(query);
  const regex = new RegExp(`(${escapedQuery})`, 'gi');
  return text.replace(regex, '<mark class="search-highlight">$1</mark>');
}

interface SearchItem {
  title: string;
  description: string;
  body?: string;
  tags?: string[];
}

function calculateScore(item: SearchItem, query: string): number {
  const cleanQuery = query.trim().toLowerCase();
  if (!cleanQuery) return 0;

  let score = 0;
  const titleIdx = item.title.toLowerCase().indexOf(cleanQuery);
  const descIdx = item.description.toLowerCase().indexOf(cleanQuery);
  const bodyIdx = item.body ? item.body.toLowerCase().indexOf(cleanQuery) : -1;
  const matchedTags = item.tags ? item.tags.filter((t) => t.toLowerCase().includes(cleanQuery)).length : 0;

  if (titleIdx === 0) score += 100;
  else if (titleIdx > 0) score += 80;
  if (descIdx !== -1) score += 40;
  if (matchedTags > 0) score += 30 * matchedTags;
  if (bodyIdx !== -1) score += 10;

  return score;
}

describe('Search Algorithms and Utilities', () => {
  describe('escapeRegExp', () => {
    it('should escape special regex characters', () => {
      expect(escapeRegExp('hello.world?*+')).toBe('hello\\.world\\?\\*\\+');
      expect(escapeRegExp('[test](url)')).toBe('\\[test\\]\\(url\\)');
      expect(escapeRegExp('normal text')).toBe('normal text');
    });
  });

  describe('highlightText', () => {
    it('should wrap matching queries with mark tags', () => {
      const result = highlightText('Formula 1 telemetry data', 'telemetry');
      expect(result).toBe('Formula 1 <mark class="search-highlight">telemetry</mark> data');
    });

    it('should be case-insensitive while preserving original casing', () => {
      const result = highlightText('Next-gen AI Architectures', 'ai');
      expect(result).toBe('Next-gen <mark class="search-highlight">AI</mark> Architectures');
    });

    it('should return original text if query is empty', () => {
      expect(highlightText('Original text', '')).toBe('Original text');
    });
  });

  describe('calculateScore', () => {
    const item: SearchItem = {
      title: 'Graphify Codebase Knowledge Graph',
      description: 'Unified architecture mapping for AI agents',
      body: 'Detailed technical guide on AST extraction',
      tags: ['Graphify', 'AI', 'Architecture'],
    };

    it('gives highest score for prefix title match', () => {
      const score = calculateScore(item, 'Graphify');
      // prefix title (+100) + tag match (+30)
      expect(score).toBeGreaterThanOrEqual(130);
    });

    it('gives points for description match', () => {
      const score = calculateScore(item, 'mapping');
      expect(score).toBe(40);
    });

    it('gives points for body match', () => {
      const score = calculateScore(item, 'AST');
      expect(score).toBe(10);
    });

    it('returns 0 when no query matches', () => {
      const score = calculateScore(item, 'unrelated keyword');
      expect(score).toBe(0);
    });
  });
});
