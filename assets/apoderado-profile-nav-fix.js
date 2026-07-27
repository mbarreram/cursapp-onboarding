(function(){
  'use strict';
  if(window.__MICURSOX_APODERADO_PROFILE_NAV_FIX__) return;
  window.__MICURSOX_APODERADO_PROFILE_NAV_FIX__=true;

  function isProfileControl(el){
    if(!el) return false;
    const text=String(el.textContent||'').replace(/\s+/g,' ').trim().toLowerCase();
    const href=String(el.getAttribute?.('href')||'').toLowerCase();
    const action=String(el.dataset?.action||'').toLowerCase();
    return text.includes('mi perfil')||action==='perfil'||action==='profile'||href.endsWith('/perfil.html')||href==='perfil.html';
  }

  function openIntegratedProfile(event){
    const control=event.target?.closest?.('button,a,[role="button"]');
    if(!isProfileControl(control)) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    const menu=document.getElementById('menuDropdown');
    if(menu) menu.style.display='none';
    try{
      if(typeof window.go==='function'){
        window.go('profile');
        return;
      }
      if(typeof window.renderProfile==='function'){
        window.renderProfile(false);
        return;
      }
      sessionStorage.setItem('cursapp_open_apoderado_profile','1');
    }catch(_){ }
    window.location.assign('/apoderado.html#profile');
  }

  document.addEventListener('click',openIntegratedProfile,true);
  window.addEventListener('load',()=>{
    const shouldOpen=location.hash==='#profile'||sessionStorage.getItem('cursapp_open_apoderado_profile')==='1';
    if(!shouldOpen) return;
    sessionStorage.removeItem('cursapp_open_apoderado_profile');
    setTimeout(()=>{
      if(typeof window.go==='function') window.go('profile');
      else if(typeof window.renderProfile==='function') window.renderProfile(false);
    },150);
  });
})();