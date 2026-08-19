(function(){
  'use strict';
  if(window.__MICURSOX_DIRECTIVA_ACCOUNT_NAV__) return;
  window.__MICURSOX_DIRECTIVA_ACCOUNT_NAV__=true;

  function role(){
    const p=location.pathname.toLowerCase();
    if(p.includes('presidente')) return 'presidente';
    if(p.includes('tesorero')) return 'tesorero';
    return '';
  }
  function hideMenu(){
    const menu=document.getElementById('menuDropdown');
    if(!menu) return;
    menu.style.display='none';
    menu.hidden=true;
  }
  function make(text,action){
    const b=document.createElement('button');
    b.type='button';
    b.className='menuItem';
    b.dataset.mxAccountAction=action;
    b.textContent=text;
    return b;
  }
  function ensure(){
    if(!role()) return;
    const menu=document.getElementById('menuDropdown');
    if(!menu) return;
    if(!menu.querySelector('[data-mx-account-action="profile"]')){
      const b=make('👤 Mi perfil','profile');
      const support=menu.querySelector('#supportMenuItem');
      support?menu.insertBefore(b,support):menu.appendChild(b);
    }
    if(!menu.querySelector('[data-mx-account-action="consents"]')){
      const b=make('🛡️ Consentimientos y privacidad','consents');
      const support=menu.querySelector('#supportMenuItem');
      support?menu.insertBefore(b,support):menu.appendChild(b);
    }
  }
  document.addEventListener('click',function(e){
    const b=e.target.closest?.('[data-mx-account-action]');
    if(!b) return;
    e.preventDefault();e.stopImmediatePropagation();
    const action=b.dataset.mxAccountAction;
    hideMenu();
    if(action==='profile'){
      location.assign('/perfil.html');
      return;
    }
    if(action==='consents'){
      const api=window.CURSAPP_USER_CONSENTS;
      if(api&&typeof api.open==='function') api.open();
      else alert('Consentimientos y privacidad aún se están cargando. Intenta nuevamente en unos segundos.');
    }
  },true);
  const mo=new MutationObserver(ensure);
  mo.observe(document.documentElement,{childList:true,subtree:true});
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',ensure,{once:true}); else ensure();
  [300,800,1500,2500].forEach(t=>setTimeout(ensure,t));
})();