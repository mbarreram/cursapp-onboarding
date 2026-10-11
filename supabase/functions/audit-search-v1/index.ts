import {createClient} from "npm:@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"https://micursox.cl","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}});
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
 if(req.method!=="POST")return json({error:"method_not_allowed"},405);
 const url=Deno.env.get("SUPABASE_URL")||"",anon=Deno.env.get("SUPABASE_ANON_KEY")||"",auditUrl=Deno.env.get("MX_AUDIT_URL")||"",auditKey=Deno.env.get("MX_AUDIT_SERVICE_ROLE_KEY")||"";
 const bearer=req.headers.get("Authorization")||"";
 if(!url||!anon)return json({error:"auth_not_configured"},503);
 const main=createClient(url,anon,{global:{headers:{Authorization:bearer}},auth:{persistSession:false}});
 const user=await main.auth.getUser();
 if(!user.data.user)return json({error:"unauthorized"},401);
 const role=await main.rpc("is_admin");
 if(role.error||role.data!==true)return json({error:"forbidden"},403);
 if(!auditUrl||!auditKey)return json({error:"audit_connection_not_configured"},503);
 const p=await req.json().catch(()=>({}));
 const id=(v:unknown)=>typeof v==="string"&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(v)?v:null;
 const date=(v:unknown)=>typeof v==="string"&&!Number.isNaN(Date.parse(v))?new Date(v).toISOString():null;
 const audit=createClient(auditUrl,auditKey,{auth:{persistSession:false}});
 const data=await audit.rpc("audit_search_server",{
  p_actor_user_id:id(p.actor_user_id),p_reference_id:id(p.reference_id),p_from:date(p.from),p_to:date(p.to),
  p_event_type:typeof p.event_type==="string"?p.event_type.slice(0,80):null,
  p_before_at:date(p.before_at),p_before_id:Number.isSafeInteger(p.before_id)?p.before_id:null,
  p_limit:Math.min(100,Math.max(1,Number(p.limit)||25))});
 if(data.error)return json({error:"audit_search_failed"},503);
 const rows=Array.isArray(data.data)?data.data:[];
 const end=rows.at(-1);
 return json({rows,next_cursor:end?{before_at:end.occurred_at,before_id:end.id}:null});
});