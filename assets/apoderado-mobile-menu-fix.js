(function(){
  'use strict';
  function mobile(){ return !window.matchMedia('(min-width:1024px)').matches; }
  function setup(){
    if(!mobile()) return;
    const btn=document.getElementById('menuBtn');
    const menu=document.getElementById('menuDropdown');
    if(!btn||!menu||btn.dataset.mxMobileMenuFix==='1') return;
    btn.dataset.mxMobileMenuFix='1';
    if(!menu.innerHTML.trim()){
      menu.innerHTML='<button type="button" data-mx-menu-profile>Mi perfil</button><button type="button" data-mx-menu-switch>Cambiar perfil / curso</button><button type="button" data-mx-menu-logout>Cerrar sesión</button>';
    }
    menu.style.position='absolute'; menu.style.right='16px'; menu.style.top='56px'; menu.style.zIndex='10050'; menu.style.minWidth='220px'; menu.style.background='#fff'; menu.style.border='1px solid #e2e8f0'; menu.style.borderRadius='16px'; menu.style.padding='8px'; menu.style.boxShadow='0 18px 45px rgba(15,23,42,.18)';
    Array.from(menu.querySelectorAll('button')).forEach(x=>{x.style.cssText='display:block;width:100%;border:0;background:transparent;text-align:left;padding:12px 14px;border-radius:12px;font:inherit;font-weight:750;color:#0f172a';});
    btn.addEventListener('click',function(e){ e.preventDefault(); e.stopImmediatePropagation(); menu.style.display=menu.style.display==='block'?'none':'block'; },true);
    document.addEventListener('click',function(e){ if(!menu.contains(e.target)&&e.target!==btn) menu.style.display='none'; });
    menu.querySelector('[data-mx-menu-profile]')?.addEventListener('click',function(){ menu.style.display='none'; if(window.APODERADO_PROFILE?.open) window.APODERADO_PROFILE.open(); else location.hash='perfil'; });
    menu.querySelector('[data-mx-menu-switch]')?.addEventListener('click',function(){ menu.style.display='none'; if(window.CURSAPP_SWITCH_ROLE?.open) window.CURSAPP_SWITCH_ROLE.open(); else location.href='/onboarding/dashboard'; });
    menu.querySelector('[data-mx-menu-logout]')?.addEventListener('click',function(){ menu.style.display='none'; try{ if(window.CURSAPP_SUPABASE?.signOut) window.CURSAPP_SUPABASE.signOut(); }catch(_e){} try{ localStorage.removeItem('cursapp_session_v1'); }catch(_e){} location.href='/'; });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',setup,{once:true}); else setup();
  setTimeout(setup,900);
})();