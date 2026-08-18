import { createClient } from 'npm:@supabase/supabase-js@2';

const INT_CODE='597055555532';
const INT_KEY='579B532A7440BB0C9079DED94D31EA1615BACEB56610332264630D42D0A36B1C';
const INT_API='https://webpay3gint.transbank.cl/rswebpaytransaction/api/webpay/v1.2/transactions';
const PROD_API='https://webpay3g.transbank.cl/rswebpaytransaction/api/webpay/v1.2/transactions';
function tbk(envValue?:string|null){
  const env=String(envValue||Deno.env.get('TBK_ENV')||'integration').toLowerCase();
  if(env==='production'){
    const commerceCode=String(Deno.env.get('TBK_COMMERCE_CODE')||'');
    const apiKey=String(Deno.env.get('TBK_API_KEY')||'');
    if(!commerceCode||!apiKey) throw new Error('Credenciales productivas de Transbank no configuradas.');
    return {commerceCode,apiKey,api:PROD_API};
  }
  return {commerceCode:INT_CODE,apiKey:INT_KEY,api:INT_API};
}
const appBase=()=>String(Deno.env.get('MICURSOX_APP_URL')||Deno.env.get('APP_BASE_URL')||'https://cursapp-onboarding.pages.dev').replace(/\/$/,'');
const redirect=(params:Record<string,string>)=>new Response(null,{status:302,headers:{Location:appBase()+'/pay_result.html?'+new URLSearchParams(params).toString(),'Cache-Control':'no-store'}});
async function parseBody(req:Request){const ct=String(req.headers.get('content-type')||'').toLowerCase();const raw=await req.text();if(ct.includes('application/json')){try{return JSON.parse(raw||'{}') as Record<string,unknown>;}catch(_){return {};}}return Object.fromEntries(new URLSearchParams(raw||'').entries());}

Deno.serve(async(req)=>{
  if(req.method!=='POST'&&req.method!=='GET') return new Response('Method Not Allowed',{status:405});
  const url=Deno.env.get('SUPABASE_URL')||''; const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
  const admin=createClient(url,service,{auth:{persistSession:false}});
  try{
    const u=new URL(req.url); const body=req.method==='POST'?await parseBody(req):Object.fromEntries(u.searchParams.entries());
    const token=String(body.token_ws||u.searchParams.get('token_ws')||'').trim();
    const cancelBuy=String(body.TBK_ORDEN_COMPRA||'').trim();
    if(!token){
      if(cancelBuy){const f=await admin.from('transbank_transactions').select('id,pago_id').eq('buy_order',cancelBuy).maybeSingle();if(f.data){await admin.from('transbank_transactions').update({status:'CANCELLED',error_message:'Usuario canceló o abandonó Webpay.'}).eq('id',f.data.id);return redirect({ok:'0',pid:f.data.pago_id,tx:f.data.id,reason:'cancelled'});}}
      return redirect({ok:'0',reason:'no_token_ws'});
    }
    const found=await admin.from('transbank_transactions').select('*').eq('token_ws',token).maybeSingle();
    if(found.error||!found.data) return redirect({ok:'0',reason:'unknown_transaction'});
    const tx:any=found.data;
    if(tx.status==='APPROVED') return redirect({ok:'1',pid:tx.pago_id,tx:tx.id});
    if(['REJECTED','CANCELLED'].includes(String(tx.status))) return redirect({ok:'0',pid:tx.pago_id,tx:tx.id,reason:String(tx.status).toLowerCase()});
    const lock=await admin.from('transbank_transactions').update({status:'COMMITTING'}).eq('id',tx.id).in('status',['INITIALIZED','CREATE_ERROR']).select('id');
    if(!lock.data||lock.data.length===0) return redirect({ok:'0',pid:tx.pago_id,tx:tx.id,reason:'processing'});
    const cfg=tbk(tx.environment);
    const response=await fetch(`${cfg.api}/${encodeURIComponent(token)}`,{method:'PUT',headers:{'Content-Type':'application/json','Tbk-Api-Key-Id':cfg.commerceCode,'Tbk-Api-Key-Secret':cfg.apiKey}});
    const text=await response.text();let data:any=null;try{data=text?JSON.parse(text):null;}catch(_){data=null;}
    if(!response.ok||!data){await admin.from('transbank_transactions').update({status:'COMMIT_ERROR',error_message:text.slice(0,500)}).eq('id',tx.id);return redirect({ok:'0',pid:tx.pago_id,tx:tx.id,reason:'commit_error'});}
    const approved=Number(data.amount)===Number(tx.amount)&&String(data.buy_order||'')===String(tx.buy_order||'')&&Number(data.response_code)===0&&String(data.status||'').toUpperCase()==='AUTHORIZED';
    await admin.from('transbank_transactions').update({status:approved?'APPROVED':'REJECTED',response_code:Number.isFinite(Number(data.response_code))?Number(data.response_code):null,authorization_code:data.authorization_code||null,payment_type_code:data.payment_type_code||null,installments_number:Number.isFinite(Number(data.installments_number))?Number(data.installments_number):null,card_number:data.card_detail?.card_number||null,accounting_date:data.accounting_date||null,transaction_date:data.transaction_date||null,vci:data.vci||null,transbank_status:data.status||null,raw_response:{commit:data},error_message:approved?null:'Transacción rechazada o datos no coincidentes.',committed_at:new Date().toISOString()}).eq('id',tx.id);
    if(approved){
      const p=await admin.from('pagos').select('monto,monto_cuota,estado').eq('id',tx.pago_id).maybeSingle();const cuota=Math.max(0,Number(p.data?.monto_cuota??p.data?.monto??0)||0);
      if(p.data&&!['pagado','paid'].includes(String(p.data.estado||'').toLowerCase())) await admin.from('pagos').update({estado:'pagado',monto_pagado:cuota,metodo_pago:'transbank',canal_recaudacion:'webpay_plus',paid_at:new Date().toISOString()}).eq('id',tx.pago_id);
      await admin.from('notifications').insert({user_id:tx.user_id,curso_id:tx.curso_id||null,rol_destino:'apoderado',category:'payment',title:'Pago confirmado',message:`Tu pago por $${Number(tx.amount).toLocaleString('es-CL')} fue confirmado por Transbank.`,url_destino:'/apoderado.html#payments_paid',payload:{pago_id:tx.pago_id,transbank_transaction_id:tx.id,amount:tx.amount},is_read:false,delivery_state:'created'});
    }
    return redirect({ok:approved?'1':'0',pid:tx.pago_id,tx:tx.id,reason:approved?'approved':'rejected'});
  }catch(error){console.error('webpay-commit',error);return redirect({ok:'0',reason:'unexpected_error'});}
});
