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
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}
function config(envValue?: string | null) {
  const env = String(envValue || Deno.env.get('TBK_ENV') || 'integration').toLowerCase();
  if (env === 'production') {
    const commerceCode = String(Deno.env.get('TBK_COMMERCE_CODE') || '');
    const apiKey = String(Deno.env.get('TBK_API_KEY') || '');
    if (!commerceCode || !apiKey) throw new Error('Credenciales productivas de Transbank no configuradas.');
    return { commerceCode, apiKey, api: PRODUCTION_API };
  }
  return { commerceCode: INTEGRATION_COMMERCE_CODE, apiKey: INTEGRATION_API_KEY, api: INTEGRATION_API };
}
function isUuid(value: unknown) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Método no permitido.' }, 405);
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const authorization = req.headers.get('Authorization') || '';
    const caller = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
    const auth = await caller.auth.getUser();
    const user = auth.data.user;
    if (!user) return json({ error: 'Sesión inválida.' }, 401);

    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const txId = String(body.transaction_id || '').trim();
    const pagoId = String(body.pago_id || '').trim();
    if (!isUuid(txId) && !isUuid(pagoId)) return json({ error: 'Transacción inválida.' }, 400);

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    let query = admin.from('transbank_transactions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1);
    if (isUuid(txId)) query = query.eq('id', txId);
    else query = query.eq('pago_id', pagoId);
    const found = await query.maybeSingle();
    if (found.error || !found.data) return json({ error: 'Transacción no encontrada.' }, 404);
    const tx: any = found.data;

    // Recovery path: if commit failed unexpectedly, ask Transbank for the last known status.
    if (tx.token_ws && ['INITIALIZED', 'COMMITTING', 'COMMIT_ERROR'].includes(String(tx.status || ''))) {
      try {
        const tbk = config(tx.environment);
        const response = await fetch(`${tbk.api}/${encodeURIComponent(tx.token_ws)}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Tbk-Api-Key-Id': tbk.commerceCode,
            'Tbk-Api-Key-Secret': tbk.apiKey,
          },
        });
        if (response.ok) {
          const data: any = await response.json().catch(() => null);
          if (data) {
            const sameAmount = Number(data.amount) === Number(tx.amount);
            const sameOrder = String(data.buy_order || '') === String(tx.buy_order || '');
            const authorized = Number(data.response_code) === 0 && String(data.status || '').toUpperCase() === 'AUTHORIZED';
            if (sameAmount && sameOrder && authorized) {
              const group=await admin.from('transbank_transaction_items').select('pago_id').eq('transaction_id',tx.id).limit(21);
              if(group.error)return json({error:'No se pudo verificar detalle de la orden'},503);
              const grouped=(group.data?.length||0)>1;
              if(grouped){
                const settled=await admin.rpc('mx_webpay_settle_group',{p_transaction_id:tx.id,p_authorized_amount:Number(data.amount),p_authorized_order:String(data.buy_order)});
                if(settled.error)return json({ok:true,transaction:{id:tx.id,status:'COMMIT_ERROR',error_message:'GROUP_SETTLEMENT_REVIEW'}});
              }
              await admin.from('transbank_transactions').update({
                status: 'APPROVED',
                response_code: Number(data.response_code),
                authorization_code: data.authorization_code || null,
                payment_type_code: data.payment_type_code || null,
                installments_number: Number.isFinite(Number(data.installments_number)) ? Number(data.installments_number) : null,
                card_number: data.card_detail?.card_number || null,
                accounting_date: data.accounting_date || null,
                transaction_date: data.transaction_date || null,
                vci: data.vci || null,
                transbank_status: data.status || null,
                raw_response: { status: data },
                error_message: null,
                committed_at: tx.committed_at || new Date().toISOString(),
              }).eq('id', tx.id);
              const payment = grouped ? {data:null} : await admin.from('pagos').select('id,monto,monto_cuota,estado').eq('id', tx.pago_id).maybeSingle();
              const cuota = Math.max(0, Number(payment.data?.monto_cuota ?? payment.data?.monto ?? 0) || 0);
              if (payment.data && !['pagado', 'paid'].includes(String(payment.data.estado || '').toLowerCase())) {
                await admin.from('pagos').update({ estado: 'pagado', monto_pagado: cuota, metodo_pago: 'transbank', canal_recaudacion: 'webpay_plus', paid_at: new Date().toISOString() }).eq('id', tx.pago_id);
              }
              tx.status = 'APPROVED';
              tx.response_code = data.response_code;
              tx.authorization_code = data.authorization_code || null;
              tx.payment_type_code = data.payment_type_code || null;
              tx.transbank_status = data.status || null;
            } else if (['FAILED', 'REVERSED', 'NULLIFIED'].includes(String(data.status || '').toUpperCase())) {
              await admin.from('transbank_transactions').update({ status: 'REJECTED', transbank_status: data.status || null, response_code: Number.isFinite(Number(data.response_code)) ? Number(data.response_code) : null, raw_response: { status: data } }).eq('id', tx.id);
              tx.status = 'REJECTED';
              tx.transbank_status = data.status || null;
            }
          }
        }
      } catch (_) {}
    }

    const composition=await admin.from('transbank_transaction_items').select('pago_id').eq('transaction_id',tx.id).limit(2);
    if(composition.error)return json({error:'No se pudo verificar composición de la orden'},503);
    const is_group=(composition.data?.length||0)>1;
    return json({
      ok: true,
      transaction: {
        id: tx.id,
        is_group,
        pago_id: tx.pago_id,
        status: tx.status,
        amount: Number(tx.amount),
        response_code: tx.response_code,
        authorization_code: tx.authorization_code,
        payment_type_code: tx.payment_type_code,
        installments_number: tx.installments_number,
        card_number: tx.card_number,
        transaction_date: tx.transaction_date,
        transbank_status: tx.transbank_status,
        environment: tx.environment,
        created_at: tx.created_at,
        committed_at: tx.committed_at,
        error_message: tx.error_message,
      }
    });
  } catch (error) {
    console.error('webpay-status', error);
    return json({ error: (error as Error)?.message || 'No se pudo consultar la transacción.' }, 500);
  }
});
