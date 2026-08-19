(function(){
  'use strict';
  if(window.__MX_ONBOARDING_INVITE_RPC_FIX__) return;
  window.__MX_ONBOARDING_INVITE_RPC_FIX__ = true;

  const originalFetch = window.fetch.bind(window);

  function getUrl(input){
    try{return typeof input === 'string' ? input : (input && input.url) || '';}catch(_){return '';}
  }

  function inviteCodeFromUrl(url){
    try{
      const u = new URL(url, location.origin);
      if(!/\/rest\/v1\/cursos$/i.test(u.pathname)) return '';
      const raw = String(u.searchParams.get('invite_code') || '');
      const value = raw.replace(/^eq\./i,'').trim();
      return decodeURIComponent(value).toUpperCase();
    }catch(_){ return ''; }
  }

  window.fetch = async function(input, init){
    const url = getUrl(input);
    const code = inviteCodeFromUrl(url);
    if(!code) return originalFetch(input, init);

    try{
      const api = window.CURSAPP_SUPABASE;
      if(!api || !api.url || !api.publishableKey) return originalFetch(input, init);

      const headers = new Headers((init && init.headers) || {});
      headers.set('apikey', api.publishableKey);
      headers.set('Content-Type', 'application/json');

      const token = typeof api.getAccessToken === 'function' ? await api.getAccessToken() : '';
      headers.set('Authorization', 'Bearer ' + (token || api.publishableKey));

      const res = await originalFetch(api.url + '/rest/v1/rpc/lookup_course_by_invite_code', {
        method:'POST',
        headers,
        body:JSON.stringify({p_code:code})
      });

      const text = await res.text();
      if(!res.ok) return new Response(text, {status:res.status, statusText:res.statusText, headers:{'Content-Type':'application/json'}});

      let row = null;
      try{ row = text ? JSON.parse(text) : null; }catch(_){ row = null; }
      const payload = row ? [row] : [];
      return new Response(JSON.stringify(payload), {status:200, headers:{'Content-Type':'application/json'}});
    }catch(err){
      try{console.warn('[MiCursoX] invite RPC fallback', err);}catch(_){ }
      return originalFetch(input, init);
    }
  };
})();
