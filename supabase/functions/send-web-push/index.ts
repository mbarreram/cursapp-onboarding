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
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY') || '';
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY') || '';
  const subject = Deno.env.get('VAPID_SUBJECT') || '';
  if (!url || !anonKey || !serviceKey || !publicKey || !privateKey || !subject) {
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

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const mode = String(body.mode || 'test');
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  let recipientIds = [user.id];
  let memberCount = 1;
  let courseId: string | null = null;
  if (mode === 'course') {
    courseId = String(body.curso_id || '').trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(courseId)) {
      return json({ error: 'Curso inválido.' }, 400);
    }

    const members = await admin.from('miembros_curso')
      .select('usuario_id,rol,estado')
      .eq('curso_id', courseId);
    if (members.error) return json({ error: 'No se pudieron consultar los integrantes del curso.' }, 500);

    const activeMembers = (members.data || []).filter((member) => {
      const state = String(member.estado || '').toLowerCase();
      return member.usuario_id && !/(eliminad|rechazad|bloquead|pendiente)/.test(state);
    });
    const sender = activeMembers.find((member) => member.usuario_id === user.id);
    const senderRole = String(sender?.rol || '').toLowerCase();
    if (!sender || !/(presidente|tesorero)/.test(senderRole)) {
      return json({ error: 'Sólo la directiva activa puede enviar notificaciones al curso.' }, 403);
    }

    const candidateIds = [...new Set(activeMembers.map((member) => String(member.usuario_id)))];
    const preferences = await admin.from('notification_preferences')
      .select('user_id,rol_destino,push_enabled')
      .in('user_id', candidateIds);
    const disabled = new Set(
      (preferences.data || [])
        .filter((preference) => preference.push_enabled === false)
        .map((preference) => `${preference.user_id}:${String(preference.rol_destino || '').toLowerCase()}`),
    );
    recipientIds = [...new Set(activeMembers
      .filter((member) => !disabled.has(`${member.usuario_id}:${String(member.rol || '').toLowerCase()}`))
      .map((member) => String(member.usuario_id)))];
    memberCount = recipientIds.length;
  }

  const subscriptions = await admin.from('push_subscriptions')
    .select('id,user_id,endpoint,p256dh,auth')
    .in('user_id', recipientIds)
    .eq('enabled', true);
  if (subscriptions.error) return json({ error: 'No se pudo consultar este dispositivo.' }, 500);

  webpush.setVapidDetails(subject, publicKey, privateKey);
  let sent = 0;
  let failed = 0;
  const title = String(body.title || 'Cursapp').slice(0, 80);
  const message = String(body.body || (mode === 'course'
    ? 'Tienes una nueva notificación de tu curso.'
    : 'Las notificaciones push quedaron activadas correctamente.')).slice(0, 240);
  const destination = String(body.url || '/').startsWith('/') ? String(body.url || '/') : '/';
  const tag = String(body.tag || (mode === 'course' ? `cursapp-course-${courseId}` : 'cursapp-test')).slice(0, 100);
  for (const subscription of subscriptions.data || []) {
    try {
      await webpush.sendNotification({
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      }, JSON.stringify({
        title,
        body: message,
        url: destination,
        tag,
      }));
      sent += 1;
    } catch (error) {
      failed += 1;
      const status = Number((error as { statusCode?: number }).statusCode || 0);
      if (status === 404 || status === 410) {
        await admin.from('push_subscriptions')
          .update({ enabled: false, updated_at: new Date().toISOString() })
          .eq('id', subscription.id);
      }
    }
  }

  return json({
    ok: true,
    mode,
    sent,
    failed,
    processed: (subscriptions.data || []).length,
    recipients: memberCount,
    recipients_without_device: Math.max(0, memberCount - new Set((subscriptions.data || []).map((item) => item.user_id)).size),
  });
});
