/* MiCursoX · guardia global de estabilidad post-login.
   Corta el ciclo: hydrate Supabase -> dataChanged -> refresh pagos -> hydrate. */
(function(){
  'use strict';
  if(window.__MICURSOX_RUNTIME_STABILITY_GUARD__) return;
  window.__MICURSOX_RUNTIME_STABILITY_GUARD__ = true;

  try{
    const nativeSetItem = Storage.prototype.setItem;
    localStorage.setItem = function(key, value){
      const k = String(key == null ? '' : key);
      const v = String(value == null ? '' : value);
      try{
        if(localStorage.getItem(k) === v) return;
      }catch(_e){}
      return nativeSetItem.call(localStorage, k, v);
    };
  }catch(_e){}

  try{
    const originalDispatch = window.dispatchEvent.bind(window);
    window.dispatchEvent = function(event){
      try{
        const type = String(event && event.type || '');
        const detail = event && event.detail || {};
        const key = String(detail.key || '');
        const source = String(detail.source || '');
        if((type === 'cursapp:dataChanged' || type === 'cursapp:dataUpdated') &&
           key === 'supabase-operational' && source === 'supabase'){
          return true;
        }
      }catch(_e){}
      return originalDispatch(event);
    };
  }catch(_e){}

  // El loading nunca debe bloquear indefinidamente aunque falle una consulta.
  function releaseLoading(){
    try{
      const overlay = document.getElementById('cursapp-loading-overlay');
      if(overlay) overlay.remove();
      document.body.classList.add('cursapp-ready');
    }catch(_e){}
  }
  window.addEventListener('load', function(){ setTimeout(releaseLoading, 7000); }, {once:true});
  setTimeout(releaseLoading, 10000);
})();
