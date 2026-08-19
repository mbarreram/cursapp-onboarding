(function(){
  'use strict';
  if(window.__MX_APODERADO_PAYMENT_RETURN__) return;
  window.__MX_APODERADO_PAYMENT_RETURN__ = true;

  function shouldOpenPaid(){
    return String(location.hash || '').toLowerCase() === '#payments_paid';
  }

  function openPaid(){
    if(!shouldOpenPaid()) return false;
    try{
      if(typeof window.go === 'function') window.go('payments');
      if(typeof window.setPayFilter === 'function') window.setPayFilter('paid');
      document.querySelectorAll('.navItem').forEach(function(btn){
        btn.classList.toggle('active', String(btn.dataset.tab || '') === 'payments');
      });
      return typeof window.go === 'function' && typeof window.setPayFilter === 'function';
    }catch(_){ return false; }
  }

  function boot(){
    if(!shouldOpenPaid()) return;
    let tries = 0;
    const timer = setInterval(function(){
      tries += 1;
      if(openPaid() || tries >= 40) clearInterval(timer);
    }, 100);
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();
  window.addEventListener('hashchange', openPaid);
})();
