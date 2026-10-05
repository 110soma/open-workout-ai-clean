import { describe, expect, it, vi } from 'vitest';
import { autoFinalize } from '../server/auto-finalize.mjs';
import { buildCommitPlan } from '../scripts/phase4/commit-planner.mjs';

function fixture() {
  const id='fixture-production-session';
  const session={session_id:id,user_id:'owner',session_date:'2026-10-05',bodypart:'背中',status:'committed',record_mode:'production',started_at:null,completed_at:null,workout_payload:{submission:{entry_source:'structured_web_ui',user_submit:true},exercises:[{exercise_id:'ROW',order:1,exercise_name:'ロウ',sets:[{set_id:'fixture-set'}]}]}};
  const sets=[{session_id:id,user_id:'owner',set_id:'fixture-set',exercise_id:'ROW',set_no:1,side:'R',completed:true,actual_weight_kg:20,actual_reps:10,actual_rir:null}];
  const context={exerciseIds:new Set(['ROW']),exerciseNames:new Map([['ROW','ロウ']]),historySessions:[],historySets:[],sessionDates:new Map(),stagingRows:[],variantKeys:new Set()};
  let staged:any[]=[]; let plan:any; let receipt:any=null;
  const sheets={
    withSessionLock:vi.fn(async (_id:any,run:any)=>run()),
    getVerifiedReceipt:vi.fn(async()=>receipt),verifyReceiptReadback:vi.fn(async()=>{}),
    readValidationContext:vi.fn(async()=>context),
    stageValidated:vi.fn(async (adapter:any)=>{staged=adapter.rows.map((x:any)=>x.row); plan=buildCommitPlan(adapter,{sourceSession:session,sourceSets:sets,historySessions:[],historySets:[]});}),
    inspect:vi.fn(async()=>({record_mode:'production',staging:staged,sessions:[],sets:[],duplicate_status:'unique',freshPlan:plan})),
    commitAtomic:vi.fn(async()=>{}),
    readback:vi.fn(async()=>({sessions:[plan.session],sets:plan.sets})),
    markStagingCommitted:vi.fn(async()=>{staged=staged.map(r=>({...r,import_status:'committed',commit_match_status:'match'}));}),
    readStaging:vi.fn(async()=>staged),audit:vi.fn(async()=>{}),
    storeVerifiedReceipt:vi.fn(async()=>{receipt={session_id:id};})
  };
  const cloud={readWorkout:vi.fn(async()=>({session,sets}))};
  const run=()=>autoFinalize({userId:'owner',sessionId:id,cloud,sheets,enabled:true});
  return {session,sets,context,sheets,cloud,run};
}
describe('automatic official save (isolated fixture; zero external writes)',()=>{
  it('commits only after validation and confirms readback',async()=>{
    const f=fixture(); expect(await f.run()).toMatchObject({status:'official_saved',commit_match_status:'match'});
    expect(f.sheets.commitAtomic).toHaveBeenCalledOnce(); expect(f.sheets.audit).toHaveBeenCalledOnce();
  });
  it('stops duplicate immediately before commit',async()=>{
    const f=fixture(); f.sheets.inspect.mockImplementation(async()=>({duplicate_status:'duplicate',record_mode:'production',staging:[]}));
    expect(await f.run()).toMatchObject({status:'review_required'}); expect(f.sheets.commitAtomic).not.toHaveBeenCalled();
  });
  it('stops validation failure',async()=>{
    const f=fixture(); f.context.exerciseIds.clear(); expect(await f.run()).toMatchObject({status:'review_required'});
    expect(f.sheets.commitAtomic).not.toHaveBeenCalled();
  });
  it('preserves cloud actuals if Sheets write fails',async()=>{
    const f=fixture(); const original=JSON.stringify({session:f.session,sets:f.sets});
    f.sheets.commitAtomic.mockRejectedValue(new Error('Sheets failure'));
    expect(await f.run()).toMatchObject({status:'review_required'});
    expect(JSON.stringify({session:f.session,sets:f.sets})).toBe(original); expect(f.sheets.audit).not.toHaveBeenCalled();
  });
  it('does not mark saved if readback differs',async()=>{
    const f=fixture(); f.sheets.readback.mockResolvedValue({sessions:[],sets:[]});
    expect(await f.run()).toMatchObject({status:'review_required'}); expect(f.sheets.storeVerifiedReceipt).not.toHaveBeenCalled();
  });
  it('rechecks the receipt and does not write on retry',async()=>{
    const f=fixture(); await f.run(); expect(await f.run()).toMatchObject({status:'official_saved'});
    expect(f.sheets.commitAtomic).toHaveBeenCalledOnce(); expect(f.sheets.verifyReceiptReadback).toHaveBeenCalledOnce();
  });
  it('fails closed when feature disabled or gateway absent',async()=>{
    const f=fixture(); expect(await autoFinalize({userId:'owner',sessionId:f.session.session_id,cloud:f.cloud,sheets:null,enabled:false})).toMatchObject({status:'review_required'});
    expect(f.cloud.readWorkout).not.toHaveBeenCalled();
  });
  it('requires explicit submit, production mode and owner match',async()=>{
    const f=fixture(); f.session.workout_payload.submission.user_submit=false;
    expect(await f.run()).toMatchObject({status:'review_required'}); expect(f.sheets.commitAtomic).not.toHaveBeenCalled();
  });
});
