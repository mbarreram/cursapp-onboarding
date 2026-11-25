import { createClient } from 'npm:@supabase/supabase-js@2';

const INTEGRATION_COMMERCE_CODE = '597055555532';
const INTEGRATION_API_KEY = '579B532A7440BB0C9079DED94D31EA1615BACEB56610332264630D42D0A36B1C';
const INTEGRATION_API = 'https://webpay3gint.transbank.cl/rswebpaytransaction/api/webpay/v1.2/transactions';
const PRODUCTION_API = 'https://webpay3g.transbank.cl/rswebpaytransaction/api/webpay/v1.2/transactions';

function config(envValue?: string | null) {
  const env = String(envValue || Deno.env.get('TBK_ENV') || 'integration').toLowerCase();
  if (env === 'production') {
    const commerceCode = String(Deno.env.get('TBK_COMMERCE_CODE') || '');
    const apiKey = String(Deno.env.get('TBK_API_KEY') || '');
    if (!commerceCode || !apiKey) throw new Error('Credenciales productivas de Transbank no configuradas.');
    return { env: 'production', commerceCode, apiKey, api: PRODUCTION_API };
  }
  return { env: 'integration', commerceCode: INTEGRATION_COMMERCE_CODE, apiKey: INTEGRATION_API_KEY, api: INTEGRATION_API };
}

function appBase() {
  const raw = String(Deno.env.get('MICURSOX_APP_URL') || Deno.env.get('APP_BASE_URL') || 'https://cursapp-onboarding.pages.dev').trim();
  return raw.replace(/\/$/, '');
}

function redirect(path: string) {
  return new Response(null, { status: 302, headers: { Location: appBase() + path, 'Cache-Control': 'no-store' } });
}

async function parseBody(req: Request) {
  const ct = String(req.headers.get('content-type') || '').toLowerCase();
  const raw = await req.text();
  if (ct.includes('application/json')) {
    try { return JSON.parse(raw || '{}') as Record<string, unknown>; } catch (_) { return {}; }
  }
  const params = new URLSearchParams(raw || '');
  return Object.fromEntries(params.entries());
}

function safePath(params: Record<string, string>) {
  const sp = new URLSearchParams(params);
  return '/pay_result.html?' + sp.toString();
}

Deno.serve(async (req) => {
  if (req.method !== 'POST' && req.method !== 'GET') return new Response('Method Not Allowed', { status: 405 });

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!supabaseUrl || !serviceKey) return redirect(safePath({ ok: '0', reason: 'backend_not_configured' }));
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  try {
    const url = new URL(req.url);
    const body = req.method === 'POST' ? await parseBody(req) : Object.fromEntries(url.searchParams.entries());
    const token = String(body.token_ws || url.searchParams.get('token_ws') || '').trim();
    const tbkToken = String(body.TBK_TOKEN || '').trim();
    const cancelledBuy = String(body.TBK_ORDEN_COMPRA || '').trim();

    if (!token) {
      if (tbkToken || cancelledBuy) {
        let query = admin.from('transbank_transactions').select('id,pago_id,user_id,buy_order,status').limit(1);
        if (cancelledBuy) query = query.eq('buy_order', cancelledBuy);
        const found = await query.maybeSingle();
        if (found.data) {
          await admin.from('transbank_transactions').update({ status: 'CANCELLED', error_message: 'Usuario canceló o abandonó el flujo Webpay.' }).eq('id', found.data.id);
          return redirect(safePath({ ok: '0', pid: found.data.pago_id, tx: found.data.id, reason: 'cancelled' }));
        }
      }
      return redirect(safePath({ ok: '0', reason: 'no_token_ws' }));
    }

    const txQuery = await admin.from('transbank_transactions')
      .select('*')
      .eq('token_ws', token)
      .maybeSingle();
    if (txQuery.error || !txQuery.data) return redirect(safePath({ ok: '0', reason: 'unknown_transaction' }));
    const tx: any = txQuery.data;

    if (tx.status === 'APPROVED') {
      return redirect(safePath({ ok: '1', pid: tx.pago_id, tx: tx.id }));
    }
    if (tx.status === 'REJECTED' || tx.status === 'CANCELLED') {
      return redirect(safePath({ ok: '0', pid: tx.pago_id, tx: tx.id, reason: String(tx.status).toLowerCase() }));
    }

    const lock = await admin.from('transbank_transactions')
      .update({ status: 'COMMITTING' })
      .eq('id', tx.id)
      .in('status', ['INITIALIZED', 'CREATE_ERROR'])
      .select('id');
    if (!lock.data || lock.data.length === 0) {
      return redirect(safePath({ ok: '0', pid: tx.pago_id, tx: tx.id, reason: 'processing' }));
    }

    const tbk = config(tx.environment);
    const response = await fetch(`${tbk.api}/${encodeURIComponent(token)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Tbk-Api-Key-Id': tbk.commerceCode,
        'Tbk-Api-Key-Secret': tbk.apiKey,
      },
    });
    const text = await response.text();
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch (_) { data = null; }

    if (!response.ok || !data) {
      await admin.from('transbank_transactions').update({ status: 'COMMIT_ERROR', error_message: text.slice(0, 500) }).eq('id', tx.id);
      return redirect(safePath({ ok: '0', pid: tx.pago_id, tx: tx.id, reason: 'commit_error' }));
    }

    const sameAmount = Number(data.amount) === Number(tx.amount);
    const sameOrder = String(data.buy_order || '') === String(tx.buy_order || '');
    const authorized = Number(data.response_code) === 0 && String(data.status || '').toUpperCase() === 'AUTHORIZED';
    const approved = sameAmount && sameOrder && authorized;

    const groupRows = await admin.from('transbank_transaction_items').select('pago_id').eq('transaction_id',tx.id).limit(21);
    if(groupRows.error) return redirect(safePath({ok:'0',pid:tx.pago_id,tx:tx.id,reason:'group_lookup_error'}));
    const isGroup = (groupRows.data?.length || 0) > 1;
    if(isGroup && approved){
      const finalized=await admin.rpc('mx_webpay_settle_group',{p_transaction_id:tx.id,p_authorized_amount:Number(data.amount),p_authorized_order:String(data.buy_order)});
      if(finalized.error){
        await admin.from('transbank_transactions').update({status:'COMMIT_ERROR',error_message:'GROUP_SETTLEMENT_REVIEW'}).eq('id',tx.id);
        return redirect(safePath({ok:'0',pid:tx.pago_id,tx:tx.id,reason:'group_settlement_review'}));
      }
    }

    await admin.from('transbank_transactions').update({
      status: approved ? 'APPROVED' : 'REJECTED',
      response_code: Number.isFinite(Number(data.response_code)) ? Number(data.response_code) : null,
      authorization_code: data.authorization_code || null,
      payment_type_code: data.payment_type_code || null,
      installments_number: Number.isFinite(Number(data.installments_number)) ? Number(data.installments_number) : null,
      card_number: data.card_detail?.card_number || null,
      accounting_date: data.accounting_date || null,
      transaction_date: data.transaction_date || null,
      vci: data.vci || null,
      transbank_status: data.status || null,
      raw_response: { commit: data },
      error_message: approved ? null : (!sameAmount ? 'Monto confirmado no coincide.' : !sameOrder ? 'Orden de compra no coincide.' : 'Transacción rechazada por Transbank.'),
      committed_at: new Date().toISOString(),
    }).eq('id', tx.id);

    if (approved && !isGroup) {
      const payment = await admin.from('pagos').select('id,curso_id,monto,monto_cuota,estado').eq('id', tx.pago_id).maybeSingle();
      const cuota = Math.max(0, Number(payment.data?.monto_cuota ?? payment.data?.monto ?? 0) || 0);
      if (payment.data && !['pagado', 'paid'].includes(String(payment.data.estado || '').toLowerCase())) {
        await admin.from('pagos').update({
          estado: 'pagado',
          monto_pagado: cuota,
          metodo_pago: 'transbank',
          canal_recaudacion: 'webpay_plus',
          paid_at: new Date().toISOString(),
        }).eq('id', tx.pago_id);
      }

      await admin.from('notifications').insert({
        user_id: tx.user_id,
        curso_id: tx.curso_id || null,
        rol_destino: 'apoderado',
        category: 'payment',
        title: 'Pago confirmado',
        message: `Tu pago por $${Number(tx.amount).toLocaleString('es-CL')} fue confirmado por Transbank.`,
        url_destino: '/apoderado.html#payments_paid',
        payload: { pago_id: tx.pago_id, transbank_transaction_id: tx.id, amount: tx.amount },
        is_read: false,
        delivery_state: 'created',
      });
    }

    return redirect(safePath({ ok: approved ? '1' : '0', pid: tx.pago_id, tx: tx.id, reason: approved ? 'approved' : 'rejected' }));
  } catch (error) {
    console.error('webpay-commit', error);
    return redirect(safePath({ ok: '0', reason: 'unexpected_error' }));
  }
});
