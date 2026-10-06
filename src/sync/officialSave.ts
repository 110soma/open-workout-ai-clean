import { assertAccountOwner, db } from '../db';
import { supabase } from './supabaseClient';

export async function requestOfficialSave(workoutId: string): Promise<void> {
  if (import.meta.env.VITE_AUTO_FINALIZE !== 'true' || !supabase) return;
  const workout = await db.liveWorkouts.get(workoutId);
  if (!workout || workout.status !== 'committed' || workout.dirty || workout.sync_status !== 'synced' || !workout.submission?.user_submit || workout.official_save_status === 'saved') return;
  let status: 'saved' | 'review_required' = 'review_required';
  try {
    const {data} = await supabase.auth.getSession();
    if (!data.session) throw new Error('not_authenticated');
    assertAccountOwner(db, data.session.user.id);
    const response = await fetch('/api/workout-finalize', {method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${data.session.access_token}`},body:JSON.stringify({session_id:workoutId}),signal:AbortSignal.timeout(65000)});
    const result = await response.json();
    if (response.ok && result.session_id === workoutId && result.status === 'official_saved' && result.commit_match_status === 'match') status = 'saved';
  } catch { /* Cloud data and local actuals stay intact. */ }
  await db.transaction('rw',db.liveWorkouts,async()=>{
    const current=await db.liveWorkouts.get(workoutId);
    if(current?.updated_at===workout.updated_at&&current?.local_updated_at===workout.local_updated_at&&current?.official_save_status!=='saved') {
      await db.liveWorkouts.update(workoutId, {official_save_status:status});
    }
  });
}
