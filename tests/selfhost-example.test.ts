import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { expect, it } from 'vitest';
import { examplePrescriptionRow, examplePrescriptionSql } from '../scripts/example-prescription-sql.mjs';
import { adaptPrescriptionBundle } from '../src/prescriptionAdapter';
import { activatePlannedWorkout } from '../src/liveWorkout';

it('installs every migration and imports a readable example plan without fake actuals', async () => {
  const database = new PGlite();
  try {
    await database.exec(`create schema auth; create table auth.users(id uuid primary key);
      create role anon; create role authenticated; create role service_role;
      create function auth.uid() returns uuid language sql as $$
        select current_setting('request.jwt.claim.sub',true)::uuid
      $$; grant usage on schema auth to authenticated;`);
    for (const name of ['0001_initial_schema.sql', '0002_prescription_import_grant.sql', '0003_workout_record_mode.sql', '0004_official_commit_gate.sql', '0005_set_session_owner.sql']) {
      await database.exec(readFileSync(new URL('../supabase/migrations/' + name, import.meta.url), 'utf8'));
    }
    const user = '00000000-0000-4000-8000-000000000001';
    await database.exec(`insert into auth.users values ('${user}')`);
    const row = examplePrescriptionRow(user, '2030-01-15');
    await database.exec(examplePrescriptionSql(row));
    await database.exec(examplePrescriptionSql(row));
    await database.exec(`set role authenticated; set request.jwt.claim.sub='${user}'`);
    const result = await database.query<{ payload: any }>('select payload from prescriptions');
    expect(result.rows).toHaveLength(1);
    const planned = adaptPrescriptionBundle(result.rows[0].payload, '2030-01-15');
    expect(planned.status).toBe('planned');
    expect(planned.exercises).toHaveLength(2);
    const active = activatePlannedWorkout(planned);
    expect(active.status).toBe('active');
    expect(active.workout_id).not.toBe(planned.workout_id);
    expect(active.exercises[0].sets[0].actual_rir).toBeNull();
    expect((await database.query('select * from workout_sessions')).rows).toEqual([]);
    expect((await database.query('select * from workout_sets')).rows).toEqual([]);
    await database.exec(`set request.jwt.claim.sub='00000000-0000-4000-8000-000000000002'`);
    expect((await database.query('select * from prescriptions')).rows).toEqual([]);
  } finally { await database.close(); }
});

it('rejects invalid example input rather than producing unsafe SQL', () => {
  expect(() => examplePrescriptionRow("invalid'input", '2030-01-15')).toThrow();
  expect(() => examplePrescriptionRow('00000000-0000-4000-8000-000000000001', '2030-02-30')).toThrow();
});
