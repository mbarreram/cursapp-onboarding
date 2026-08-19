(function(){
  'use strict';
  if(window.__MX_ONBOARDING_INVITE_RPC_FIX__) return;
  window.__MX_ONBOARDING_INVITE_RPC_FIX__ = true;

  const originalFetch = window.fetch.bind(window);
  const DRAFT_KEY = 'cursapp_onb_draft_v1';

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

  function isApoderadoMembershipInsert(url, init){
    try{
      const u = new URL(url, location.origin);
      if(!/\/rest\/v1\/miembros_curso$/i.test(u.pathname)) return false;
      if(String((init && init.method) || 'GET').toUpperCase() !== 'POST') return false;
      const body = JSON.parse((init && init.body) || '{}');
      return String(body.rol || '').toLowerCase() === 'apoderado';
    }catch(_){ return false; }
  }

  function loadDraft(){
    try{return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {};}catch(_){return {};}
  }

  async function authHeaders(api, init){
    const headers = new Headers((init && init.headers) || {});
    headers.set('apikey', api.publishableKey);
    headers.set('Content-Type', 'application/json');
    const token = typeof api.getAccessToken === 'function' ? await api.getAccessToken() : '';
    headers.set('Authorization', 'Bearer ' + (token || api.publishableKey));
    return headers;
  }

  window.fetch = async function(input, init){
    const url = getUrl(input);

    if(isApoderadoMembershipInsert(url, init)){
      try{
        const api = window.CURSAPP_SUPABASE;
        if(!api || !api.url || !api.publishableKey) return originalFetch(input, init);
        const row = JSON.parse((init && init.body) || '{}');
        const d = loadDraft();
        const invite = String(d.inviteCode || '').trim().toUpperCase();
        if(!invite) return originalFetch(input, init);

        const headers = await authHeaders(api, init);
        const res = await originalFetch(api.url + '/rest/v1/rpc/register_apoderado_by_invite', {
          method:'POST',
          headers,
          body:JSON.stringify({
            p_invite_code: invite,
            p_nombre_apoderado: row.nombre_apoderado || '',
            p_nombre_alumno: row.nombre_alumno || '',
            p_email: row.email || '',
            p_activacion_pagada: !!row.activacion_pagada
          })
        });
        const text = await res.text();
        return new Response(text || '[]', {
          status:res.status,
          statusText:res.statusText,
          headers:{'Content-Type':'application/json'}
        });
      }catch(err){
        try{console.warn('[MiCursoX] apoderado join RPC fallback', err);}catch(_){ }
        return originalFetch(input, init);
      }
    }

    const lookup = restLookupFromUrl(url);
    if(!lookup) return originalFetch(input, init);

    try{
      const api = window.CURSAPP_SUPABASE;
      if(!api || !api.url || !api.publishableKey) return originalFetch(input, init);

      const headers = await authHeaders(api, init);
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
