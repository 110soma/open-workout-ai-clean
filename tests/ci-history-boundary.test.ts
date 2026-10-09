import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, test } from 'vitest';

test('CI tests the merge tree but audits actual head with full history', () => {
  const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');
  expect(workflow).toContain('npm test && npm run build && npm run test:e2e && npm run audit:public');
  expect(workflow).toContain('github.event.pull_request.head.sha || github.sha');
  expect(workflow).toContain('working-directory: publishable-history');
  expect(workflow).toContain('run: node scripts/git-history-audit.mjs');
  expect(workflow.match(/fetch-depth: 0/g)).toHaveLength(2);
});

test('history audit still rejects personal metadata and secrets in an older commit', () => {
  const directory = mkdtempSync(join(tmpdir(), 'workout-history-fixture-'));
  const git = (...args: string[]) => execFileSync('git', args, { cwd: directory, stdio: 'pipe' });
  const audit = () => execFileSync(process.execPath, [resolve('scripts/git-history-audit.mjs')], { cwd: directory, stdio: 'pipe' }).toString();
  try {
    git('init');
    git('config', 'user.name', 'Synthetic fixture');
    git('config', 'user.email', 'fixture@example.org');
    writeFileSync(join(directory, 'example.txt'), 'Synthetic safe fixture');
    git('add', '.'); git('commit', '-m', 'safe fixture');
    expect(audit()).toContain('GIT_HISTORY_AUDIT_OK');
    git('config', 'user.email', ['synthetic-person', 'invalid.test'].join('@'));
    git('commit', '--allow-empty', '-m', 'synthetic unsafe identity');
    expect(audit).toThrow();
    git('config', 'user.email', 'fixture@example.org');
    writeFileSync(join(directory, 'example.txt'), ['sb', 'secret', 'x'.repeat(20)].join('_'));
    git('add', '.'); git('commit', '-m', 'synthetic unsafe token');
    writeFileSync(join(directory, 'example.txt'), 'Safe current file');
    git('add', '.'); git('commit', '-m', 'remove fixture token from current file');
    try { audit(); throw new Error('audit must fail'); }
    catch (error) {
      const output = (error as { stdout?: Buffer }).stdout?.toString() ?? '';
      expect(output).toContain('personal email address');
      expect(output).toContain('secret token');
      expect(output).not.toContain('invalid.test');
    }
  } finally {
    // Only the unique temporary fixture directory created above is removed.
    rmSync(directory, { recursive: true, force: true });
  }
});
