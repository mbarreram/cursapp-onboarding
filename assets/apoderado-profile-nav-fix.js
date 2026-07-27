(function(){
  'use strict';
  if(window.__MICURSOX_APODERADO_PROFILE_NAV_FIX__) return;
  window.__MICURSOX_APODERADO_PROFILE_NAV_FIX__=true;

  function isProfileControl(el){
    if(!el) return false;
    const text=String(el.textContent||'').replace(/\s+/g,' ').trim().toLowerCase();
    const href=String(el.getAttribute?.('href')||'').toLowerCase();
    return text.includes('mi perfil')||href.endsWith('/perfil.html')||href==='perfil.html';
  }

  function openProfile(event){
    const control=event.target?.closest?.('button,a,[role="button"]');
    if(!isProfileControl(control)) return;
    event.preventDefault();
    event.stopPropagation();
    try{
      const menu=document.getElementById('menuDropdown');
      if(menu) menu.style.display='none';
    }catch(_){ }
    window.location.assign('/perfil.html');
  }

  document.addEventListener('click',openProfile,true);
  document.addEventListener('touchend',openProfile,{capture:true,passive:false});
})();