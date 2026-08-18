(function(){
  'use strict';
  if(window.__MICURSOX_ONBOARDING_AUTH_SESSION_FIX__) return;
  window.__MICURSOX_ONBOARDING_AUTH_SESSION_FIX__ = true;

  const AUTH_SESSION_KEY='cursapp_supabase_auth_session_v1';
  const originalFetch=window.fetch.bind(window);

  function isAuthSessionUrl(input){
    try{
      const url=typeof input==='string'?input:(input&&input.url)||'';
      return /\/auth\/v1\/(signup|token\?grant_type=password)/i.test(String(url));
    }catch(_){return false;}
  }

  function persistSession(payload){
    try{
      if(!payload||!payload.access_token) return;
      const expiresAt=payload.expires_at || (payload.expires_in?Math.floor(Date.now()/1000)+Number(payload.expires_in):null);
      const session={
        access_token:String(payload.access_token),
        refresh_token:String(payload.refresh_token||''),
        expires_at:expiresAt,
        user:payload.user||null
      };
      localStorage.setItem(AUTH_SESSION_KEY,JSON.stringify(session));
      try{sessionStorage.setItem(AUTH_SESSION_KEY,JSON.stringify(session));}catch(_){ }
    }catch(_){ }
  }

  window.fetch=async function(input,init){
    const response=await originalFetch(input,init);
    if(isAuthSessionUrl(input)&&response&&response.ok){
      try{
        const clone=response.clone();
        const data=await clone.json();
        persistSession(data);
      }catch(_){ }
    }
    return response;
  };

  document.addEventListener('click',function(ev){
    const btn=ev.target&&ev.target.closest?ev.target.closest('button'):null;
    if(!btn) return;
    if(String(btn.textContent||'').trim().toLowerCase()!=='finalizar') return;
    setTimeout(function(){
      try{
        if(btn.disabled){
          btn.dataset.mxOldText=btn.dataset.mxOldText||btn.textContent;
          btn.textContent='Finalizando…';
        }
      }catch(_){ }
    },0);
  },true);
})();
