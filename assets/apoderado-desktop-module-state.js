(function(){
  'use strict';
  if(window.__APODERADO_DESKTOP_MODULE_STATE_V2__) return;
  window.__APODERADO_DESKTOP_MODULE_STATE_V2__ = true;

  const mq = window.matchMedia('(min-width:1024px)');
  let timer = 0;

  function setModule(module){
    if(!document.body) return;
    const current = document.body.getAttribute('data-apo-module');
    if(current !== module) document.body.setAttribute('data-apo-module', module);
  }

  function detectModule(){
    if(!document.body) return;
    if(!mq.matches){
      if(document.body.hasAttribute('data-apo-module')) document.body.removeAttribute('data-apo-module');
      return;
    }

    const app = document.getElementById('app');
    const activeNav = document.querySelector('.navItem.active[data-tab]');
    const activeTab = String(activeNav?.dataset?.tab || '').toLowerCase();
    const hash = String(location.hash || '').toLowerCase();
    const text = String(app?.textContent || '').toLowerCase();
    let module = 'home';

    if(activeTab === 'payments') module = 'payments';
    else if(activeTab === 'informes') module = 'informes';
    else if(activeTab === 'profile' || activeTab === 'perfil') module = 'profile';
    else if(app?.querySelector('.apoPayPage')) module = 'payments';
    else if(app?.querySelector('.apoReportPage')) module = 'informes';
    else if(hash.includes('payment') || hash.includes('pago')) module = 'payments';
    else if(hash.includes('informe') || text.includes('informe apoderado')) module = 'informes';
    else if(hash.includes('profile') || hash.includes('perfil')) module = 'profile';

    setModule(module);
  }

  function schedule(delay){
    clearTimeout(timer);
    timer = setTimeout(detectModule, typeof delay === 'number' ? delay : 25);
  }

  function boot(){
    detectModule();
    const app = document.getElementById('app');
    if(app){
      const observer = new MutationObserver(function(){ schedule(24); });
      observer.observe(app,{childList:true,subtree:true});
    }
    const nav = document.querySelector('.bottomNav');
    if(nav){
      const navObserver = new MutationObserver(function(){ schedule(0); });
      navObserver.observe(nav,{attributes:true,subtree:true,attributeFilter:['class']});
    }
    window.addEventListener('hashchange',function(){ schedule(0); });
    window.addEventListener('popstate',function(){ schedule(0); });
    mq.addEventListener?.('change',function(){ schedule(0); });
    document.addEventListener('click',function(ev){
      if(ev.target.closest('[data-tab],#menuDropdown,.apoV42MenuItem')){
        schedule(0);
        setTimeout(detectModule,120);
      }
    },true);
    setTimeout(detectModule,300);
    setTimeout(detectModule,1200);
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();