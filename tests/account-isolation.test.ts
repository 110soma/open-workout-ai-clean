import { afterEach, describe, expect, it, vi } from 'vitest';
import { assertAccountOwner, openAccountDatabase, type WorkoutDatabase } from '../src/db';
import { createDemoWorkout, loadOrCreateTodayWorkout, loadPrescriptionBundle } from '../src/liveWorkout';
import { syncPendingWorkouts } from '../src/sync/syncEngine';

const databases: WorkoutDatabase[] = [];
afterEach(async () => {
  vi.unstubAllGlobals();
  await Promise.all(databases.splice(0).map(database => database.delete()));
});
async function open(user: string, project: string) {
  const database = await openAccountDatabase(user, project); databases.push(database); return database;
}

describe('account-bound local storage', () => {
  it('hides A active/history/menu records from B and restores A after reopening', async () => {
    const project = `https://fixture-${crypto.randomUUID()}.example.org`;
    const a = await open('fixture-user-a', project);
    const workout = { ...createDemoWorkout(), status: 'active' as const };
    await a.liveWorkouts.put(workout);
    await a.meta.put({ key: 'private-fixture-marker', value: 'A-only' });
    a.close();
    const b = await open('fixture-user-b', project);
    expect(await b.liveWorkouts.count()).toBe(0);
    expect(await b.meta.get('private-fixture-marker')).toBeUndefined();
    expect(await loadOrCreateTodayWorkout(b)).toBeNull();
    b.close();
    const restored = await open('fixture-user-a', project);
    expect(await loadOrCreateTodayWorkout(restored)).toMatchObject({ workout_id: workout.workout_id, status: 'active' });
    expect((await restored.meta.get('authUserId'))?.value).toBe('fixture-user-a');
  });

  it('never uploads A pending records through B and keeps them for A', async () => {
    const project = `https://fixture-${crypto.randomUUID()}.example.org`;
    const a = await open('fixture-user-a', project);
    const workout = { ...createDemoWorkout(), status: 'completed_local' as const, dirty: true };
    await a.liveWorkouts.put(workout);
    const b = await open('fixture-user-b', project);
    const bGateway = { pushWorkout: vi.fn() };
    expect(await syncPendingWorkouts(bGateway, b, true)).toEqual([]);
    expect(bGateway.pushWorkout).not.toHaveBeenCalled();
    expect(() => assertAccountOwner(a, 'fixture-user-b')).toThrow('local_account_owner_mismatch');
    const aGateway = { pushWorkout: vi.fn().mockResolvedValue({ server_updated_at: '2030-01-01T00:00:00Z' }) };
    await syncPendingWorkouts(aGateway, a, true);
    expect(aGateway.pushWorkout).toHaveBeenCalledOnce();
    expect(await a.liveWorkouts.get(workout.workout_id)).toMatchObject({ status: 'committed' });
  });

  it('isolates projects and refuses a tampered local owner marker', async () => {
    const a = await open('fixture-user-a', `https://fixture-${crypto.randomUUID()}.example.org`);
    const other = await open('fixture-user-a', `https://fixture-${crypto.randomUUID()}.example.org`);
    expect(a.name).not.toBe(other.name);
    await a.meta.put({ key: 'authUserId', value: 'fixture-user-b' });
    const project = (await a.meta.get('authProject'))!.value;
    await expect(openAccountDatabase('fixture-user-a', project)).rejects.toThrow('local_account_owner_mismatch');
  });

  it('opens an empty connected database without requesting any private seed file', async () => {
    const fetch = vi.fn(() => { throw new Error('unexpected_network'); });
    vi.stubGlobal('fetch', fetch);
    const database = await open('fixture-user-a', `https://fixture-${crypto.randomUUID()}.example.org`);
    expect(await loadPrescriptionBundle(database)).toBeNull();
    expect(await loadOrCreateTodayWorkout(database)).toBeNull();
    expect(await database.sessions.count()).toBe(0);
    expect(fetch).not.toHaveBeenCalled();
  });
});
