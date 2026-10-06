import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Generates SQL only. No credentials, network requests or database writes.
export function examplePrescriptionRow(userId, date) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId ?? '')) throw new Error('A valid auth user UUID is required.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '') || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) throw new Error('Use a valid YYYY-MM-DD date.');
  const payload = JSON.parse(readFileSync(new URL('../examples/prescription.example.json', import.meta.url), 'utf8'));
  const id = `example-${date.replaceAll('-', '')}-${userId}`;
  const timestamp = `${date}T00:00:00.000Z`;
  payload.targetSessionId = id;
  payload.latestPrescriptionDate = date;
  payload.source.exportedAt = timestamp;
  payload.prescriptions = payload.prescriptions.map((row, index) => ({ ...row,
    prescription_id: `${id}-row-${index + 1}`, target_session_id: id, created_at: timestamp
  }));
  return { prescription_id: id, user_id: userId, target_session_id: id,
    prescription_date: date, source_revision: payload.dataRevision, payload, local_updated_at: timestamp };
}
export function examplePrescriptionSql(row) {
  const literal = value => `'${String(value).replaceAll("'", "''")}'`;
  return `-- Fictional example plan only; no workout actuals are created.
insert into public.prescriptions
  (prescription_id,user_id,target_session_id,prescription_date,source_revision,payload,local_updated_at)
values (${literal(row.prescription_id)},${literal(row.user_id)}::uuid,${literal(row.target_session_id)},${literal(row.prescription_date)}::date,${literal(row.source_revision)},${literal(JSON.stringify(row.payload))}::jsonb,${literal(row.local_updated_at)}::timestamptz)
on conflict (prescription_id) do update set
  payload=excluded.payload, source_revision=excluded.source_revision, local_updated_at=excluded.local_updated_at
where prescriptions.user_id=excluded.user_id
returning prescription_id;
`;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const options = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, values) => {
      if (index % 2 === 0) pairs.push([value, values[index + 1]]);
      return pairs;
    }, []));
    console.log(examplePrescriptionSql(examplePrescriptionRow(options['--user-id'], options['--date'])));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
