import { createHash, randomUUID } from 'node:crypto';

const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
 ? Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])) : value;
export function snapshotHash(session,sets) {
 // Ignore server touch/sync/UI status. Include all actuals, IDs and submitted metadata.
 const clean = ({server_updated_at,sync_status,official_save_status,...rest})=>rest;
 return createHash('sha256').update(JSON.stringify(canonical({session:clean(session),sets:[...sets].sort((a,b)=>a.set_id.localeCompare(b.set_id)).map(clean)}))).digest('hex');
}
export class CommitJournal {
 constructor(client,userId,sessionId,hash) {
  Object.assign(this,{client,userId,sessionId,hash,owner:randomUUID(),state:null});
 }
 async call(action,plan=null) {
  const {data,error}=await this.client.rpc('workout_commit_gate',{p_action:action,p_session:this.sessionId,
   p_user:this.userId,p_hash:this.hash,p_owner:this.owner,p_plan:plan});
  if(error||!data) throw new Error('commit_journal_unavailable');
  this.state=data; return data;
 }
 async run(fn) {
  const state=await this.call('claim');
  if(state.status==='busy') throw new Error('commit_in_progress');
  if(state.status==='committed') return fn();
  try {return await fn();}
  catch(error) {try {await this.call('review');} catch {} throw error;}
 }
}
