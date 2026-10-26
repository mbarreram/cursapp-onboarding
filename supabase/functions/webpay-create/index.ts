import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const INTEGRATION_COMMERCE_CODE = '597055555532';
const INTEGRATION_API_KEY = '579B532A7440BB0C9079DED94D31EA1615BACEB56610332264630D42D0A36B1C';
const INTEGRATION_API = 'https://webpay3gint.transbank.cl/rswebpaytransaction/api/webpay/v1.2/transactions';
const PRODUCTION_API = 'https://webpay3g.transbank.cl/rswebpaytransaction/api/webpay/v1.2/transactions';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

function isUuid(value: unknown) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
}

function config() {
  const env = String(Deno.env.get('TBK_ENV') || 'integration').toLowerCase();
  if (env === 'production') {
    const commerceCode = String(Deno.env.get('TBK_COMMERCE_CODE') || '');
    const apiKey = String(Deno.env.get('TBK_API_KEY') || '');
    if (!commerceCode || !apiKey) throw new Error('Credenciales productivas de Transbank no configuradas.');
    return { env: 'production', commerceCode, apiKey, api: PRODUCTION_API };
  }
  return { env: 'integration', commerceCode: INTEGRATION_COMMERCE_CODE, apiKey: INTEGRATION_API_KEY, api: INTEGRATION_API };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Método no permitido.' }, 405);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    if (!supabaseUrl || !anonKey || !serviceKey) return json({ error: 'Backend no configurado.' }, 503);

    const authorization = req.headers.get('Authorization') || '';
    const caller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const auth = await caller.auth.getUser();
    const user = auth.data.user;
    if (!user) return json({ error: 'Sesión inválida.' }, 401);

    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const grouped=Array.isArray(body.pago_ids)?body.pago_ids.map(String):[];
    if(grouped.length){
      if(Deno.env.get('MX_WEBPAY_GROUP_ENABLED')!=='true')return json({error:'Pago múltiple deshabilitado hasta finalizar QA.'},503);
      if(grouped.length<2||grouped.length>20||new Set(grouped).size!==grouped.length||!grouped.every(isUuid))return json({error:'Cuotas inválidas.'},400);
      const admin=createClient(supabaseUrl,serviceKey,{auth:{persistSession:false}});
      const tbk=config(),stamp=Date.now().toString().slice(-9);
      const buyOrder=('MG'+crypto.randomUUID().replaceAll('-','').slice(0,15)+stamp).slice(0,26);
      const sessionId=('MXG-'+user.id.replaceAll('-','').slice(0,18)+'-'+stamp).slice(0,61);
      const reserved=await admin.rpc('mx_webpay_reserve_group',{p_user_id:user.id,p_pago_ids:grouped,p_buy_order:buyOrder,p_session_id:sessionId,p_environment:tbk.env});
      if(reserved.error||!reserved.data?.transaction_id)return json({error:'No fue posible reservar todas las cuotas.'},409);
      const txId=reserved.data.transaction_id,amount=Number(reserved.data.amount);
      try{
        const response=await fetch(tbk.api,{method:'POST',headers:{'Content-Type':'application/json','Tbk-Api-Key-Id':tbk.commerceCode,'Tbk-Api-Key-Secret':tbk.apiKey},body:JSON.stringify({buy_order:buyOrder,session_id:sessionId,amount,return_url:supabaseUrl+'/functions/v1/webpay-commit'})});
        const data=await response.json().catch(()=>null);
        if(!response.ok||!data?.token||!data?.url)throw Error('Inicio externo no confirmado');
        const saved=await admin.from('transbank_transactions').update({token_ws:data.token,status:'INITIALIZED',raw_response:{create:data}}).eq('id',txId).eq('status','CREATING').select('id');
        if(saved.error||!saved.data?.length)throw Error('Persistencia no confirmada');
        return json({ok:true,transaction_id:txId,token:data.token,url:data.url,amount});
      }catch(error){
        await admin.from('transbank_transactions').update({status:'COMMIT_ERROR',error_message:'Revisión requerida: '+String(error).slice(0,150)}).eq('id',txId).eq('status','CREATING');
        return json({error:'Inicio incierto; revisar antes de reintentar.',transaction_id:txId},502);
      }
    }
    const pagoId = String(body.pago_id || '').trim();
    if (!isUuid(pagoId)) return json({ error: 'Pago inválido.' }, 400);

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const paymentResult = await admin
      .from('pagos')
      .select('id,curso_id,miembro_id,monto,monto_pagado,estado,monto_cuota,tasa_transbank,tasa_micursox,comision_transbank,comision_micursox,monto_total_cobrado,miembros_curso!inner(usuario_id,estado)')
      .eq('id', pagoId)
      .maybeSingle();

    if (paymentResult.error || !paymentResult.data) return json({ error: 'Pago no encontrado.' }, 404);
    const pago: any = paymentResult.data;
    const miembro: any = Array.isArray(pago.miembros_curso) ? pago.miembros_curso[0] : pago.miembros_curso;
    if (!miembro || miembro.usuario_id !== user.id) return json({ error: 'No tienes acceso a este pago.' }, 403);

    const state = String(pago.estado || '').toLowerCase();
    if (state === 'pagado' || state === 'paid') return json({ error: 'Este pago ya está registrado como pagado.' }, 409);

    const cuota = Math.max(0, Number(pago.monto_cuota ?? pago.monto ?? 0) || 0);
    const tasaTb = Number(pago.tasa_transbank ?? 1.79) || 1.79;
    const tasaMx = Number(pago.tasa_micursox ?? 2.25) || 2.25;
    const tb = Math.round(Number(pago.comision_transbank ?? (cuota * tasaTb / 100)) || 0);
    const mx = Math.round(Number(pago.comision_micursox ?? (cuota * tasaMx / 100)) || 0);
    const amount = Math.round(Number(pago.monto_total_cobrado ?? (cuota + tb + mx)) || 0);
    if (amount <= 0) return json({ error: 'El monto del pago no es válido.' }, 400);

    const compactPayment = pagoId.replace(/-/g, '').slice(0, 10).toUpperCase();
    const stamp = Date.now().toString().slice(-10);
    const buyOrder = `MX${compactPayment}${stamp}`.slice(0, 26);
    const sessionId = `MX-${user.id.replace(/-/g, '').slice(0, 20)}-${stamp}`.slice(0, 61);
    const tbk = config();
    const returnUrl = `${supabaseUrl}/functions/v1/webpay-commit`;

    const existing=await admin.from('transbank_transactions').select('id,status').eq('pago_id',pagoId).in('status',['CREATING','INITIALIZED','COMMITTING','COMMIT_ERROR']).limit(1);
    if(existing.error)return json({error:'No se pudo validar un intento previo.'},503);
    if(existing.data?.length)return json({error:'Ya existe una transacción Webpay sin resolver para esta cuota.',code:'PAYMENT_ATTEMPT_UNRESOLVED'},409);
    const inserted = await admin.from('transbank_transactions').insert({
      pago_id: pagoId,
      curso_id: pago.curso_id || null,
      user_id: user.id,
      environment: tbk.env,
      buy_order: buyOrder,
      session_id: sessionId,
      amount,
      status: 'CREATING',
    }).select('id').single();
    if(inserted.error?.code==='23505')return json({error:'Ya existe un intento de pago en proceso.',code:'PAYMENT_ATTEMPT_UNRESOLVED'},409);
    if (inserted.error || !inserted.data) throw new Error('No se pudo registrar el intento de pago.');

    const txId = inserted.data.id;
    const response = await fetch(tbk.api, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Tbk-Api-Key-Id': tbk.commerceCode,
        'Tbk-Api-Key-Secret': tbk.apiKey,
      },
      body: JSON.stringify({ buy_order: buyOrder, session_id: sessionId, amount, return_url: returnUrl }),
    });
    const text = await response.text();
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch (_) { data = null; }

    if (!response.ok || !data?.token || !data?.url) {
      await admin.from('transbank_transactions').update({ status: 'CREATE_ERROR', error_message: text.slice(0, 500) }).eq('id', txId);
      return json({ error: 'Transbank no pudo iniciar la transacción.' }, 502);
    }

    await admin.from('transbank_transactions').update({
      token_ws: data.token,
      status: 'INITIALIZED',
      raw_response: { create: data },
    }).eq('id', txId);

    return json({ ok: true, transaction_id: txId, token: data.token, url: data.url, amount });
  } catch (error) {
    console.error('webpay-create', error);
    return json({ error: (error as Error)?.message || 'No se pudo iniciar el pago.' }, 500);
  }
});
