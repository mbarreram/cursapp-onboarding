(function(){
  'use strict';
  if(window.__MICURSOX_APODERADO_PROFILE_NAV_FIX_V3__) return;
  window.__MICURSOX_APODERADO_PROFILE_NAV_FIX_V3__=true;

  let lastOpenAt=0;

  function isProfileControl(el){
    if(!el) return false;
    const text=String(el.textContent||'').replace(/\s+/g,' ').trim().toLowerCase();
    const href=String(el.getAttribute?.('href')||'').toLowerCase();
    const action=String(el.dataset?.action||'').toLowerCase();
    return text.includes('mi perfil')||action==='perfil'||action==='profile'||href.endsWith('/perfil.html')||href==='perfil.html';
  }

  function closeMenu(){
    const menu=document.getElementById('menuDropdown');
    if(menu){
      menu.style.display='none';
      menu.setAttribute('aria-hidden','true');
    }
  }

  function showProfile(){
    closeMenu();
    if(typeof window.go==='function'){
      window.go('profile');
      return true;
    }
    if(typeof window.renderProfile==='function'){
      window.renderProfile(false);
      return true;
    }
    return false;
  }

  function activate(event){
    const control=event.target&&event.target.closest?event.target.closest('button,a,[role="button"]'):null;
    if(!isProfileControl(control)) return;
    const now=Date.now();
    if(now-lastOpenAt<500){
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    lastOpenAt=now;
    event.preventDefault();
    event.stopPropagation();
    if(event.type!=='touchend') event.stopImmediatePropagation?.();
    if(showProfile()) return;
    try{ sessionStorage.setItem('cursapp_open_apoderado_profile','1'); }catch(_){ }
    window.location.assign('/apoderado.html#profile');
  }

  function bindDirect(){
    document.querySelectorAll('#menuDropdown button,#menuDropdown a,#menuDropdown [role="button"]').forEach(control=>{
      if(!isProfileControl(control)||control.dataset.mxProfileBound==='1') return;
      control.dataset.mxProfileBound='1';
      control.addEventListener('touchend',activate,{passive:false});
      control.addEventListener('click',activate);
    });
  }

  document.addEventListener('touchend',activate,{capture:true,passive:false});
  document.addEventListener('click',activate,true);
  new MutationObserver(bindDirect).observe(document.documentElement,{subtree:true,childList:true});
  document.addEventListener('DOMContentLoaded',bindDirect);

  window.addEventListener('load',()=>{
    bindDirect();
    let shouldOpen=false;
    try{ shouldOpen=location.hash==='#profile'||sessionStorage.getItem('cursapp_open_apoderado_profile')==='1'; }catch(_){ }
    if(!shouldOpen) return;
    try{ sessionStorage.removeItem('cursapp_open_apoderado_profile'); }catch(_){ }
    let tries=0;
    const timer=setInterval(()=>{
      if(showProfile()||++tries>30) clearInterval(timer);
    },100);
  });
})();