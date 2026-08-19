(function(){
  'use strict';
  if(window.__MICURSOX_BUSINESS_DATA_AUTHORITY_V1__) return;
  window.__MICURSOX_BUSINESS_DATA_AUTHORITY_V1__ = true;

  window.MICURSOX_BUSINESS_SOURCE = 'supabase';

  function role(){
    const body = document.body;
    if(body?.classList.contains('cursapp-apoderado')) return 'apoderado';
    if(body?.classList.contains('cursapp-presidente')) return 'presidente';
    if(body?.classList.contains('cursapp-tesorero')) return 'tesorero';
    try {
      return String(localStorage.getItem('cursapp_active_role_v1') || '').toLowerCase().trim();
    } catch (_) { return ''; }
  }

  // Los snapshots antiguos nunca deben repoblar pagos cuando la respuesta
  // autoritativa del servidor es vacía. Se eliminan al entrar a un rol.
  function purgeLegacyPaymentSnapshots(){
    try {
      const remove = [];
      for(let i=0;i<localStorage.length;i++){
        const key = localStorage.key(i) || '';
        if(key.indexOf('cursapp_payments_snapshot_v584_') === 0) remove.push(key);
      }
      remove.forEach(key => localStorage.removeItem(key));
    } catch (_) {}
  }

  let running = null;
  let lastRun = 0;
  async function refresh(reason, force){
    const now = Date.now();
    if(running) return running;
    if(!force && now - lastRun < 1200) return null;
    lastRun = now;

    running = (async function(){
      const currentRole = role();
      const jobs = [];

      try {
        // Hidratador operacional canónico: campañas, pagos y contexto desde BD.
        if(window.CURSAPP?.hydrateOperationalFromSupabase){
          jobs.push(Promise.resolve(window.CURSAPP.hydrateOperationalFromSupabase(reason || 'role-authority')));
        }

        // Apoderado mantiene su adaptador de forma visual, siempre leyendo BD.
        if(currentRole === 'apoderado' && window.CURSAPP_APODERADO_FINANCE?.hydrate){
          jobs.push(Promise.resolve(window.CURSAPP_APODERADO_FINANCE.hydrate()));
        }

        // Contexto/campañas legacy se rehidrata desde BD para la directiva.
        if((currentRole === 'presidente' || currentRole === 'tesorero') && window.CURSAPP?.hydrateSupabase){
          jobs.push(Promise.resolve(window.CURSAPP.hydrateSupabase()));
        }

        // Sólo Presidente puede crear pagos faltantes por RLS. Tesorero y
        // Apoderado únicamente consumen la hidratación operacional canónica.
        if(currentRole === 'presidente' && window.CURSAPP_PAYMENTS_V11?.refresh){
          jobs.push(Promise.resolve(window.CURSAPP_PAYMENTS_V11.refresh(reason || 'role-authority')));
        }

        // Rendiciones, cuenta e informes de directiva: BD -> caché visual.
        if((currentRole === 'presidente' || currentRole === 'tesorero') && window.CURSAPP_TREASURY?.hydrate){
          jobs.push(Promise.resolve(window.CURSAPP_TREASURY.hydrate()));
        }

        const settled = await Promise.allSettled(jobs);
        const ok = settled.some(item => item.status === 'fulfilled') || jobs.length === 0;
        if(ok) purgeLegacyPaymentSnapshots();
        try {
          window.dispatchEvent(new CustomEvent('micursox:business-authority-ready', {
            detail:{source:'supabase', role:currentRole, reason:reason || 'role-authority'}
          }));
        } catch (_) {}
        return settled;
      } finally {
        running = null;
      }
    })();
    return running;
  }

  purgeLegacyPaymentSnapshots();
  window.MICURSOX_REFRESH_BUSINESS_DATA = function(reason){ return refresh(reason || 'manual', true); };

  function boot(){
    refresh('bootstrap', true).catch(function(error){
      try { console.warn('MiCursoX business refresh', error); } catch (_) {}
    });
    // Segundo pase: algunos módulos legacy terminan su inicialización después.
    setTimeout(function(){ refresh('bootstrap-settled', true).catch(function(){}); }, 900);
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();

  window.addEventListener('pageshow', function(){ refresh('pageshow', false).catch(function(){}); });
  document.addEventListener('visibilitychange', function(){
    if(document.visibilityState === 'visible') refresh('visible', false).catch(function(){});
  });
})();
