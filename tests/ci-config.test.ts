import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('public CI configuration', () => {
  it('uses the supported Node version and the same verification command as local setup', () => {
    const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
    expect(workflow).toContain('node-version: 22');
    expect(workflow).toContain('npm ci');
    expect(workflow).toContain('playwright install --with-deps chromium');
    expect(workflow).toContain('npm run verify');
    expect(packageJson.scripts.verify).toContain('npm test');
    expect(packageJson.scripts.verify).toContain('npm run build');
    expect(packageJson.scripts.verify).toContain('npm run test:e2e');
    expect(packageJson.scripts.verify).toContain('npm run audit:public');
  });
});
