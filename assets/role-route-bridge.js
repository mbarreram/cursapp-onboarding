(function(){
  'use strict';
  if(window.__MICURSOX_ROLE_ROUTE_BRIDGE__) return;
  window.__MICURSOX_ROLE_ROUTE_BRIDGE__=true;

  function requestedTab(){
    var h=String(location.hash||'').replace(/^#/,'').trim();
    if(h)return h;
    try{return String(sessionStorage.getItem('micursox_pending_tab')||'').trim()}catch(_){return''}
  }
  function clearPending(){try{sessionStorage.removeItem('micursox_pending_tab')}catch(_){ }}
  function tryOpen(){
    var tab=requestedTab();if(!tab)return true;
    var aliases={inicio:'home',pagos:'payments',reportes:'informes',conciliar:'conciliacion'};
    tab=aliases[tab]||tab;
    var direct=document.querySelector('[data-tab="'+CSS.escape(tab)+'"]');
    if(direct){direct.click();clearPending();try{history.replaceState(null,'',location.pathname+location.search)}catch(_){ }return true}
    if(tab==='retiros'){
      var funds=document.querySelector('[data-mx-funds="1"]');if(funds){funds.click();clearPending();try{history.replaceState(null,'',location.pathname+location.search)}catch(_){ }return true}
    }
    if(typeof window.go==='function'){
      try{window.go(tab);clearPending();try{history.replaceState(null,'',location.pathname+location.search)}catch(_){ }return true}catch(_){ }
    }
    return false;
  }
  var tries=0,timer=setInterval(function(){if(tryOpen()||++tries>30)clearInterval(timer)},120);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',tryOpen,{once:true});else setTimeout(tryOpen,0);
  window.addEventListener('hashchange',tryOpen);
})();
