(function(){
  'use strict';
  if(window.__MICURSOX_APODERADO_MENU_CAPTURE__) return;
  window.__MICURSOX_APODERADO_MENU_CAPTURE__=true;

  let lastTouchAt=0;

  function closeMenu(){
    const menu=document.getElementById('menuDropdown');
    if(menu){
      menu.style.display='none';
      menu.setAttribute('aria-hidden','true');
    }
  }

  function actionFrom(control){
    const raw=String(control?.dataset?.action||'').trim().toLowerCase();
    if(raw) return raw;
    const text=String(control?.textContent||'').replace(/\s+/g,' ').trim().toLowerCase();
    if(text.includes('mi perfil')) return 'perfil';
    if(text.includes('mercado escolar')) return 'market';
    if(text.includes('informes')) return 'informes';
    if(text.includes('pagos')) return 'payments';
    if(text==='inicio'||text.endsWith(' inicio')) return 'home';
    if(text.includes('notificaciones')) return 'avisos';
    if(text.includes('ayuda')) return 'ayuda';
    if(text.includes('cerrar sesión')) return 'logout';
    if(text.includes('ir a tesorero')) return 'tesorero';
    if(text.includes('ir a presidente')) return 'presidente';
    return '';
  }

  function execute(action){
    closeMenu();
    if(action==='home'||action==='payments'||action==='informes'){
      if(typeof window.go==='function') window.go(action);
      return true;
    }
    if(action==='perfil'||action==='profile'){
      if(typeof window.go==='function') window.go('profile');
      else if(typeof window.renderProfile==='function') window.renderProfile(false);
      return true;
    }
    if(action==='market'){
      location.href='/mercado-escolar/mercado-escolar.html';
      return true;
    }
    if(action==='avisos'){
      if(typeof window.openAvisosInbox==='function') window.openAvisosInbox();
      else document.querySelector('#avisosBellHost button')?.click();
      return true;
    }
    if(action==='tesorero'){
      location.href='/tesorero.html';
      return true;
    }
    if(action==='presidente'){
      location.href='/presidente.html';
      return true;
    }
    if(action==='ayuda'){
      if(typeof window.openHelp==='function') window.openHelp('general');
      return true;
    }
    if(action==='logout'){
      if(typeof window.logout==='function') window.logout();
      return true;
    }
    return false;
  }

  function handle(event){
    const menu=document.getElementById('menuDropdown');
    if(!menu||menu.style.display==='none') return;
    const control=event.target?.closest?.('button,a,[role="button"]');
    if(!control||!menu.contains(control)) return;
    const action=actionFrom(control);
    if(!action) return;

    if(event.type==='touchend') lastTouchAt=Date.now();
    if(event.type==='click'&&Date.now()-lastTouchAt<700) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    execute(action);
  }

  document.addEventListener('touchend',handle,{capture:true,passive:false});
  document.addEventListener('click',handle,true);
})();
