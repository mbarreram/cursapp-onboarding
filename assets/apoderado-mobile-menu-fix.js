(function(){
  'use strict';
  function mobile(){ return !window.matchMedia('(min-width:1024px)').matches; }
  function styleMenu(menu){
    menu.style.setProperty('position','fixed','important');
    menu.style.setProperty('right','14px','important');
    menu.style.setProperty('top','64px','important');
    menu.style.setProperty('left','auto','important');
    menu.style.setProperty('width','min(280px,calc(100vw - 28px))','important');
    menu.style.setProperty('min-width','0','important');
    menu.style.setProperty('z-index','2147483000','important');
    menu.style.setProperty('background','#fff','important');
    menu.style.setProperty('border','1px solid #e2e8f0','important');
    menu.style.setProperty('border-radius','16px','important');
    menu.style.setProperty('padding','8px','important');
    menu.style.setProperty('box-shadow','0 18px 45px rgba(15,23,42,.22)','important');
    menu.style.setProperty('visibility','visible','important');
    menu.style.setProperty('opacity','1','important');
    menu.style.setProperty('pointer-events','auto','important');
    menu.style.setProperty('transform','none','important');
  }
  function ensureContent(menu){
    if(menu.innerHTML.trim()) return;
    menu.innerHTML='<button type="button" data-mx-menu-profile>Mi perfil</button><button type="button" data-mx-menu-switch>Cambiar perfil / curso</button><button type="button" data-mx-menu-logout>Cerrar sesión</button>';
  }
  function styleItems(menu){
    Array.from(menu.querySelectorAll('button,a')).forEach(function(x){
      x.style.setProperty('display','block','important');
      x.style.setProperty('width','100%','important');
      x.style.setProperty('border','0','important');
      x.style.setProperty('background','transparent','important');
      x.style.setProperty('text-align','left','important');
      x.style.setProperty('padding','12px 14px','important');
      x.style.setProperty('border-radius','12px','important');
      x.style.setProperty('font-weight','750','important');
      x.style.setProperty('color','#0f172a','important');
    });
  }
  function open(menu){ styleMenu(menu); ensureContent(menu); styleItems(menu); menu.style.setProperty('display','block','important'); menu.dataset.mxOpen='1'; }
  function close(menu){ menu.style.setProperty('display','none','important'); menu.dataset.mxOpen='0'; }
  function setup(){
    if(!mobile()) return;
    const btn=document.getElementById('menuBtn');
    const menu=document.getElementById('menuDropdown');
    if(!btn||!menu) return;
    btn.style.setProperty('pointer-events','auto','important');
    btn.style.setProperty('z-index','2147483001','important');
    ensureContent(menu); styleMenu(menu); styleItems(menu); close(menu);
    if(document.documentElement.dataset.mxApoMenuCapture==='1') return;
    document.documentElement.dataset.mxApoMenuCapture='1';
    window.addEventListener('pointerdown',function(e){
      if(!mobile()) return;
      const currentBtn=document.getElementById('menuBtn');
      const currentMenu=document.getElementById('menuDropdown');
      if(!currentBtn||!currentMenu) return;
      if(e.target===currentBtn || currentBtn.contains(e.target)){
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
        if(currentMenu.dataset.mxOpen==='1') close(currentMenu); else open(currentMenu);
        return;
      }
      if(currentMenu.dataset.mxOpen==='1' && !currentMenu.contains(e.target)) close(currentMenu);
    },true);
    window.addEventListener('click',function(e){
      const currentBtn=document.getElementById('menuBtn');
      if(currentBtn && (e.target===currentBtn || currentBtn.contains(e.target))){ e.preventDefault(); e.stopImmediatePropagation(); }
    },true);
    menu.addEventListener('click',function(e){
      const profile=e.target.closest('[data-mx-menu-profile]');
      const sw=e.target.closest('[data-mx-menu-switch]');
      const logout=e.target.closest('[data-mx-menu-logout]');
      if(profile){ close(menu); if(window.APODERADO_PROFILE?.open) window.APODERADO_PROFILE.open(); else location.hash='perfil'; }
      if(sw){ close(menu); if(window.CURSAPP_SWITCH_ROLE?.open) window.CURSAPP_SWITCH_ROLE.open(); else location.href='/onboarding/dashboard'; }
      if(logout){ close(menu); try{localStorage.removeItem('cursapp_session_v1');}catch(_e){} location.href='/'; }
    });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',setup,{once:true}); else setup();
  [300,900,1800,3200].forEach(function(t){setTimeout(setup,t);});
})();