(function(){
  'use strict';
  if(window.__APODERADO_DESKTOP_MODULE_STATE__) return;
  window.__APODERADO_DESKTOP_MODULE_STATE__ = true;

  const mq = window.matchMedia('(min-width:1024px)');
  let timer = 0;

  function detectModule(){
    if(!mq.matches){
      document.body.removeAttribute('data-apo-module');
      return;
    }

    const hash = String(location.hash || '').toLowerCase();
    const app = document.getElementById('app');
    const firstTitle = String(app?.querySelector('.kTitle')?.textContent || '').toLowerCase();
    let module = 'home';

    if(hash.includes('payment') || hash.includes('pago') || /^pagos\b/.test(firstTitle)) module = 'payments';
    else if(hash.includes('informe') || /^informes\b/.test(firstTitle)) module = 'informes';
    else if(hash.includes('profile') || hash.includes('perfil')) module = 'profile';

    if(document.body.getAttribute('data-apo-module') !== module){
      document.body.setAttribute('data-apo-module',module);
    }
  }

  function schedule(){
    clearTimeout(timer);
    timer = setTimeout(detectModule,40);
  }

  function boot(){
    detectModule();
    const app = document.getElementById('app');
    if(app){
      const observer = new MutationObserver(schedule);
      observer.observe(app,{childList:true,subtree:false});
    }
    window.addEventListener('hashchange',schedule);
    window.addEventListener('popstate',schedule);
    mq.addEventListener?.('change',schedule);
    document.addEventListener('click',function(ev){
      if(ev.target.closest('[data-tab],#menuDropdown,.apoV42MenuItem')) schedule();
    },true);
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
