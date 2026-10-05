import { createClient } from '@supabase/supabase-js';
import { checkServerReadiness } from '../server/readiness.mjs';
export const config={maxDuration:60};
export default async function handler(req,res) {
 res.setHeader('Cache-Control','private, no-store');
 if(req.method!=='GET') return res.status(405).end();
 const url=process.env.VITE_SUPABASE_URL,key=process.env.VITE_SUPABASE_ANON_KEY;
 const auth=req.headers.authorization;
 if(!url||!key||!auth?.startsWith('Bearer ')) return res.status(401).end();
 try {
  const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error}=await client.auth.getUser(auth.slice(7));
  if(error||!data.user) return res.status(401).end();
  return res.status(200).json(await checkServerReadiness());
 } catch {return res.status(503).json({status:'SERVER_CONFIG_REVIEW_REQUIRED'});}
}
