/* Cursapp · Supabase centralizado · Fase 0A
   La clave publishable es pública por diseño. Nunca agregar service_role aquí.
*/
(function () {
  'use strict';
  if (window.CURSAPP_SUPABASE) return;

  const URL = 'https://ngxistgymgdkoaiulfbq.supabase.co';
  const PUBLISHABLE_KEY = 'sb_publishable_bplGqj8tjkUacm9hFJnT8Q_SYhXis4Y';
  const PUSH_VAPID_PUBLIC_KEY = 'BE7xDVAgYInk9cXFtwvDEifmONHC8qrbJkCnM5u61GoIshQfuuiRtHlz6UVSkRAZJSgjm78QY52xO4ThBwI5Wnc';
  const AUTH_SESSION_KEY = 'cursapp_supabase_auth_session_v1';
  const SDK_STORAGE_KEY = 'cursapp_supabase_oauth_v1';
  const SESSION_LOOKUP_TIMEOUT_MS = 1200;
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  let refreshPromise = null;
  let notificationCourseCache = { key:'', id:null, at:0 };

  function readJson(key) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : null;
    } catch (_) {
      return null;
    }
  }

  function storedSession() {
    const direct = readJson(AUTH_SESSION_KEY);
    if (direct && direct.access_token) return direct;

    const sdk = readJson(SDK_STORAGE_KEY);
    if (sdk && sdk.access_token) return sdk;
    if (sdk && sdk.currentSession && sdk.currentSession.access_token) return sdk.currentSession;
    return null;
  }

  function sessionExpiresSoon(session) {
    const expiresAt = Number(session && session.expires_at);
    return Boolean(expiresAt) && expiresAt <= Math.floor(Date.now() / 1000) + 60;
  }

  function withTimeout(promise, timeoutMs, fallbackValue) {
    let timer = null;
    return Promise.race([
      Promise.resolve(promise),
      new Promise(function (resolve) {
        timer = setTimeout(function () { resolve(fallbackValue); }, timeoutMs);
      })
    ]).finally(function () {
      if (timer) clearTimeout(timer);
    });
  }

  async function refreshSession(session) {
    if (!session || !session.refresh_token) return session;
    if (refreshPromise) return refreshPromise;

    refreshPromise = (async function () {
      const response = await fetch(URL + '/auth/v1/token?grant_type=refresh_token', {
        method: 'POST',
        headers: {
          apikey: PUBLISHABLE_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ refresh_token: session.refresh_token })
      });
      const text = await response.text();
      let next = null;
      try { next = text ? JSON.parse(text) : null; } catch (_) { next = null; }
      if (!response.ok || !next || !next.access_token) return session;

      const normalized = {
        access_token: next.access_token,
        refresh_token: next.refresh_token || session.refresh_token,
        expires_at: next.expires_at || null,
        user: next.user || session.user || null
      };
      try { localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(normalized)); } catch (_) {}
      return normalized;
    })();

    try { return await refreshPromise; }
    finally { refreshPromise = null; }
  }

  async function getAccessToken() {
    try {
      if (window.cursappSupabase && window.cursappSupabase.auth) {
        const result = await withTimeout(
          window.cursappSupabase.auth.getSession(),
          SESSION_LOOKUP_TIMEOUT_MS,
          null
        );
        const token = result && result.data && result.data.session && result.data.session.access_token;
        if (token) return token;
      }
    } catch (_) {}

    let session = storedSession();
    if (sessionExpiresSoon(session)) session = await refreshSession(session);
    return session && session.access_token ? String(session.access_token) : '';
  }

  async function headers(extra) {
    const token = await getAccessToken();
    const result = Object.assign({
      apikey: PUBLISHABLE_KEY,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    }, extra || {});
    if (token) result.Authorization = 'Bearer ' + token;
    return result;
  }

  function appSession() {
    try { return JSON.parse(localStorage.getItem('cursapp_session_v1') || '{}') || {}; }
    catch (_) { return {}; }
  }

  function activeNotificationRole() {
    const session = appSession();
    const htmlRole = String(document.documentElement.getAttribute('data-role') || '').toLowerCase().trim();
    if (htmlRole) return htmlRole;
    const role = String(session.currentRole || session.activeRole || session.role || '').toLowerCase().trim();
    if (role) return role;
    const path = String(location.pathname || '').toLowerCase();
    if (path.includes('presidente')) return 'presidente';
    if (path.includes('tesorero')) return 'tesorero';
    if (path.includes('apoderado')) return 'apoderado';
    return null;
  }

  function activeCourseKey() {
    const session = appSession();
    try {
      return String(localStorage.getItem('cursapp_active_course_v1') || session.courseKey || session.activeCourseKey || '').trim();
    } catch (_) {
      return String(session.courseKey || session.activeCourseKey || '').trim();
    }
  }

  async function resolveNotificationCourseId() {
    const key = activeCourseKey();
    if (!key) return null;
    if (UUID_RE.test(key)) return key;
    if (notificationCourseCache.key === key && Date.now() - notificationCourseCache.at < 60000) {
      return notificationCourseCache.id;
    }
    const response = await fetch(URL + '/rest/v1/cursos?select=id,course_key&course_key=eq.' + encodeURIComponent(key) + '&limit=1', {
      method: 'GET',
      headers: await headers()
    });
    if (!response.ok) return null;
    const rows = await response.json().catch(function(){ return []; });
    const row = Array.isArray(rows) ? rows[0] : null;
    notificationCourseCache = { key:key, id:row && row.id ? row.id : null, at:Date.now() };
    return notificationCourseCache.id;
  }

  async function notificationContext() {
    return {
      curso_id: await resolveNotificationCourseId(),
      rol_destino: activeNotificationRole()
    };
  }

  async function request(path, options) {
    let finalPath = String(path || '').replace(/^\/+/, '');
    const opts = Object.assign({}, options || {});

    if (finalPath === 'rpc/get_my_notifications') {
      let body = {};
      try { body = opts.body ? JSON.parse(opts.body) : {}; } catch (_) {}
      const ctx = await notificationContext();
      finalPath = 'rpc/get_my_notifications_for_context';
      opts.method = 'POST';
      opts.body = JSON.stringify({
        p_curso_id: ctx.curso_id,
        p_rol_destino: ctx.rol_destino,
        p_limit: Number(body.p_limit || 100)
      });
    } else if (finalPath === 'rpc/mark_my_notifications_read') {
      let body = {};
      try { body = opts.body ? JSON.parse(opts.body) : {}; } catch (_) {}
      const ctx = await notificationContext();
      finalPath = 'rpc/mark_my_notifications_read_for_context';
      opts.method = 'POST';
      opts.body = JSON.stringify({
        p_ids: Array.isArray(body.p_ids) ? body.p_ids : [],
        p_curso_id: ctx.curso_id,
        p_rol_destino: ctx.rol_destino
      });
    }

    opts.headers = await headers(opts.headers);
    const response = await fetch(URL + '/rest/v1/' + finalPath, opts);
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; }
    if (!response.ok) {
      const message = data && (data.message || data.error || data.details || data.hint);
      const error = new Error(message || text || ('HTTP ' + response.status));
      error.status = response.status;
      error.data = data;
      throw error;
    }
    return data;
  }

  async function getCurrentUser() {
    const response = await fetch(URL + '/auth/v1/user', {
      method: 'GET',
      headers: await headers()
    });
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (_) { data = null; }
    if (!response.ok || !data || !data.id) {
      const message = data && (data.message || data.error || data.error_description);
      const error = new Error(message || 'La sesión expiró. Inicia sesión nuevamente.');
      error.status = response.status;
      throw error;
    }
    return data;
  }

  async function invokeFunction(name, options) {
    const response = await fetch(URL + '/functions/v1/' + encodeURIComponent(String(name || '')), {
      method: 'POST',
      headers: await headers(),
      body: JSON.stringify((options && options.body) || {})
    });
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; }
    if (!response.ok) {
      const message = data && (data.error || data.message || data.details);
      const error = new Error(message || text || ('HTTP ' + response.status));
      error.status = response.status;
      error.data = data;
      return { data: null, error };
    }
    return { data, error: null };
  }

  window.addEventListener('storage', function(e){
    if (e.key === 'cursapp_active_course_v1' || e.key === 'cursapp_session_v1') notificationCourseCache = {key:'',id:null,at:0};
  });
  window.addEventListener('cursapp:dataChanged', function(){ notificationCourseCache = {key:'',id:null,at:0}; });

  window.CURSAPP_SUPABASE = Object.freeze({
    url: URL,
    publishableKey: PUBLISHABLE_KEY,
    pushVapidPublicKey: PUSH_VAPID_PUBLIC_KEY,
    authSessionKey: AUTH_SESSION_KEY,
    sdkStorageKey: SDK_STORAGE_KEY,
    getAccessToken,
    getCurrentUser,
    headers,
    request,
    notificationContext,
    functions: Object.freeze({ invoke: invokeFunction })
  });
})();
