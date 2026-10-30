import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Project Configuration Files', () => {
  it('should validate package.json structure', () => {
    const pkgPath = path.resolve('package.json');
    expect(fs.existsSync(pkgPath)).toBe(true);

    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    expect(pkg.name).toBeDefined();
    expect(pkg.scripts).toBeDefined();
    expect(pkg.scripts.build).toBe('astro build');
    expect(pkg.scripts.check).toBeDefined();
    expect(pkg.scripts.lint).toBe('eslint .');
    expect(pkg.scripts.typecheck).toBe('astro sync && tsc --noEmit');
    expect(pkg.scripts.test).toBe('vitest run');
  });

  it('should validate wrangler.json structure', () => {
    const wranglerPath = path.resolve('wrangler.json');
    expect(fs.existsSync(wranglerPath)).toBe(true);

    const wrangler = JSON.parse(fs.readFileSync(wranglerPath, 'utf-8'));
    expect(wrangler.name).toBe('website');
    expect(wrangler.compatibility_date).toBeDefined();
    expect(wrangler.assets).toBeDefined();
  });

  it('should validate tsconfig.json', () => {
    const tsconfigPath = path.resolve('tsconfig.json');
    expect(fs.existsSync(tsconfigPath)).toBe(true);

    const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf-8'));
    expect(tsconfig.extends).toBe('astro/tsconfigs/strict');
  });

  it('should validate astro.config.mjs exists', () => {
    const astroConfigPath = path.resolve('astro.config.mjs');
    expect(fs.existsSync(astroConfigPath)).toBe(true);
  });
});
