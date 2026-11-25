import {createClient} from 'npm:@supabase/supabase-js@2';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info'};
const json=(x:unknown,status=200)=>new Response(JSON.stringify(x),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
const uuid=(s:unknown)=>/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(String(s||''));
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return json({error:'Método no permitido'},405);
 try{
  const url=Deno.env.get('SUPABASE_URL')||'',service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'',anon=Deno.env.get('SUPABASE_ANON_KEY')||'';
  const caller=createClient(url,anon,{global:{headers:{Authorization:req.headers.get('Authorization')||''}},auth:{persistSession:false}});
  const {data:{user}}=await caller.auth.getUser();
  if(!user)return json({error:'Sesión requerida'},401);
  const body=await req.json().catch(()=>({})),id=body.transaction_id;
  if(!uuid(id))return json({error:'Referencia inválida'},400);
  const db=createClient(url,service,{auth:{persistSession:false}});
  const {data:tx,error:txError}=await db.from('transbank_transactions').select('id,user_id,curso_id,buy_order,amount,status,committed_at').eq('id',id).maybeSingle();
  if(txError||!tx)return json({error:'Comprobante no encontrado'},404);
  if(tx.user_id!==user.id)return json({error:'Sin acceso a esta transacción'},403);
  if(!['APPROVED','REFUNDED'].includes(tx.status))return json({error:'El pago aún no está confirmado'},409);
  const {data:items,error:itemsError}=await db.from('transbank_transaction_items').select('pago_id,curso_id,miembro_id,monto_cuota,comision_transbank,comision_micursox,monto_total_cobrado').eq('transaction_id',tx.id).order('pago_id');
  if(itemsError)return json({error:'No fue posible obtener las cuotas'},503);
  if(!items||items.length<2)return json({error:'No corresponde a un pago agrupado'},404);
  if(items.some(x=>x.curso_id!==tx.curso_id)||items.reduce((s,x)=>s+Number(x.monto_total_cobrado),0)!==Number(tx.amount))return json({error:'El detalle no coincide con el cargo'},409);
  const ids=items.map(x=>x.pago_id);
  const {data:pays,error:pe}=await db.from('pagos').select('id,miembro_id,campana_id,periodo,fecha_vencimiento,concepto').in('id',ids);
  if(pe||!pays||pays.length!==items.length)return json({error:'Detalle de cuotas incompleto'},503);
  const campIds=[...new Set(pays.map(p=>p.campana_id).filter(Boolean))];
  const {data:camps,error:ce}=campIds.length?await db.from('campanas').select('id,titulo').in('id',campIds):{data:[],error:null};
  if(ce)return json({error:'No se pudo consultar las campañas'},503);
  const names=new Map((camps||[]).map(x=>[x.id,x.titulo]));
  const paymentMap=new Map(pays.map(x=>[x.id,x]));
  const lines=items.map(x=>{const p=paymentMap.get(x.pago_id);if(!p||p.miembro_id!==x.miembro_id)throw Error('Cuota inconsistente');return {pago_id:x.pago_id,campana:names.get(p.campana_id)||p.concepto||'Campaña',periodo:p.periodo||p.fecha_vencimiento||'',cuota:Number(x.monto_cuota),comision_transbank:Number(x.comision_transbank),comision_micursox:Number(x.comision_micursox),total:Number(x.monto_total_cobrado)};});
  return json({ok:true,receipt:{transaction_id:tx.id,folio:tx.buy_order,status:tx.status,paid_at:tx.committed_at,curso_id:tx.curso_id,cuotas:lines,subtotal:lines.reduce((s,x)=>s+x.cuota,0),comisiones:lines.reduce((s,x)=>s+x.comision_transbank+x.comision_micursox,0),total:Number(tx.amount)}});
 }catch(e){console.error('webpay-group-receipt',e);return json({error:'No se pudo generar el comprobante'},500);}
});
