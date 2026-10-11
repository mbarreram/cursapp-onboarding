import {createClient} from "npm:@supabase/supabase-js@2";
const resp=(x:unknown,s=200)=>new Response(JSON.stringify(x),{status:s,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
Deno.serve(async req=>{
 if(req.method!=="POST")return resp({error:"method_not_allowed"},405);
 const base=Deno.env.get("SUPABASE_URL")||"",service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"",destination=Deno.env.get("MX_AUDIT_URL")||"",key=Deno.env.get("MX_AUDIT_SERVICE_ROLE_KEY")||"";
 if(!base||!service||!destination||!key)return resp({error:"missing_server_config"},503);
 const internalSecret=req.headers.get("x-cursapp-queue-secret")||"";
 const validation=createClient(base,Deno.env.get("SUPABASE_ANON_KEY")||"",{auth:{persistSession:false}});
 const verified=await validation.rpc("verify_audit_worker_secret",{p_secret:internalSecret});
 if(verified.error||verified.data!==true)return resp({error:"forbidden"},403);
 const db=createClient(base,service,{auth:{persistSession:false}}), audit=createClient(destination,key,{auth:{persistSession:false}});
 const {data:jobs,error}=await db.from("audit_delivery_outbox").select("id,events,attempts").eq("status","pending").lte("next_attempt_at",new Date().toISOString()).order("created_at",{ascending:true}).limit(40);
 if(error)return resp({error:"queue_unavailable"},503);
 let sent=0,failed=0;
 for(const job of jobs||[]){
  try{
   const result=await audit.rpc("audit_ingest_server_batch",{p_events:job.events});
   if(result.error)throw new Error(result.error.message);
   const update=await db.from("audit_delivery_outbox").update({status:"sent",attempts:job.attempts+1,delivered_at:new Date().toISOString(),last_error:null}).eq("id",job.id).eq("status","pending");
   if(update.error)throw new Error("queue_update_failed");
   sent++;
  }catch(error){
   const attempts=job.attempts+1,delay=Math.min(3600,Math.pow(2,Math.min(attempts,10))*30);
   await db.from("audit_delivery_outbox").update({attempts,next_attempt_at:new Date(Date.now()+delay*1000).toISOString(),last_error:String(error).slice(0,160)}).eq("id",job.id).eq("status","pending");
   failed++;
  }
 }
 return resp({ok:true,selected:(jobs||[]).length,sent,failed});
});