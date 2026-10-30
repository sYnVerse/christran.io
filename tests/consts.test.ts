import { describe, it, expect } from 'vitest';
import { SITE_TITLE, SITE_DESCRIPTION } from '../src/consts';

describe('Site Constants', () => {
  it('should have a non-empty SITE_TITLE with author name', () => {
    expect(SITE_TITLE).toBeDefined();
    expect(typeof SITE_TITLE).toBe('string');
    expect(SITE_TITLE.length).toBeGreaterThan(0);
    expect(SITE_TITLE).toContain('Chris Tran');
  });

  it('should have a non-empty SITE_DESCRIPTION', () => {
    expect(SITE_DESCRIPTION).toBeDefined();
    expect(typeof SITE_DESCRIPTION).toBe('string');
    expect(SITE_DESCRIPTION.length).toBeGreaterThan(10);
  });
});
