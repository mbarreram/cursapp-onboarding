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
  function normalize(tab){
    var aliases={inicio:'home',pagos:'payments',payments_paid:'payments',reportes:'informes',conciliar:'conciliacion'};
    return aliases[String(tab||'').trim()]||String(tab||'').trim();
  }
  function clickTab(tab){
    tab=normalize(tab);if(!tab)return false;
    if(tab==='retiros'){
      var funds=document.querySelector('[data-mx-funds="1"]');
      if(funds){funds.click();return true}
    }
    var direct=document.querySelector('[data-tab="'+CSS.escape(tab)+'"]');
    if(direct){direct.click();return true}
    if(typeof window.go==='function'){
      try{window.go(tab);return true}catch(_){ }
    }
    return false;
  }
  function cleanup(){
    clearPending();
    try{history.replaceState(null,'',location.pathname+location.search)}catch(_){ }
  }
  function tryOpen(){
    var tab=requestedTab();if(!tab)return true;
    if(clickTab(tab)){setTimeout(cleanup,80);return true}
    return false;
  }
  function start(){
    var tries=0;
    function attempt(){
      if(tryOpen())return;
      if(++tries<40)setTimeout(attempt,150);
    }
    setTimeout(attempt,320);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  window.addEventListener('hashchange',function(){setTimeout(tryOpen,120)});
  window.MICURSOX_ROLE_ROUTE={openTab:function(tab){return clickTab(tab)}};
})();
