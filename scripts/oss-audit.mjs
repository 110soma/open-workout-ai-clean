import { readdir, readFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/, (m) => m.slice(1)));
const skipped = new Set(['node_modules', 'dist', '.git', 'test-results', 'playwright-report']);
const forbiddenPaths = [/.phase4-private/i, /(^|[\\/])\.env\.local$/i, /(^|[\\/])\.vercel([\\/]|$)/i, /history-v1\.json$/i];
const contentRules = [
  ['private key', /-----BEGIN (?:RSA )?PRIVATE KEY-----/],
  ['Supabase secret', /\bsb_secret_[A-Za-z0-9_-]+/],
  ['JWT-like token', /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/],
  ['Vercel token', /\b(?:vercel_|vcp_)[A-Za-z0-9_-]{16,}/i],
  ['personal Windows path', /[A-Za-z]:\\Users\\(?!YOUR_NAME\\)[^\\\r\n]+\\/i],
  ['email address', /\b[A-Z0-9._%+-]+@(?!example\.(?:com|org)\b)[A-Z0-9.-]+\.[A-Z]{2,}\b/i],
  ['hard-coded Supabase project', /https:\/\/[a-z0-9]{12,}\.supabase\.co/i]
];

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && skipped.has(entry.name)) continue;
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(full));
    else out.push(full);
  }
  return out;
}

const findings = [];
for (const file of await walk(root)) {
  const rel = relative(root, file);
  if (forbiddenPaths.some((rule) => rule.test(rel))) findings.push(`${rel}: forbidden path`);
  if (/\.(png|jpg|jpeg|gif|ico|zip|lock)$/i.test(file) || /package-lock\.json$/i.test(file)) continue;
  const text = await readFile(file, 'utf8');
  for (const [name, rule] of contentRules) if (rule.test(text)) findings.push(`${rel}: ${name}`);
}
if (findings.length) {
  console.error(JSON.stringify({ status: 'PUBLIC_AUDIT_FAILED', findings }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ status: 'PUBLIC_AUDIT_OK', scanned_files: (await walk(root)).length, secrets_printed: 0 }));
