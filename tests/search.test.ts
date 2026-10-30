import { describe, it, expect } from 'vitest';
import { escapeRegExp, highlightText, calculateScore } from '../src/scripts/search';

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
    const item = {
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
