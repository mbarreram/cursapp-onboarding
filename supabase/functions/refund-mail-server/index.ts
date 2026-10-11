import {createClient} from "npm:@supabase/supabase-js@2";
const json=(o:unknown,s=200)=>new Response(JSON.stringify(o),{status:s,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
Deno.serve(async req=>{
 if(req.method!=="POST")return json({error:"Method not allowed"},405);
 const body=await req.json().catch(()=>({}));
 const id=String(body.refund_id||""),stamp=Number(body.timestamp),signature=String(body.signature||"");
 if(!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)||!Number.isSafeInteger(stamp)||!/^[a-f0-9]{64}$/i.test(signature))return json({error:"Invalid payload"},400);
 const url=Deno.env.get("SUPABASE_URL")||"",service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"",resend=Deno.env.get("RESEND_API_KEY")||"";
 if(!url||!service||!resend)return json({error:"Server config missing"},503);
 const db=createClient(url,service,{auth:{persistSession:false}});
 const verified=await db.rpc("verify_transbank_refund_mail_signature",{p_refund_id:id,p_timestamp:stamp,p_signature:signature});
 if(verified.error||verified.data!==true)return json({error:"Forbidden"},403);
 const {data:r,error:err}=await db.from("transbank_refunds").select("id,transaction_id,amount,status,email_sent_at").eq("id",id).maybeSingle();
 if(err||!r||r.status!=="COMPLETED")return json({error:"Missing completed refund"},404);
 if(r.email_sent_at)return json({ok:true,already_sent:true});
 const {data:t}=await db.from("transbank_transactions").select("user_id,environment").eq("id",r.transaction_id).maybeSingle();
 if(!t?.user_id)return json({error:"Missing recipient"},409);
 const {data:info}=await db.auth.admin.getUserById(t.user_id);
 if(!info?.user?.email)return json({error:"Email unavailable"},409);
 const claim=await db.from("transbank_refunds").update({email_sent_at:new Date().toISOString(),email_error:null}).eq("id",id).is("email_sent_at",null).select("id").maybeSingle();
 if(claim.error)return json({error:"Cannot claim delivery"},503);
 if(!claim.data)return json({ok:true,already_sent:true});
 const clp="$"+Number(r.amount).toLocaleString("es-CL");
 const isTest=t.environment==="integration";
 const detail=isTest?"La transacción pertenece al ambiente de integración de Transbank. No se cobró ni devolvió dinero real.":"La anulación se confirmó en Transbank. La devolución al medio de pago original y su fecha de acreditación dependen de Transbank y del banco emisor. Este aviso no significa que el dinero ya esté abonado.";
 const html='<div style="font-family:Arial,sans-serif;max-width:540px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:18px"><img alt="MiCursoX" width="195" src="https://micursox.cl/assets/brand/micursox-compact.svg"><h1 style="color:#b91c1c">Pago anulado</h1><p>Se confirmó la anulación total de tu pago mediante Transbank.</p><div style="background:#f8fafc;padding:18px;border-radius:14px"><div>Monto anulado</div><h2>'+clp+'</h2><small>Referencia: '+r.id+'</small></div><p style="line-height:1.6;color:#475569">'+detail+'</p><p>La cuota vuelve a figurar como pendiente en MiCursoX.</p><a href="https://micursox.cl/apoderado.html#payments">Consultar mis pagos</a></div>';
 try{
  const result=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"Authorization":"Bearer "+resend,"Content-Type":"application/json","Idempotency-Key":"micursox-refund-"+id},body:JSON.stringify({from:"MiCursoX <notificaciones@micursox.cl>",to:[info.user.email],subject:"Pago anulado · MiCursoX",html})});
  if(!result.ok)throw Error("Delivery HTTP "+result.status);
  return json({ok:true,sent:true});
 }catch(e){await db.from("transbank_refunds").update({email_sent_at:null,email_error:String(e).slice(0,250)}).eq("id",id);return json({error:"Email delivery failed"},502)}
});