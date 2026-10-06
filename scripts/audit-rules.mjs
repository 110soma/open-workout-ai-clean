// Findings expose categories/paths only, never matched values.
export const forbiddenPaths = [
  /(^|[\\/])\.(?:phase4-private|vercel)([\\/]|$)/i,
  /(^|[\\/])\.env(?:$|\.)/i,
  /(?:history|prescription)-v1\.json$/i,
  /public[\\/]images[\\/]exercise[\\/](?:bench-press|dumbbell-row|workout-target)\.png$/i,
  /(?:service-account|credentials)[^\\/]*\.json$/i
];
export function forbiddenPath(path) {
  if (/(^|[\\/])\.env\.(?:example|server\.example)$/.test(path)) return false;
  return forbiddenPaths.some(rule => rule.test(path));
}
const rules = [
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['secret token', /\b(?:sb_secret_|gh[pousr]_|github_pat_|vercel_|vcp_)[A-Za-z0-9_-]{16,}/],
  ['AWS access key', /\bAKIA[A-Z0-9]{16}\b/],
  ['JWT-like token', /\beyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/],
  ['personal path', /[A-Za-z]:[\\/]Users[\\/](?!YOUR_NAME[\\/]|<)[^\\/\r\n]+[\\/]/i],
  ['hard-coded Supabase project', /https:\/\/(?!example\.)[a-z0-9]{12,}\.supabase\.co/i],
  ['real-format prescription identifier', /(?<![A-Za-z0-9_-])20\d{6}_\d{2}(?![A-Za-z0-9_-])/],
  ['private workout identifier', /\b(?:manual-20\d{2}-\d{2}-\d{2}-[A-Za-z]+-\d+|local-rx-20\d{2}-\d{2}-\d{2}-\d{8}_\d+)/],
  ['dated workout UUID', /\bsession-20\d{2}-\d{2}-\d{2}-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i],
  ['hard-coded spreadsheet identifier', /(?:spreadsheetId|SPREADSHEET_ID)\s*[:=]\s*["'][A-Za-z0-9_-]{25,}["']/],
  ['credential in URL', /https?:\/\/[^\s/@:]+:[^\s/@]+@/]
];
const email = /\b[A-Z0-9._%+-]+@(?!example\.(?:com|org)\b|users\.noreply\.github\.com\b|github\.com\b)[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
export function contentFindings(buffer, path = '') {
  const text = buffer instanceof Uint8Array
    ? Buffer.from(buffer).toString(buffer[0] === 255 && buffer[1] === 254 ? 'utf16le' : 'utf8') : String(buffer);
  const result = rules.filter(([, rule]) => rule.test(text)).map(([name]) => name);
  // Lockfile dependency attribution is not personal application data, but keys
  // and identifiers are still scanned in the entire lockfile.
  if (path !== 'package-lock.json' && email.test(text)) result.push('personal email address');
  return result;
}
