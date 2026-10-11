import {createClient} from "npm:@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"https://micursox.cl","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Access-Control-Allow-Methods":"POST, OPTIONS"};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}});
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
 if(req.method!=="POST")return reply({error:"method_not_allowed"},405);
 const main=Deno.env.get("SUPABASE_URL"),anon=Deno.env.get("SUPABASE_ANON_KEY"),service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 const auditUrl=Deno.env.get("MX_AUDIT_URL"),auditKey=Deno.env.get("MX_AUDIT_SERVICE_ROLE_KEY");
 if(!main||!anon||!service)return reply({error:"main_not_configured"},503);
 const auth=req.headers.get("Authorization")||"";
 const primary=createClient(main,anon,{global:{headers:{Authorization:auth}},auth:{persistSession:false}});
 const session=await primary.auth.getUser();
 if(!session.data.user)return reply({error:"unauthorized"},401);
 const adminCheck=await primary.rpc("is_admin");
 const isAdmin=!adminCheck.error&&adminCheck.data===true;
 const payload=await req.json().catch(()=>null);
 if(!Array.isArray(payload?.events)||payload.events.length<1||payload.events.length>25)return reply({error:"invalid_batch"},400);
 
 const allowed=new Set(["button_click","form_submit","navigation","download","share"]);
 const proposed=[...new Set(payload.events.map((e:Record<string,unknown>)=>String(e?.course_id||"")).filter((x:string)=>/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(x)))].slice(0,25);
 const membership=proposed.length?await primary.from("miembros_curso").select("curso_id,rol").eq("usuario_id",session.data.user.id).in("curso_id",proposed):{data:[],error:null};
 const allowedCourses=new Map((membership.data||[]).map((m:{curso_id:string,rol:string})=>[m.curso_id,m.rol]));
 const entries=payload.events.flatMap((e:Record<string,unknown>)=>{
  if(!e||!allowed.has(String(e.type)))return [];
  const eventId=String(e.event_id||"");
  if(!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(eventId))return [];
  const target=String(e.target||"").replace(/[^a-zA-Z0-9_:-]/g,"").slice(0,120);
  if(!target)return [];
  const requestedCourse=String(e.course_id||"");
  const verifiedRole=allowedCourses.get(requestedCourse);
  const course=verifiedRole?requestedCourse:null;
  return [{event_id:eventId,occurred_at:new Date().toISOString(),actor_user_id:session.data.user.id,curso_id:course,
   actor_role:isAdmin?"admin":(verifiedRole||null),event_type:String(e.type),target,source:"client",metadata:{}}];
 });
 if(!entries.length)return reply({error:"empty_batch"},400);
 const db=createClient(main,service,{auth:{persistSession:false}});
 const queued=await db.from("audit_delivery_outbox").insert({actor_user_id:session.data.user.id,events:entries}).select("id").single();
 if(queued.error)return reply({error:"queue_unavailable"},503);
 if(auditUrl&&auditKey){
  try{
   const audit=createClient(auditUrl,auditKey,{auth:{persistSession:false}});
   const result=await audit.rpc("audit_ingest_server_batch",{p_events:entries});
   if(!result.error)await db.from("audit_delivery_outbox").update({status:"sent",delivered_at:new Date().toISOString(),attempts:1}).eq("id",queued.data.id);
   else await db.from("audit_delivery_outbox").update({attempts:1,last_error:"destination_failed",next_attempt_at:new Date(Date.now()+60000).toISOString()}).eq("id",queued.data.id);
  }catch(_){await db.from("audit_delivery_outbox").update({attempts:1,last_error:"destination_unreachable",next_attempt_at:new Date(Date.now()+60000).toISOString()}).eq("id",queued.data.id)}
 }
 return reply({ok:true,accepted:entries.length,queued:true});
});