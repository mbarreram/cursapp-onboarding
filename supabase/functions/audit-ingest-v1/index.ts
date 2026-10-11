import {createClient} from "npm:@supabase/supabase-js@2";
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
Deno.serve(async(req)=>{
 if(req.method!=="POST")return reply({error:"method_not_allowed"},405);
 const main=Deno.env.get("SUPABASE_URL"),anon=Deno.env.get("SUPABASE_ANON_KEY");
 const auditUrl=Deno.env.get("MX_AUDIT_URL"),auditKey=Deno.env.get("MX_AUDIT_SERVICE_ROLE_KEY");
 if(!main||!anon)return reply({error:"main_not_configured"},503);
 const auth=req.headers.get("Authorization")||"";
 const primary=createClient(main,anon,{global:{headers:{Authorization:auth}},auth:{persistSession:false}});
 const session=await primary.auth.getUser();
 if(!session.data.user)return reply({error:"unauthorized"},401);
 const payload=await req.json().catch(()=>null);
 if(!Array.isArray(payload?.events)||payload.events.length<1||payload.events.length>25)return reply({error:"invalid_batch"},400);
 if(!auditUrl||!auditKey)return reply({error:"audit_connection_not_configured"},503);
 const allowed=new Set(["button_click","form_submit","navigation","download","share"]);
 const entries=payload.events.flatMap((e:Record<string,unknown>)=>{
  if(!e||!allowed.has(String(e.type)))return [];
  const eventId=String(e.event_id||"");
  if(!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(eventId))return [];
  const target=String(e.target||"").replace(/[^a-zA-Z0-9_:-]/g,"").slice(0,120);
  if(!target)return [];
  return [{event_id:eventId,occurred_at:new Date().toISOString(),actor_user_id:session.data.user.id,curso_id:null,
   actor_role:null,event_type:String(e.type),target,source:"client",metadata:{}}];
 });
 if(!entries.length)return reply({error:"empty_batch"},400);
 const audit=createClient(auditUrl,auditKey,{auth:{persistSession:false}});
 const result=await audit.rpc("audit_ingest_server_batch",{p_events:entries});
 if(result.error)return reply({error:"audit_unavailable"},503);
 return reply({ok:true,accepted:entries.length});
});