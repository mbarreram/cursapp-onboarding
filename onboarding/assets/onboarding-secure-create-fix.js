(function(){
  'use strict';
  if(window.__MICURSOX_ONBOARDING_SECURE_CREATE_FIX__) return;
  window.__MICURSOX_ONBOARDING_SECURE_CREATE_FIX__ = true;

  const AUTH_SESSION_KEY = 'cursapp_supabase_auth_session_v1';
  const previousFetch = window.fetch.bind(window);

  function readSession(){
    for(const store of [sessionStorage, localStorage]){
      try{
        const raw = store.getItem(AUTH_SESSION_KEY);
        if(!raw) continue;
        const parsed = JSON.parse(raw);
        if(parsed && parsed.user && parsed.user.id) return parsed;
      }catch(_){ }
    }
    return null;
  }

  function requestUrl(input){
    try { return typeof input === 'string' ? input : (input && input.url) || ''; }
    catch(_) { return ''; }
  }

  function cloneInit(init){
    const out = Object.assign({}, init || {});
    if(init && init.headers) out.headers = new Headers(init.headers);
    return out;
  }

  function patchJsonBody(url, init){
    const method = String((init && init.method) || 'GET').toUpperCase();
    if(method !== 'POST' || !init || typeof init.body !== 'string') return init;
    if(!/\/rest\/v1\/(cursos|colegios)(?:\?|$)/i.test(url)) return init;

    let body;
    try { body = JSON.parse(init.body); } catch(_) { return init; }
    if(!body || Array.isArray(body) || typeof body !== 'object') return init;

    const session = readSession();
    const userId = session && session.user && session.user.id ? String(session.user.id) : '';
    const out = cloneInit(init);

    if(/\/rest\/v1\/cursos(?:\?|$)/i.test(url) && userId && !body.created_by){
      body.created_by = userId;
    }
    if(/\/rest\/v1\/colegios(?:\?|$)/i.test(url) && userId && typeof body.catalogo_oficial === 'undefined'){
      body.catalogo_oficial = false;
    }

    out.body = JSON.stringify(body);
    return out;
  }

  window.fetch = function(input, init){
    const url = requestUrl(input);
    return previousFetch(input, patchJsonBody(url, init));
  };

  // No dejar nuevamente un fallo silencioso en el botón Finalizar.
  window.addEventListener('unhandledrejection', function(ev){
    try{
      const btn = document.getElementById('btnNext');
      if(!btn || String(btn.textContent || '').toLowerCase().indexOf('final') === -1) return;
      const reason = ev && ev.reason;
      const msg = reason && reason.message ? reason.message : String(reason || 'Error inesperado');
      btn.disabled = false;
      btn.textContent = 'Finalizar';
      alert('No se pudo finalizar el registro.\n' + msg);
    }catch(_){ }
  });
})();
