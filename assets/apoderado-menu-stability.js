(function(){
  'use strict';
  if(window.__MICURSOX_APODERADO_MENU_STABILITY__) return;
  window.__MICURSOX_APODERADO_MENU_STABILITY__=true;

  const TAB_KEY='micursox_apoderado_last_tab_v1';
  let lastPointerAt=0;

  function closeMenu(){
    const menu=document.getElementById('menuDropdown');
    if(menu){
      menu.style.display='none';
      menu.setAttribute('aria-hidden','true');
    }
  }

  function normalizeAction(control){
    const raw=String(control?.dataset?.action||'').trim().toLowerCase();
    if(raw) return raw;
    const text=String(control?.textContent||'').replace(/\s+/g,' ').trim().toLowerCase();
    if(text.includes('mi perfil')) return 'profile';
    if(text.includes('mercado escolar')) return 'market';
    if(text.includes('informes')) return 'informes';
    if(text.includes('pagos')) return 'payments';
    if(text==='inicio'||text.includes(' inicio')) return 'home';
    if(text.includes('notificaciones')) return 'avisos';
    if(text.includes('ayuda')) return 'ayuda';
    if(text.includes('cerrar sesión')) return 'logout';
    if(text.includes('ir a tesorero')) return 'tesorero';
    if(text.includes('ir a presidente')) return 'presidente';
    return '';
  }

  function runAction(action){
    closeMenu();
    if(action==='home'||action==='payments'||action==='informes'||action==='profile'||action==='perfil'){
      const tab=action==='perfil'?'profile':action;
      try{ sessionStorage.setItem(TAB_KEY,tab); }catch(_){ }
      if(typeof window.go==='function'){
        window.go(tab);
        return true;
      }
      if(tab==='profile'&&typeof window.renderProfile==='function'){
        window.renderProfile(false);
        return true;
      }
      return false;
    }
    if(action==='market'){
      window.location.assign('/mercado-escolar/mercado-escolar.html');
      return true;
    }
    if(action==='avisos'){
      if(typeof window.openAvisosInbox==='function') window.openAvisosInbox();
      return true;
    }
    if(action==='ayuda'){
      if(typeof window.openHelp==='function') window.openHelp('general');
      else if(typeof window.openHelpFallback==='function') window.openHelpFallback();
      return true;
    }
    if(action==='tesorero'){
      window.location.assign('/tesorero.html');
      return true;
    }
    if(action==='presidente'){
      window.location.assign('/presidente.html');
      return true;
    }
    if(action==='logout'){
      if(typeof window.logout==='function') window.logout();
      return true;
    }
    return false;
  }

  function handleMenuEvent(event){
    const menu=document.getElementById('menuDropdown');
    if(!menu) return;
    const control=event.target?.closest?.('button,a,[role="button"]');
    if(!control||!menu.contains(control)) return;
    const action=normalizeAction(control);
    if(!action) return;

    if(event.type==='pointerup') lastPointerAt=Date.now();
    if(event.type==='click'&&Date.now()-lastPointerAt<650) return;

    event.preventDefault();
    event.stopPropagation();
    runAction(action);
  }

  document.addEventListener('pointerup',handleMenuEvent,true);
  document.addEventListener('click',handleMenuEvent,true);

  document.addEventListener('click',event=>{
    const tabControl=event.target?.closest?.('.navItem[data-tab]');
    if(!tabControl) return;
    try{ sessionStorage.setItem(TAB_KEY,String(tabControl.dataset.tab||'home')); }catch(_){ }
  },false);

  function recoverView(){
    const app=document.getElementById('app');
    if(!app||app.childElementCount>0||String(app.textContent||'').trim()) return;
    let tab='home';
    try{ tab=sessionStorage.getItem(TAB_KEY)||'home'; }catch(_){ }
    requestAnimationFrame(()=>{
      if(typeof window.go==='function') window.go(tab);
      else if(tab==='profile'&&typeof window.renderProfile==='function') window.renderProfile(false);
    });
  }

  window.addEventListener('pageshow',()=>setTimeout(recoverView,80));
  window.addEventListener('focus',()=>setTimeout(recoverView,120));
  document.addEventListener('visibilitychange',()=>{
    if(!document.hidden) setTimeout(recoverView,120);
  });

  window.addEventListener('load',()=>setTimeout(recoverView,250));
})();
