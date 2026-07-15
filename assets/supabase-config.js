/* Cursapp · Supabase centralizado · Fase 0A
   La clave publishable es pública por diseño. Nunca agregar service_role aquí.
*/
(function () {
  'use strict';
  if (window.CURSAPP_SUPABASE) return;

  const URL = 'https://ngxistgymgdkoaiulfbq.supabase.co';
  const PUBLISHABLE_KEY = 'sb_publishable_bplGqj8tjkUacm9hFJnT8Q_SYhXis4Y';
  const AUTH_SESSION_KEY = 'cursapp_supabase_auth_session_v1';
  const SDK_STORAGE_KEY = 'cursapp_supabase_oauth_v1';
  let refreshPromise = null;

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
        const result = await window.cursappSupabase.auth.getSession();
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

  async function request(path, options) {
    const opts = Object.assign({}, options || {});
    opts.headers = await headers(opts.headers);
    const response = await fetch(URL + '/rest/v1/' + String(path || '').replace(/^\/+/, ''), opts);
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

  window.CURSAPP_SUPABASE = Object.freeze({
    url: URL,
    publishableKey: PUBLISHABLE_KEY,
    authSessionKey: AUTH_SESSION_KEY,
    sdkStorageKey: SDK_STORAGE_KEY,
    getAccessToken,
    headers,
    request
  });
})();
