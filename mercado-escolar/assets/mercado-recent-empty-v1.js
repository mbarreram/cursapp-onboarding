(function(){
  'use strict';
  if(window.__MICURSOX_MARKET_RECENT_EMPTY_V1__) return;
  window.__MICURSOX_MARKET_RECENT_EMPTY_V1__=true;

  const selector='#marketRecentList';
  const html=`<div class="emptyState marketRecentEmpty"><div class="emptyIcon">🛍️</div><h3>Aún no hay avisos recientes</h3><p>Cuando se publiquen nuevos avisos en la comunidad, aparecerán aquí.</p><button type="button" data-view="publicar">Publicar primer aviso</button></div>`;

  function apply(){
    const box=document.querySelector(selector);
    if(!box) return;
    const hasItems=!!box.querySelector('.recentItem,[data-post]');
    const hasEmpty=!!box.querySelector('.marketRecentEmpty');
    if(!hasItems && !hasEmpty && box.children.length===0) box.innerHTML=html;
    if(hasItems && hasEmpty) box.querySelector('.marketRecentEmpty')?.remove();
  }

  function boot(){
    const box=document.querySelector(selector);
    if(!box) return;
    apply();
    const obs=new MutationObserver(()=>apply());
    obs.observe(box,{childList:true,subtree:true});
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
