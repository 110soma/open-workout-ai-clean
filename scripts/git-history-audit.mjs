import { execFileSync } from 'node:child_process';
import { contentFindings, forbiddenPath } from './audit-rules.mjs';
function git(args, input) {
  return execFileSync('git', args, { input, maxBuffer: 128 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] });
}
try {
  if (git(['rev-parse', '--is-shallow-repository']).toString().trim() === 'true') throw new Error('full_history_required');
  const commits = git(['rev-list', '--all']).toString().trim().split('\n').filter(Boolean);
  if (!commits.length) throw new Error('git_history_required');
  const objects = git(['rev-list', '--objects', '--all']).toString().trim().split('\n');
  const paths = new Map(objects.map(entry => {
    const i = entry.indexOf(' '); return i < 0 ? [entry, ''] : [entry.slice(0, i), entry.slice(i + 1)];
  }));
  const batch = git(['cat-file', '--batch'], [...paths.keys()].join('\n') + '\n');
  const findings = [];
  for (const commit of commits) {
    for (const path of git(['ls-tree', '-r', '--name-only', commit]).toString().split('\n').filter(Boolean)) {
      if (forbiddenPath(path)) findings.push({ object: commit.slice(0, 12), path, category: 'forbidden historical path' });
    }
  }
  let offset = 0, scanned = 0;
  while (offset < batch.length) {
    const end = batch.indexOf(10, offset);
    const [oid, type, size] = batch.subarray(offset, end).toString().split(' ');
    if (!Number.isFinite(Number(size))) throw new Error('git_object_unreadable');
    const body = batch.subarray(end + 1, end + 1 + Number(size));
    offset = end + 2 + Number(size);
    if (type !== 'blob' && type !== 'commit') continue;
    const path = type === 'commit' ? '(commit metadata)' : paths.get(oid);
    if (type === 'blob' && forbiddenPath(path)) findings.push({ object: oid.slice(0, 12), path, category: 'forbidden path' });
    for (const category of contentFindings(body, path)) findings.push({ object: oid.slice(0, 12), path, category });
    scanned++;
  }
  console.log(JSON.stringify({ status: findings.length ? 'GIT_HISTORY_AUDIT_FAILED' : 'GIT_HISTORY_AUDIT_OK', commits: commits.length, scanned_objects: scanned, findings, secrets_printed: 0 }));
  if (findings.length) process.exitCode = 1;
} catch {
  console.error(JSON.stringify({ status: 'GIT_HISTORY_AUDIT_FAILED', reason: 'full_readable_git_history_required', secrets_printed: 0 }));
  process.exitCode = 1;
}
