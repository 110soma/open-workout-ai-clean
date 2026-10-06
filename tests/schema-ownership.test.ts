import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { expect, it } from 'vitest';

it('rejects cross-owner set INSERT and UPDATE under the authenticated role', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create schema auth;
      create table auth.users (id uuid primary key);
      create role anon; create role authenticated; create role service_role;
      create function auth.uid() returns uuid language sql as $$
        select current_setting('request.jwt.claim.sub', true)::uuid
      $$;
      grant usage on schema auth to authenticated;
    `);
    for (const name of ['0001_initial_schema.sql', '0005_set_session_owner.sql']) {
      await db.exec(readFileSync(new URL('../supabase/migrations/' + name, import.meta.url), 'utf8'));
    }
    const a = '00000000-0000-4000-8000-000000000001';
    const b = '00000000-0000-4000-8000-000000000002';
    await db.exec(`
      insert into auth.users values ('${a}'), ('${b}');
      insert into workout_sessions
        (session_id,user_id,session_date,status,workout_payload,sync_status,local_updated_at)
      values ('fixture-a','${a}','2000-01-01','active','{}','pending',now()),
             ('fixture-b','${b}','2000-01-01','active','{}','pending',now());
      set role authenticated;
      set request.jwt.claim.sub='${b}';
    `);
    const insert = (id: string, parent: string) => db.exec(`
      insert into workout_sets (set_id,user_id,session_id,exercise_id,set_no,local_updated_at)
      values ('${id}','${b}','${parent}','FIXTURE',1,now());
    `);
    await expect(insert('fixture-cross-owner', 'fixture-a')).rejects.toMatchObject({ code: '23503' });
    await insert('fixture-own-set', 'fixture-b');
    await expect(db.exec("update workout_sets set session_id='fixture-a' where set_id='fixture-own-set'"))
      .rejects.toMatchObject({ code: '23503' });
    const result = await db.query('select session_id from workout_sets');
    expect(result.rows).toEqual([{ session_id: 'fixture-b' }]);
  } finally {
    await db.close();
  }
});
