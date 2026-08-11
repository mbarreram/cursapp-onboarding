(function(){
  'use strict';
  if(window.__APODERADO_PROFILE_NAV_FIX_V1__) return;
  window.__APODERADO_PROFILE_NAV_FIX_V1__ = true;

  function closeMenu(){
    const menu=document.getElementById('menuDropdown');
    const btn=document.getElementById('menuBtn');
    if(menu){
      delete menu.dataset.open;
      menu.setAttribute('aria-hidden','true');
    }
    if(btn) btn.setAttribute('aria-expanded','false');
    document.body.classList.remove('apo-menu-open');
  }

  function openProfile(){
    closeMenu();
    document.body.setAttribute('data-apo-module','profile');
    try{
      if(typeof window.go === 'function') window.go('profile');
    }catch(err){
      console.error('MiCursoX: error abriendo perfil con go()',err);
    }

    setTimeout(function(){
      const app=document.getElementById('app');
      if(app && !app.querySelector('.apoProfilePage')){
        try{
          if(typeof window.renderProfile === 'function') window.renderProfile(false);
        }catch(err){
          console.error('MiCursoX: error renderizando perfil',err);
        }
      }
      document.body.setAttribute('data-apo-module','profile');
      try{ window.scrollTo(0,0); }catch(_e){}
    },40);
  }

  document.addEventListener('click',function(ev){
    const item=ev.target.closest?.('.apoV42MenuItem[data-action="profile"],#menuDropdown [data-action="profile"]');
    if(!item) return;
    ev.preventDefault();
    ev.stopPropagation();
    ev.stopImmediatePropagation();
    openProfile();
  },true);
})();
