import { readdir, readFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { contentFindings, forbiddenPath } from './audit-rules.mjs';
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const skipped = new Set(['node_modules', 'dist', 'dev-dist', '.git', 'test-results', 'playwright-report', 'coverage', '.npm-cache']);
async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && skipped.has(entry.name)) continue;
    const full = resolve(dir, entry.name);
    if (entry.isSymbolicLink()) throw new Error('audit_symlink_requires_review');
    if (entry.isDirectory()) out.push(...await walk(full)); else out.push(full);
  }
  return out;
}
const findings = [];
const files = await walk(root);
for (const file of files) {
  const path = relative(root, file).replaceAll('\\', '/');
  if (forbiddenPath(path)) findings.push({ path, category: 'forbidden path' });
  for (const category of contentFindings(await readFile(file), path)) findings.push({ path, category });
}
console.log(JSON.stringify({ status: findings.length ? 'PUBLIC_AUDIT_FAILED' : 'PUBLIC_AUDIT_OK', scanned_files: files.length, findings, secrets_printed: 0 }));
if (findings.length) process.exitCode = 1;
