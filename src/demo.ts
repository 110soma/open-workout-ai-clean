import { db } from './db';
import { createDemoWorkout } from './liveWorkout';
import { isDemoMode } from './runtimeMode';
import { dateKey } from './date';

export async function prepareDemo(reset = false): Promise<void> {
  if (!isDemoMode || db.name !== 'open-workout-ai-demo') throw new Error('デモ専用DB以外は操作できません。');
  if (!reset && await db.liveWorkouts.where('date').equals(dateKey(new Date())).count()) return;
  const workout = createDemoWorkout();
  const now = new Date().toISOString();
  workout.title = '操作確認デモ';
  workout.status = 'active';
  workout.started_at = now;
  workout.exercises[0].exercise_name = 'ベンチプレス（デモ）';
  workout.exercises[1].exercise_name = '片手ダンベルロー（デモ）';
  workout.exercises[0].rest_sec = 30;
  workout.exercises[1].rest_sec = 30;
  workout.exercises[0].sets[0] = { ...workout.exercises[0].sets[0], completed: true, completed_at: now, actual_weight_kg: 60, actual_reps: 8, actual_rir: 2 };
  workout.rest_started_at = now;
  workout.rest_end_at = new Date(Date.now() + 30000).toISOString();
  workout.last_completed_set_id = workout.exercises[0].sets[0].set_id;
  await db.transaction('rw', db.liveWorkouts, db.exercises, db.prescriptions, db.meta, async () => {
    if (reset) { await db.liveWorkouts.clear(); await db.prescriptions.clear(); await db.meta.clear(); }
    await db.liveWorkouts.put(workout);
    await db.exercises.bulkPut([
      {exercise_id:'BENCH_PRESS',exercise_name:'ベンチプレス（デモ）',equipment:'barbell',primary_bodypart:'胸',unilateral:false},
      {exercise_id:'ONE_ARM_DB_ROW',exercise_name:'片手ダンベルロー（デモ）',equipment:'dumbbell',primary_bodypart:'背中',unilateral:true},
      {exercise_id:'LATERAL_RAISE',exercise_name:'サイドレイズ（デモ）',equipment:'dumbbell',primary_bodypart:'肩',unilateral:false}
    ].map(e => ({...e, aliases:null,category:null,movement:null,enabled:true})));
    await db.prescriptions.put({prescription_id:'demo-menu',date:workout.date,revision:'demo-only',updated_at:now,bundle:{schemaVersion:1,dataRevision:'demo-only',source:{spreadsheetTitle:'架空デモ',spreadsheetId:'demo-only',exportedAt:now,mode:'read_only_snapshot',tabs:[]},latestPrescriptionDate:workout.date,targetSessionId:'demo-menu',prescriptions:[],exercises:[],guides:[],slotRoles:[]}});
    await db.meta.put({key:'prescriptionId',value:'demo-menu'});
  });
}
