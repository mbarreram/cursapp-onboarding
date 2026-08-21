import { createClient } from 'npm:@supabase/supabase-js@2';

const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
};
const INT_CODE='597055555532';
const INT_KEY='579B532A7440BB0C9079DED94D31EA1615BACEB56610332264630D42D0A36B1C';
const INT_API='https://webpay3gint.transbank.cl/rswebpaytransaction/api/webpay/v1.2/transactions';
const PROD_API='https://webpay3g.transbank.cl/rswebpaytransaction/api/webpay/v1.2/transactions';
const PACKAGES={
  basic:{code:'basic',name:'Básico',credits:10,price:990},
  plus:{code:'plus',name:'Plus',credits:30,price:1990},
  pro:{code:'pro',name:'Pro',credits:60,price:3990},
} as const;
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});
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
    const code=String(body.package_code||'').toLowerCase().trim() as keyof typeof PACKAGES;
    const pack=PACKAGES[code];
    if(!pack) return json({error:'Paquete de créditos inválido.'},400);
    const admin=createClient(url,service,{auth:{persistSession:false}});
    const email=String(user.email||'').toLowerCase();
    const order=await admin.from('ordenes_creditos').insert({usuario_id:user.id,email,paquete_nombre:pack.name,paquete_id:pack.code,paquete_codigo:pack.code,creditos:pack.credits,monto:pack.price,monto_total:pack.price,ingreso_cursapp:0,estado:'pendiente',proveedor_pago:'transbank',gateway:'webpay_plus'}).select('id').single();
    if(order.error||!order.data) throw new Error('No se pudo crear la orden de créditos.');
    const stamp=Date.now().toString().slice(-10);
    const buyOrder=`MC${user.id.replace(/-/g,'').slice(0,8).toUpperCase()}${stamp}`.slice(0,26);
    const sessionId=`MC-${user.id.replace(/-/g,'').slice(0,20)}-${stamp}`.slice(0,61);
    const cfg=tbk();
    const tx=await admin.from('transbank_transactions').insert({pago_id:null,curso_id:null,user_id:user.id,environment:cfg.env,buy_order:buyOrder,session_id:sessionId,amount:pack.price,status:'CREATING',transaction_type:'mercado_creditos',credit_order_id:order.data.id}).select('id').single();
    if(tx.error||!tx.data){await admin.from('ordenes_creditos').update({estado:'error'}).eq('id',order.data.id);throw new Error('No se pudo registrar el intento de pago.');}
    const response=await fetch(cfg.api,{method:'POST',headers:{'Content-Type':'application/json','Tbk-Api-Key-Id':cfg.commerceCode,'Tbk-Api-Key-Secret':cfg.apiKey},body:JSON.stringify({buy_order:buyOrder,session_id:sessionId,amount:pack.price,return_url:`${url}/functions/v1/mercado-credit-commit`})});
    const text=await response.text();let data:any=null;try{data=text?JSON.parse(text):null;}catch(_){data=null;}
    if(!response.ok||!data?.token||!data?.url){await admin.from('transbank_transactions').update({status:'CREATE_ERROR',error_message:text.slice(0,500)}).eq('id',tx.data.id);await admin.from('ordenes_creditos').update({estado:'error',transbank_transaction_id:tx.data.id,tbk_order:buyOrder}).eq('id',order.data.id);return json({error:'Transbank no pudo iniciar la compra.'},502);}
    await admin.from('transbank_transactions').update({token_ws:data.token,status:'INITIALIZED',raw_response:{create:data}}).eq('id',tx.data.id);
    await admin.from('ordenes_creditos').update({transbank_transaction_id:tx.data.id,tbk_order:buyOrder,updated_at:new Date().toISOString()}).eq('id',order.data.id);
    return json({ok:true,order_id:order.data.id,transaction_id:tx.data.id,token:data.token,url:data.url,amount:pack.price,credits:pack.credits,package_name:pack.name});
  }catch(error){console.error('mercado-credit-create',error);return json({error:(error as Error)?.message||'No se pudo iniciar la compra de créditos.'},500);}
});