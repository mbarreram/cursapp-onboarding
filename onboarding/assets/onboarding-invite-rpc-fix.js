(function(){
  'use strict';
  if(window.__MX_ONBOARDING_INVITE_RPC_FIX__) return;
  window.__MX_ONBOARDING_INVITE_RPC_FIX__ = true;

  const originalFetch = window.fetch.bind(window);

  function getUrl(input){
    try{return typeof input === 'string' ? input : (input && input.url) || '';}catch(_){return '';}
  }

  function restLookupFromUrl(url){
    try{
      const u = new URL(url, location.origin);
      if(!/\/rest\/v1\/cursos$/i.test(u.pathname)) return null;

      const inviteRaw = String(u.searchParams.get('invite_code') || '');
      if(inviteRaw){
        const value = decodeURIComponent(inviteRaw.replace(/^eq\./i,'').trim()).toUpperCase();
        return value ? {kind:'invite', value} : null;
      }

      const courseKeyRaw = String(u.searchParams.get('course_key') || '');
      if(courseKeyRaw){
        const value = decodeURIComponent(courseKeyRaw.replace(/^eq\./i,'').trim());
        return value ? {kind:'course_key', value} : null;
      }
    }catch(_){ }
    return null;
  }

  window.fetch = async function(input, init){
    const url = getUrl(input);
    const lookup = restLookupFromUrl(url);
    if(!lookup) return originalFetch(input, init);

    try{
      const api = window.CURSAPP_SUPABASE;
      if(!api || !api.url || !api.publishableKey) return originalFetch(input, init);

      const headers = new Headers((init && init.headers) || {});
      headers.set('apikey', api.publishableKey);
      headers.set('Content-Type', 'application/json');

      const token = typeof api.getAccessToken === 'function' ? await api.getAccessToken() : '';
      headers.set('Authorization', 'Bearer ' + (token || api.publishableKey));

      const rpcName = lookup.kind === 'invite'
        ? 'lookup_course_by_invite_code'
        : 'lookup_course_by_course_key';
      const body = lookup.kind === 'invite'
        ? {p_code:lookup.value}
        : {p_course_key:lookup.value};

      const res = await originalFetch(api.url + '/rest/v1/rpc/' + rpcName, {
        method:'POST',
        headers,
        body:JSON.stringify(body)
      });

      const text = await res.text();
      if(!res.ok) return new Response(text, {status:res.status, statusText:res.statusText, headers:{'Content-Type':'application/json'}});

      let row = null;
      try{ row = text ? JSON.parse(text) : null; }catch(_){ row = null; }
      const payload = row ? [row] : [];
      return new Response(JSON.stringify(payload), {status:200, headers:{'Content-Type':'application/json'}});
    }catch(err){
      try{console.warn('[MiCursoX] onboarding course RPC fallback', err);}catch(_){ }
      return originalFetch(input, init);
    }
  };
})();
