/* Mercado Escolar · puente de sesión Supabase v1
   Sincroniza la sesión autenticada central con el cliente SDK usado por Mercado. */
(function(){
  'use strict';

  async function syncMarketAuth(){
    try{
      const cfg=window.CURSAPP_SUPABASE||{};
      const client=(window.initCursappSupabase&&window.initCursappSupabase())||window.cursappSupabase;
      if(!client||!client.auth) return false;

      const current=await client.auth.getSession().catch(()=>null);
      if(current&&current.data&&current.data.session&&current.data.session.access_token) return true;

      const authKey=cfg.authSessionKey||'cursapp_supabase_auth_session_v1';
      let saved=null;
      try{ saved=JSON.parse(localStorage.getItem(authKey)||'null'); }catch(_){ saved=null; }
      if(!saved||!saved.access_token||!saved.refresh_token) return false;

      const applied=await client.auth.setSession({
        access_token:String(saved.access_token),
        refresh_token:String(saved.refresh_token)
      });
      if(applied&&applied.error) return false;

      const verify=await client.auth.getSession().catch(()=>null);
      return !!(verify&&verify.data&&verify.data.session&&verify.data.session.access_token);
    }catch(_){
      return false;
    }
  }

  window.CURSAPP_MARKET_AUTH_READY=syncMarketAuth();

  window.addEventListener('focus',function(){
    window.CURSAPP_MARKET_AUTH_READY=syncMarketAuth();
  });

  document.addEventListener('visibilitychange',function(){
    if(document.visibilityState==='visible') window.CURSAPP_MARKET_AUTH_READY=syncMarketAuth();
  });
})();
