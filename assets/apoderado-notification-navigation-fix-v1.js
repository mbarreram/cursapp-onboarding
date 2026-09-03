(function(){
  'use strict';
  if(window.__MICURSOX_APO_NOTIFICATION_NAV_FIX__) return;
  window.__MICURSOX_APO_NOTIFICATION_NAV_FIX__=true;

  function sameViewTarget(raw){
    try{
      var target=new URL(String(raw||''),location.href);
      return target.origin===location.origin && target.pathname===location.pathname;
    }catch(_){return false}
  }

  function openInternal(raw){
    var target;
    try{target=new URL(String(raw||''),location.href)}catch(_){return false}
    if(target.origin!==location.origin||target.pathname!==location.pathname)return false;
    var tab=String(target.hash||'').replace(/^#/,'').trim();
    if(!tab)return true;
    var bridge=window.MICURSOX_ROLE_ROUTE;
    if(bridge&&typeof bridge.openTab==='function'){
      try{if(bridge.openTab(tab))return true}catch(_){ }
    }
    try{
      if(location.hash!==target.hash) location.hash=target.hash;
      else window.dispatchEvent(new HashChangeEvent('hashchange'));
      return true;
    }catch(_){return false}
  }

  document.addEventListener('click',async function(e){
    var item=e.target&&e.target.closest?e.target.closest('#cnOverlay .cnItem[data-id]'):null;
    if(!item)return;
    e.preventDefault();
    e.stopPropagation();
    if(typeof e.stopImmediatePropagation==='function')e.stopImmediatePropagation();
    if(item.dataset.navBusy==='1')return;
    item.dataset.navBusy='1';
    item.disabled=true;

    try{
      var api=window.CURSAPP_NOTIFICATIONS;
      if(item.classList.contains('unread')&&api&&typeof api.mark==='function'){
        await api.mark([item.dataset.id]);
      }
      var url=String(item.dataset.url||'').trim();
      document.getElementById('cnOverlay')?.remove();
      if(!url||url==='#')return;
      if(sameViewTarget(url)&&openInternal(url))return;
      location.assign(url);
    }catch(err){
      item.dataset.navBusy='0';
      item.disabled=false;
      console.error('Navegación de notificación:',err);
      alert(err&&err.message?err.message:'No se pudo abrir la notificación');
    }
  },true);
})();
