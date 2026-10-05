import { execFileSync } from 'node:child_process';

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

function git(args, encoding = 'utf8') {
  return execFileSync('git', args, { encoding, stdio: ['ignore', 'pipe', 'ignore'] });
}

let commits;
try {
  commits = git(['rev-list', '--all']).trim().split(/\r?\n/).filter(Boolean);
} catch {
  console.log(JSON.stringify({ status: 'NO_GIT_HISTORY', secrets_printed: 0 }));
  process.exit(0);
}

const findings = [];
let scannedFiles = 0;
for (const commit of commits) {
  const files = git(['ls-tree', '-r', '--name-only', commit]).split(/\r?\n/).filter(Boolean);
  for (const file of files) {
    if (forbiddenPaths.some(rule => rule.test(file))) findings.push(`${commit.slice(0, 8)}:${file}: forbidden path`);
    if (/\.(png|jpg|jpeg|gif|ico|zip|lock)$/i.test(file) || /package-lock\.json$/i.test(file)) continue;
    let content;
    try {
      const buffer = git(['show', `${commit}:${file}`], null);
      if (!Buffer.isBuffer(buffer) || buffer.length > 1_000_000 || buffer.includes(0)) continue;
      content = buffer.toString('utf8');
    } catch {
      continue;
    }
    scannedFiles += 1;
    for (const [name, rule] of contentRules) if (rule.test(content)) findings.push(`${commit.slice(0, 8)}:${file}: ${name}`);
  }
}

if (findings.length) {
  console.error(JSON.stringify({ status: 'GIT_HISTORY_AUDIT_FAILED', findings, secrets_printed: 0 }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ status: 'GIT_HISTORY_AUDIT_OK', commits: commits.length, scanned_files: scannedFiles, secrets_printed: 0 }));
