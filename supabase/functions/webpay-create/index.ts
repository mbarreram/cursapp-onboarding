import { createClient } from 'npm:@supabase/supabase-js@2';

const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
};
const INT_CODE='597055555532';
const INT_KEY='579B532A7440BB0C9079DED94D31EA1615BACEB56610332264630D42D0A36B1C';
const INT_API='https://webpay3gint.transbank.cl/rswebpaytransaction/api/webpay/v1.2/transactions';
const PROD_API='https://webpay3g.transbank.cl/rswebpaytransaction/api/webpay/v1.2/transactions';
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});
const isUuid=(v:unknown)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v||''));
function tbk(){
  const env=String(Deno.env.get('TBK_ENV')||'integration').toLowerCase();
  if(env==='production'){
    const commerceCode=String(Deno.env.get('TBK_COMMERCE_CODE')||'');
    const apiKey=String(Deno.env.get('TBK_API_KEY')||'');
    if(!commerceCode||!apiKey) throw new Error('Credenciales productivas de Transbank no configuradas.');
    return {env:'production',commerceCode,apiKey,api:PROD_API};
  }
  return {env:'integration',commerceCode:INT_CODE,apiKey:INT_KEY,api:INT_API};
}

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers:cors});
  if(req.method!=='POST') return json({error:'Método no permitido.'},405);
  try{
    const url=Deno.env.get('SUPABASE_URL')||'';
    const anon=Deno.env.get('SUPABASE_ANON_KEY')||'';
    const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
    const authorization=req.headers.get('Authorization')||'';
    const caller=createClient(url,anon,{global:{headers:{Authorization:authorization}},auth:{persistSession:false}});
    const auth=await caller.auth.getUser();
    const user=auth.data.user;
    if(!user) return json({error:'Sesión inválida.'},401);
    const body=await req.json().catch(()=>({})) as Record<string,unknown>;
    const pagoId=String(body.pago_id||'').trim();
    if(!isUuid(pagoId)) return json({error:'Pago inválido.'},400);
    const admin=createClient(url,service,{auth:{persistSession:false}});
    const found=await admin.from('pagos').select('id,curso_id,monto,monto_pagado,estado,monto_cuota,tasa_transbank,tasa_micursox,comision_transbank,comision_micursox,monto_total_cobrado,miembros_curso!inner(usuario_id)').eq('id',pagoId).maybeSingle();
    if(found.error||!found.data) return json({error:'Pago no encontrado.'},404);
    const pago:any=found.data;
    const miembro:any=Array.isArray(pago.miembros_curso)?pago.miembros_curso[0]:pago.miembros_curso;
    if(!miembro||miembro.usuario_id!==user.id) return json({error:'No tienes acceso a este pago.'},403);
    if(['pagado','paid'].includes(String(pago.estado||'').toLowerCase())) return json({error:'Este pago ya está pagado.'},409);
    const cuota=Math.max(0,Number(pago.monto_cuota??pago.monto??0)||0);
    const tasaTb=Number(pago.tasa_transbank??1.79)||1.79;
    const tasaMx=Number(pago.tasa_micursox??2.25)||2.25;
    const tb=Math.round(Number(pago.comision_transbank??(cuota*tasaTb/100))||0);
    const mx=Math.round(Number(pago.comision_micursox??(cuota*tasaMx/100))||0);
    const amount=Math.round(Number(pago.monto_total_cobrado??(cuota+tb+mx))||0);
    if(amount<=0) return json({error:'El monto no es válido.'},400);
    const stamp=Date.now().toString().slice(-10);
    const buyOrder=`MX${pagoId.replace(/-/g,'').slice(0,10).toUpperCase()}${stamp}`.slice(0,26);
    const sessionId=`MX-${user.id.replace(/-/g,'').slice(0,20)}-${stamp}`.slice(0,61);
    const cfg=tbk();
    const inserted=await admin.from('transbank_transactions').insert({pago_id:pagoId,curso_id:pago.curso_id||null,user_id:user.id,environment:cfg.env,buy_order:buyOrder,session_id:sessionId,amount,status:'CREATING'}).select('id').single();
    if(inserted.error||!inserted.data) throw new Error('No se pudo registrar el intento de pago.');
    const response=await fetch(cfg.api,{method:'POST',headers:{'Content-Type':'application/json','Tbk-Api-Key-Id':cfg.commerceCode,'Tbk-Api-Key-Secret':cfg.apiKey},body:JSON.stringify({buy_order:buyOrder,session_id:sessionId,amount,return_url:`${url}/functions/v1/webpay-commit`})});
    const text=await response.text(); let data:any=null; try{data=text?JSON.parse(text):null;}catch(_){data=null;}
    if(!response.ok||!data?.token||!data?.url){await admin.from('transbank_transactions').update({status:'CREATE_ERROR',error_message:text.slice(0,500)}).eq('id',inserted.data.id);return json({error:'Transbank no pudo iniciar la transacción.'},502);}
    await admin.from('transbank_transactions').update({token_ws:data.token,status:'INITIALIZED',raw_response:{create:data}}).eq('id',inserted.data.id);
    return json({ok:true,transaction_id:inserted.data.id,token:data.token,url:data.url,amount});
  }catch(error){console.error('webpay-create',error);return json({error:(error as Error)?.message||'No se pudo iniciar el pago.'},500);}
});
