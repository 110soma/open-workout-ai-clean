import { expect, it } from 'vitest';
import { contentFindings, forbiddenPath } from '../scripts/audit-rules.mjs';

it('detects private values without printing them, including UTF-16 and commit metadata', () => {
  const address = ['person', 'personal.invalid'].join('@');
  expect(contentFindings(`author Example Person <${address}>`)).toContain('personal email address');
  expect(contentFindings(Buffer.from('\ufeff' + address, 'utf16le'))).toContain('personal email address');
  const identifier = ['20', '990101', '_01'].join('');
  expect(contentFindings(identifier)).toContain('real-format prescription identifier');
  const token = ['sb', 'secret', 'x'.repeat(32)].join('_');
  expect(contentFindings(token, 'package-lock.json')).toContain('secret token');
  expect(contentFindings('maintainers@example.org')).toEqual([]);
});

it('rejects private paths and removed assets but accepts empty environment examples', () => {
  expect(forbiddenPath('.env.local')).toBe(true);
  expect(forbiddenPath('.env')).toBe(true);
  expect(forbiddenPath('.env.example')).toBe(false);
  expect(forbiddenPath('.env.server.example')).toBe(false);
  expect(forbiddenPath('public/images/exercise/bench-press.png')).toBe(true);
  expect(forbiddenPath('public/images/exercise/placeholder.svg')).toBe(false);
});
