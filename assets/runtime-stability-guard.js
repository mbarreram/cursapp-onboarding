/* MiCursoX · guardia global de estabilidad post-login.
   Se ejecuta antes de core.js para impedir ciclos entre hidratación y refresco de pagos. */
(function(){
  'use strict';
  if(window.__MICURSOX_RUNTIME_STABILITY_GUARD_V2__) return;
  window.__MICURSOX_RUNTIME_STABILITY_GUARD_V2__ = true;

  const operationalKey = /(?:supabase-operational|tasks_v1|payments_v1|profiles_v1|enrollments_v1|avisos_v2)$/i;
  const recentEvents = new Map();

  function shouldSuppressEvent(event){
    try{
      const type = String(event && event.type || '');
      if(type !== 'cursapp:dataChanged' && type !== 'cursapp:dataUpdated') return false;

      const detail = event && event.detail || {};
      const key = String(detail.key || '');
      const source = String(detail.source || '').toLowerCase();

      // Las escrituras de hidratación ya están disponibles en caché. Volver a disparar
      // el refresco de pagos desde ellas genera un ciclo infinito en todos los roles.
      if(source.includes('supabase') || source.includes('hydrate')) return true;
      if(key === 'supabase-operational') return true;

      // Evitar ráfagas duplicadas causadas por los dos wrappers de setItem en core.js.
      const signature = type + '|' + key;
      const now = Date.now();
      const previous = recentEvents.get(signature) || 0;
      recentEvents.set(signature, now);
      if(operationalKey.test(key) && now - previous < 1200) return true;
    }catch(_e){}
    return false;
  }

  try{
    const nativeDispatch = window.dispatchEvent.bind(window);
    window.dispatchEvent = function(event){
      if(shouldSuppressEvent(event)) return true;
      return nativeDispatch(event);
    };
  }catch(_e){}

  // Registrar los listeners posteriores a este archivo con un filtro de seguridad.
  try{
    const nativeAdd = window.addEventListener.bind(window);
    window.addEventListener = function(type, listener, options){
      if((type === 'cursapp:dataChanged' || type === 'cursapp:dataUpdated') && typeof listener === 'function'){
        const wrapped = function(event){
          if(shouldSuppressEvent(event)) return;
          return listener.call(this, event);
        };
        return nativeAdd(type, wrapped, options);
      }
      return nativeAdd(type, listener, options);
    };
  }catch(_e){}

  // No reescribir valores idénticos. core.js puede envolver esta función, pero la
  // escritura física seguirá siendo idempotente.
  try{
    const nativeSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value){
      const k = String(key == null ? '' : key);
      const v = String(value == null ? '' : value);
      try{ if(this.getItem(k) === v) return; }catch(_e){}
      return nativeSetItem.call(this, k, v);
    };
  }catch(_e){}

  function releaseLoading(){
    try{
      const overlay = document.getElementById('cursapp-loading-overlay');
      if(overlay) overlay.remove();
      document.documentElement.classList.add('cursapp-ready');
      if(document.body) document.body.classList.add('cursapp-ready');
    }catch(_e){}
  }

  // El overlay nunca debe quedar permanente si Supabase falla o una respuesta se demora.
  document.addEventListener('DOMContentLoaded', function(){ setTimeout(releaseLoading, 6500); }, {once:true});
  window.addEventListener('load', function(){ setTimeout(releaseLoading, 3500); }, {once:true});
  setTimeout(releaseLoading, 9000);
})();