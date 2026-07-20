import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Método no permitido.' }, 405);

  const url = Deno.env.get('SUPABASE_URL') || '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY') || '';
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY') || '';
  const subject = Deno.env.get('VAPID_SUBJECT') || '';
  if (!url || !anonKey || !publicKey || !privateKey || !subject) {
    return json({ error: 'Web Push aún no está configurado en el servidor.' }, 503);
  }

  const authorization = req.headers.get('Authorization') || '';
  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const auth = await caller.auth.getUser();
  const user = auth.data.user;
  if (!user) return json({ error: 'Sesión inválida.' }, 401);

  // RLS limita esta consulta exclusivamente a las suscripciones del llamador.
  const subscriptions = await caller.from('push_subscriptions')
    .select('id,endpoint,p256dh,auth')
    .eq('user_id', user.id)
    .eq('enabled', true);
  if (subscriptions.error) return json({ error: 'No se pudo consultar este dispositivo.' }, 500);

  webpush.setVapidDetails(subject, publicKey, privateKey);
  let sent = 0;
  let failed = 0;
  for (const subscription of subscriptions.data || []) {
    try {
      await webpush.sendNotification({
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      }, JSON.stringify({
        title: 'Cursapp',
        body: 'Las notificaciones push quedaron activadas correctamente.',
        url: '/',
        tag: 'cursapp-test',
      }));
      sent += 1;
    } catch (error) {
      failed += 1;
      const status = Number((error as { statusCode?: number }).statusCode || 0);
      if (status === 404 || status === 410) {
        await caller.from('push_subscriptions')
          .update({ enabled: false, updated_at: new Date().toISOString() })
          .eq('id', subscription.id);
      }
    }
  }

  return json({ ok: true, sent, failed, processed: (subscriptions.data || []).length });
});
