(function(){
  'use strict';
  if(window.__MICURSOX_ONBOARDING_REST_AUTH_FIX__) return;
  window.__MICURSOX_ONBOARDING_REST_AUTH_FIX__ = true;

  const cfg = window.CURSAPP_SUPABASE;
  if(!cfg || !cfg.url || !cfg.publishableKey) return;

  const AUTH_SESSION_KEY = cfg.authSessionKey || 'cursapp_supabase_auth_session_v1';
  const URL = cfg.url;
  const KEY = cfg.publishableKey;

  function readSession(){
    try{
      const raw = localStorage.getItem(AUTH_SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    }catch(_){ return null; }
  }

  function expiredSoon(session){
    const exp = Number(session && session.expires_at || 0);
    return !!exp && exp <= Math.floor(Date.now()/1000) + 30;
  }

  async function refresh(session){
    if(!session || !session.refresh_token) return session;
    const res = await fetch(URL + '/auth/v1/token?grant_type=refresh_token', {
      method:'POST',
      headers:{ apikey:KEY, 'Content-Type':'application/json' },
      body:JSON.stringify({ refresh_token:session.refresh_token })
    });
    const text = await res.text();
    let data = null;
    try{ data = text ? JSON.parse(text) : null; }catch(_){ }
    if(!res.ok || !data || !data.access_token){
      throw new Error((data && (data.message || data.error_description || data.error)) || text || 'No se pudo renovar la sesión');
    }
    const next = {
      access_token:String(data.access_token),
      refresh_token:String(data.refresh_token || session.refresh_token || ''),
      expires_at:data.expires_at || (data.expires_in ? Math.floor(Date.now()/1000)+Number(data.expires_in) : null),
      user:data.user || session.user || null
    };
    try{ localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(next)); }catch(_){ }
    return next;
  }

  async function freshToken(){
    let session = readSession();
    if(!session || !session.access_token) return '';
    if(expiredSoon(session)) session = await refresh(session);
    return session && session.access_token ? String(session.access_token) : '';
  }

  async function request(path, options){
    const token = await freshToken();
    const opts = Object.assign({}, options || {});
    opts.headers = Object.assign({
      apikey:KEY,
      'Content-Type':'application/json',
      Prefer:'return=representation'
    }, opts.headers || {});
    if(token) opts.headers.Authorization = 'Bearer ' + token;
    else delete opts.headers.Authorization;

    const res = await fetch(URL + '/rest/v1/' + String(path || '').replace(/^\/+/,''), opts);
    const text = await res.text();
    let data = null;
    try{ data = text ? JSON.parse(text) : null; }catch(_){ data = text; }
    if(!res.ok){
      const msg = data && (data.message || data.error || data.details || data.hint);
      const err = new Error(msg || text || ('HTTP ' + res.status));
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  // Durante onboarding evitamos que una sesión SDK antigua tenga prioridad sobre
  // la sesión recién creada por signup/password. Conservamos el resto de helpers.
  try{
    window.CURSAPP_SUPABASE = Object.freeze(Object.assign({}, cfg, {
      getAccessToken:freshToken,
      request:request
    }));
  }catch(_){ }
})();
