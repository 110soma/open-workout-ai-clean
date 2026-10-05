import { isDeepStrictEqual } from 'node:util';
import { SESSION_HEADERS,SET_HEADERS,buildCommitPlan } from '../scripts/phase4/commit-planner.mjs';
import { STAGING_HEADERS,adaptWorkoutResult } from '../scripts/phase4/workout-result-adapter.mjs';
import { recordsMatch, blanks } from '../scripts/phase4/finalize-commit.mjs';
const LOG_HEADERS=['update_id','updated_at','version','patch_name','change_type','target','change','player_effect','verification','status'];
const date=value=>typeof value==='number'?new Date((value-25569)*86400000).toISOString().slice(0,10):typeof value==='string'?value.slice(0,10).replaceAll('/','-'):null;
export class SheetsGateway {
 constructor(google,journal,cloud,userId,sessionId) {Object.assign(this,{google,journal,cloud,userId,sessionId});}
 withSessionLock(_id,fn) {return this.journal.run(fn);}
 async load() {
  const data=await this.google.read();
  for(const [name,expected] of [['01_Sessions',SESSION_HEADERS],['02_Sets',SET_HEADERS],['15_AutoLogStaging',STAGING_HEADERS],['16_UpdateLog',LOG_HEADERS]]) {
   if(!isDeepStrictEqual(data[name]?.headers,expected)) throw new Error('sheet_schema_changed');
  }
  if(!data['03_Exercises'].headers.includes('exercise_id')||!data['17_TechniqueVariants'].headers.includes('variant_id')) throw new Error('master_schema_changed');
  this.data=data; return data;
 }
 async readValidationContext(id) {
  const d=await this.load(); const sessions=d['01_Sessions'].rows.map(r=>({...r,date:date(r.date)}));
  return {strictDuplicateKey:true,exerciseIds:new Set(d['03_Exercises'].rows.map(r=>r.exercise_id)),
   exerciseNames:new Map(d['03_Exercises'].rows.map(r=>[r.exercise_id,r.exercise_name])),
   historySessions:sessions,historySets:d['02_Sets'].rows,sessionDates:new Map(sessions.map(r=>[r.session_id,r.date])),
   stagingRows:d['15_AutoLogStaging'].rows.filter(r=>r.source_session_id!==id).map(r=>({...r,source_date:date(r.source_date)})),
   variantKeys:new Set(d['17_TechniqueVariants'].rows.map(r=>`${r.exercise_id}|${r.variant_id}|${r.variant_version}`))};
 }
 async getVerifiedReceipt() {return this.journal.state.status==='committed'?this.journal.state.plan:null;}
 async verifyReceiptReadback(plan) {
  const back=await this.readback(this.sessionId);
  if(!recordsMatch(back.sessions,[plan.session])||!recordsMatch(back.sets,plan.sets)) throw new Error('receipt_readback_mismatch');
  const rows=await this.readStaging(this.sessionId);
  if(rows.length!==plan.sets.length||!rows.every(r=>r.import_status==='committed'&&r.commit_match_status==='match')) throw new Error('staging_readback_mismatch');
  await this.audit({session_id:this.sessionId,token:plan.confirmation_token,set_count:plan.sets.length});
 }
 async storeVerifiedReceipt(_id,plan) {
  if(!isDeepStrictEqual(this.journal.state.plan,plan)) throw new Error('receipt_plan_changed');
  await this.journal.call('complete');
 }
 async preparePlan(plan) {await this.journal.call('plan',plan); this.plan=plan;}
 async recoverPlan() {
  if(!this.journal.state.write_started) return null;
  const plan=this.journal.state.plan; if(!plan) throw new Error('recovery_plan_missing');
  const back=await this.readback(this.sessionId);
  // Ambiguous/partial write: NEVER append again. Exact match can finish metadata.
  if(!recordsMatch(back.sessions,[plan.session])||!recordsMatch(back.sets,plan.sets)) throw new Error('ambiguous_write_review');
  await this.markStagingCommitted(this.sessionId,plan.confirmation_token);
  await this.verifyReceiptReadback(plan);
  await this.storeVerifiedReceipt(this.sessionId,plan); return plan;
 }
 async stageValidated(adapter) {
  await this.journal.call('check'); await this.load();
  const existing=this.data['15_AutoLogStaging'].rows.filter(r=>r.source_session_id===this.sessionId);
  const rows=adapter.rows.map(x=>x.row);
  if(new Set(existing.map(r=>r.source_set_id)).size!==existing.length||existing.some(r=>!rows.some(s=>s.source_set_id===r.source_set_id))) throw new Error('staging_conflict');
  const requests=[];
  for(const row of rows) {
   const old=existing.find(r=>r.source_set_id===row.source_set_id);
   if(old) {
    for(const k of ['matched_exercise_id','source_date','set_no','side','set_type','load_type','load_kg','reps','RIR','entry_source','user_submit','record_mode','technique_variant_id','technique_variant_version','variant_status']) {
     const a=k==='source_date'?date(old[k]):blanks(old[k]);
     if(!isDeepStrictEqual(a,blanks(row[k]))) throw new Error('staging_content_changed');
    }
    requests.push(this.google.update('15_AutoLogStaging',STAGING_HEADERS,{...row,_row:old._row,received_at:old.received_at}));
   } else requests.push(this.google.append('15_AutoLogStaging',STAGING_HEADERS,[row]));
  }
  await this.google.batch(requests);
 }
 async inspect(id,setIds) {
  const {session,sets}=await this.cloud.readWorkout(this.userId,id);
  const context=await this.readValidationContext(id);
  const adapter=adaptWorkoutResult({session:{...session,entry_source:'structured_web_ui',user_submit:session.workout_payload?.submission?.user_submit===true},sets},context);
  const freshPlan=buildCommitPlan(adapter,{sourceSession:session,sourceSets:sets,historySessions:context.historySessions,historySets:context.historySets});
  const back=this.currentRows(id,setIds);
  return {...back,staging:this.data['15_AutoLogStaging'].rows.filter(r=>r.source_session_id===id),
   record_mode:session.record_mode,duplicate_status:adapter.rows.every(x=>x.row.duplicate_status==='unique')?'unique':'duplicate',freshPlan};
 }
 currentRows(id,setIds=[]) {return {sessions:this.data['01_Sessions'].rows.filter(r=>r.session_id===id),
  sets:this.data['02_Sets'].rows.filter(r=>r.session_id===id||setIds.includes(r.set_id))};}
 async commitAtomic(plan) {
  // Durable irreversible boundary BEFORE Google call. A timeout cannot trigger reappend.
  await this.journal.call('write');
  await this.google.batch([this.google.append('01_Sessions',SESSION_HEADERS,[plan.session]),this.google.append('02_Sets',SET_HEADERS,plan.sets)]);
 }
 async readback(id) {await this.load();return this.currentRows(id,this.journal.state.plan?.sets.map(s=>s.set_id));}
 async readStaging(id) {await this.load();return this.data['15_AutoLogStaging'].rows.filter(r=>r.source_session_id===id);}
 async markStagingCommitted(id,token) {
  await this.journal.call('check'); const rows=await this.readStaging(id);
  const plan=this.journal.state.plan;
  if(!plan||plan.confirmation_token!==token||rows.length!==plan.sets.length) throw new Error('staging_missing');
  const back=this.currentRows(id,plan.sets.map(s=>s.set_id));
  if(!recordsMatch(back.sessions,[plan.session])||!recordsMatch(back.sets,plan.sets)) throw new Error('readback_mismatch');
  for(const r of rows) {
   const s=plan.sets.find(s=>s.set_id===r.source_set_id);
   if(!s||r.user_submit!==true||r.record_mode!=='production'||r.entry_source!=='structured_web_ui'||r.validation_status!=='ready'||r.master_id_status!=='valid'||r.duplicate_status!=='unique') throw new Error('staging_not_ready');
   for(const [a,b] of [['matched_exercise_id','exercise_id'],['load_type','load_type'],['load_kg','load_kg'],['reps','reps'],['RIR','RIR'],['side','side'],['set_no','set_no'],['set_type','set_type'],['technique_variant_id','technique_variant_id'],['technique_variant_version','technique_variant_version'],['variant_status','variant_status']]) {
    if(!isDeepStrictEqual(blanks(r[a]),blanks(s[b]))) throw new Error('staging_actuals_changed');
   }
  }
  await this.google.batch(rows.filter(r=>r.import_status!=='committed'||r.commit_match_status!=='match').map(r=>this.google.update('15_AutoLogStaging',STAGING_HEADERS,
   {...r,action:'COMMIT',committed_session_id:id,committed_set_id:r.source_set_id,committed_at:new Date().toISOString(),import_status:'committed',commit_match_status:'match'})));
 }
 async audit(info) {
  await this.load(); const updateId=`PWA-COMMIT-${info.session_id}-${info.token}`;
  const change=`${info.session_id}: 1 session / ${info.set_count} sets`;
  const existing=this.data['16_UpdateLog'].rows.filter(r=>r.update_id===updateId);
  if(existing.length===1&&existing[0].verification==='READ BACK match'&&existing[0].status==='LIVE'&&existing[0].target==='01_Sessions / 02_Sets'&&existing[0].change===change) return;
  if(existing.length||this.journal.state.status==='committed'||this.journal.state.audit_started) throw new Error('audit_ambiguous');
  await this.journal.call('audit');
  const auditRow={update_id:updateId,updated_at:new Date().toISOString(),version:'PWA-v2',patch_name:'正式記録',change_type:'AUTO COMMIT',target:'01_Sessions / 02_Sets',change,player_effect:'実績保存',verification:'READ BACK match',status:'LIVE'};
  await this.google.batch([this.google.append('16_UpdateLog',LOG_HEADERS,[auditRow])]);
  await this.load();const back=this.data['16_UpdateLog'].rows.filter(r=>r.update_id===updateId);
  if(back.length!==1||!Object.keys(auditRow).every(k=>back[0][k]===auditRow[k])) throw new Error('audit_readback_failed');
 }
}
