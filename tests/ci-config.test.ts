import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('public CI configuration', () => {
  it('uses the supported Node version and all local verification checks', () => {
    const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
    expect(workflow).toContain('node-version: 22');
    expect(workflow).toContain('npm ci');
    expect(workflow).toContain('playwright install --with-deps chromium');
    for (const command of ['npm test', 'npm run build', 'npm run test:e2e', 'npm run audit:public']) {
      expect(workflow).toContain(command);
    }
    expect(workflow).toContain('node scripts/git-history-audit.mjs');
    expect(packageJson.scripts['audit:history']).toBe('node scripts/git-history-audit.mjs');
    expect(packageJson.scripts.verify).toContain('npm run audit:history');
    expect(packageJson.scripts.verify).toContain('npm test');
    expect(packageJson.scripts.verify).toContain('npm run build');
    expect(packageJson.scripts.verify).toContain('npm run test:e2e');
    expect(packageJson.scripts.verify).toContain('npm run audit:public');
  });
});
