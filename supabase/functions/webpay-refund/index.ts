import {createClient} from "npm:@supabase/supabase-js@2";
const headers={"Content-Type":"application/json","Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Cache-Control":"no-store"};
const send=(x:unknown,status=200)=>new Response(JSON.stringify(x),{status,headers});
const valid=(s:unknown)=>typeof s==="string"&&/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(s);
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return send({});
 if(req.method!=="POST")return send({error:"Método no permitido"},405);
 const base=Deno.env.get("SUPABASE_URL")||"";
 const integrationKey=Deno.env.get("TBK_INTEGRATION_API_KEY")||"";
 if(!integrationKey)return send({error:"Función no habilitada: falta secreto de integración"},503);
 const auth=createClient(base,Deno.env.get("SUPABASE_ANON_KEY")||"",{global:{headers:{Authorization:req.headers.get("Authorization")||""}},auth:{persistSession:false}});
 const {data:{user}}=await auth.auth.getUser();
 if(!user)return send({error:"Sesión no autorizada"},401);
 const body=await req.json().catch(()=>({})),id=body.transaction_id,reason=String(body.reason||"").trim();
 if(!valid(id)||reason.length<8||reason.length>500)return send({error:"Datos inválidos"},400);
 const db=createClient(base,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"",{auth:{persistSession:false}});
 const {data:tx}=await db.from("transbank_transactions").select("id,pago_id,curso_id,environment,amount,status,token_ws").eq("id",id).maybeSingle();
 if(!tx||tx.status!=="APPROVED"||tx.environment!=="integration"||!tx.token_ws)return send({error:"Transacción no anulable"},409);
 const {data:members}=await db.from("miembros_curso").select("id").eq("curso_id",tx.curso_id).eq("usuario_id",user.id).in("rol",["presidente","tesorero"]).not("estado","in","(eliminado,bloqueado)").limit(1);
 if(!members?.length)return send({error:"Sin permisos de directiva"},403);
 const group=await db.from("transbank_transaction_items").select("pago_id").eq("transaction_id",tx.id);if(group.error)return send({error:"No se pudo comprobar la composición de la transacción."},503);if((group.data?.length||0)>1)return send({error:"Anulación agrupada aún no habilitada: requiere reversa integral."},409);
 const {data:p}=await db.from("pagos").select("estado,metodo_pago,monto_pagado,monto_total_cobrado,curso_id").eq("id",tx.pago_id).maybeSingle();
 if(!p||p.curso_id!==tx.curso_id||p.estado!=="pagado"||p.metodo_pago!=="transbank"||Number(p.monto_total_cobrado)!==Number(tx.amount)||Number(p.monto_pagado)<=0)return send({error:"Cuadratura inválida"},409);
 const {data:r,error:insertError}=await db.from("transbank_refunds").insert({transaction_id:tx.id,pago_id:tx.pago_id,curso_id:tx.curso_id,requested_by:user.id,reason,amount:tx.amount,status:"PROCESSING"}).select("id").single();
 if(insertError||!r)return send({error:"Existe una anulación o solicitud previa; revisar auditoría"},409);
 let response:Response;
 try{response=await fetch("https://webpay3gint.transbank.cl/rswebpaytransaction/api/webpay/v1.2/transactions/"+encodeURIComponent(tx.token_ws)+"/refunds",{method:"POST",headers:{"Content-Type":"application/json","Tbk-Api-Key-Id":"597055555532","Tbk-Api-Key-Secret":integrationKey},body:JSON.stringify({amount:Number(tx.amount)})});}
 catch(_){await db.from("transbank_refunds").update({status:"NEEDS_REVIEW",error_message:"Respuesta incierta de pasarela"}).eq("id",r.id);return send({error:"Resultado incierto: no repetir",refund_id:r.id},502);}
 const raw=await response.text();let result:any=null;try{result=JSON.parse(raw)}catch(_){}
 const full=!!result&&response.ok&&(
  result.type==="REVERSED"&&Number(result.balance)===0 ||
  result.type==="NULLIFIED"&&Number(result.response_code)===0&&Number(result.nullified_amount)===Number(tx.amount)&&Number(result.balance)===0
 );
 if(!full){const ambiguous=response.status>=500||response.ok;await db.from("transbank_refunds").update({status:ambiguous?"NEEDS_REVIEW":"FAILED",gateway_response:result||{http_status:response.status},error_message:"Transbank no confirmó anulación total"}).eq("id",r.id);return send({error:ambiguous?"Resultado incierto: revisar antes de reintentar":"Anulación rechazada",refund_id:r.id},ambiguous?502:409)}
 const saved=await db.from("transbank_refunds").update({status:"GATEWAY_CONFIRMED",gateway_type:result.type,gateway_response:result,gateway_confirmed_at:new Date().toISOString()}).eq("id",r.id);
 if(saved.error)return send({error:"Anulación aceptada; auditoría requiere revisión",refund_id:r.id},500);
 const done=await db.rpc("finalizar_anulacion_transbank",{p_refund_id:r.id});
 if(done.error){await db.from("transbank_refunds").update({status:"NEEDS_REVIEW",error_message:String(done.error.message).slice(0,300)}).eq("id",r.id);return send({error:"Anulado en pasarela; conciliación interna pendiente",refund_id:r.id},500)}
 return send({ok:true,refund_id:r.id,resultado:done.data});
});