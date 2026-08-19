(function(){
  'use strict';
  if(window.__MICURSOX_UNIFIED_ROLE_MENU__) return;
  window.__MICURSOX_UNIFIED_ROLE_MENU__=true;

  function read(k,d){try{return JSON.parse(localStorage.getItem(k)||'')||d}catch(_){return d}}
  function role(){
    var s=read('cursapp_session_v1',{})||{};
    var r=String(localStorage.getItem('cursapp_active_role_v1')||s.currentRole||s.activeRole||s.role||'apoderado').toLowerCase();
    if(r.indexOf('pres')>=0)return'presidente';
    if(r.indexOf('tesor')>=0)return'tesorero';
    return'apoderado';
  }
  function items(r){
    if(r==='presidente') return [['🏠','Inicio','/presidente.html#home'],['📣','Campañas','/presidente.html#campanas'],['🕘','Deudores','/presidente.html#deudores'],['📊','Informes','/presidente.html#informes'],['👥','Apoderados del curso','/apoderados.html']];
    if(r==='tesorero') return [['🏠','Inicio','/tesorero.html#home'],['💳','Conciliar pagos','/tesorero.html#conciliacion'],['🧾','Rendiciones','/tesorero.html#rendiciones'],['📊','Informes','/tesorero.html#informes'],['💰','Retiros / Recaudado','/tesorero.html#retiros']];
    return [['🏠','Inicio','/apoderado.html#home'],['💳','Pagos','/apoderado.html#payments'],['📄','Informes','/apoderado.html#informes'],['🏪','Mercado Escolar','/mercado-escolar/mercado-escolar.html']];
  }
  function esc(v){return String(v||'').replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]})}
  function css(){
    if(document.getElementById('mxUnifiedMenuCss'))return;
    var s=document.createElement('style');s.id='mxUnifiedMenuCss';s.textContent=`
      .mxUnifiedMenuBackdrop{position:fixed;inset:0;z-index:2000000;background:transparent}
      .mxUnifiedMenuSheet{position:absolute;top:max(84px,calc(env(safe-area-inset-top) + 68px));right:12px;width:min(350px,calc(100vw - 24px));max-height:calc(100dvh - 170px);overflow:auto;background:#fff;border:1px solid #e2e8f0;border-radius:24px;padding:12px;box-shadow:0 24px 64px rgba(15,23,42,.22)}
      .mxUnifiedMenuRole{padding:7px 9px 10px;color:#6d28d9;font-size:12px;font-weight:950;text-transform:uppercase;letter-spacing:.04em}
      .mxUnifiedMenuItem{width:100%;min-height:50px;border:1px solid #e5eaf0;background:#fff;border-radius:16px;padding:11px 13px;display:flex;align-items:center;gap:11px;text-align:left;color:#0f172a;font:inherit;font-weight:850;margin:0 0 8px}
      .mxUnifiedMenuItem:active{background:#f5f3ff;border-color:#ddd6fe}.mxUnifiedMenuItem>span:first-child{width:26px;text-align:center;font-size:18px}.mxUnifiedMenuDivider{height:1px;background:#eef2f7;margin:8px 2px 12px}.mxUnifiedMenuItem.danger{color:#b91c1c}
      #menuBtn{color:#6d28d9!important}
    `;document.head.appendChild(s);
  }
  function close(){document.getElementById('mxUnifiedRoleMenu')?.remove();document.getElementById('menuBtn')?.setAttribute('aria-expanded','false')}
  function waitForApi(getter,method,tries){
    tries=tries||0;
    var api=getter();
    if(api&&typeof api[method]==='function'){api[method]();return}
    if(tries<20){setTimeout(function(){waitForApi(getter,method,tries+1)},100);return}
    alert('La opción todavía se está cargando. Intenta nuevamente.');
  }
  function route(href){
    var m=href.match(/^\/(apoderado|presidente|tesorero)\.html#(.+)$/);
    if(m){try{sessionStorage.setItem('micursox_pending_tab',m[2])}catch(_){ }}
    location.href=href;
  }
  function open(){
    close();css();var r=role(),root=document.createElement('div');root.id='mxUnifiedRoleMenu';root.className='mxUnifiedMenuBackdrop';
    var body=items(r).map(function(x){return'<button class="mxUnifiedMenuItem" type="button" data-href="'+esc(x[2])+'"><span>'+x[0]+'</span><span>'+esc(x[1])+'</span></button>'}).join('');
    root.innerHTML='<div class="mxUnifiedMenuSheet" role="menu"><div class="mxUnifiedMenuRole">'+esc(r)+'</div>'+body+'<div class="mxUnifiedMenuDivider"></div><button class="mxUnifiedMenuItem" type="button" data-href="/perfil.html"><span>👤</span><span>Mi perfil</span></button><button class="mxUnifiedMenuItem" type="button" data-action="notifications"><span>🔔</span><span>Notificaciones</span></button><button class="mxUnifiedMenuItem" type="button" data-action="privacy"><span>🛡️</span><span>Consentimientos y privacidad</span></button><button class="mxUnifiedMenuItem" type="button" data-action="preferences"><span>⚙️</span><span>Preferencias de notificaciones</span></button><div class="mxUnifiedMenuDivider"></div><button class="mxUnifiedMenuItem danger" type="button" data-action="logout"><span>🚪</span><span>Cerrar sesión</span></button></div>';
    document.body.appendChild(root);document.getElementById('menuBtn')?.setAttribute('aria-expanded','true');
    root.addEventListener('click',function(e){
      if(e.target===root){close();return}
      var b=e.target.closest('button');if(!b)return;
      if(b.dataset.href){var href=b.dataset.href;close();route(href);return}
      var a=b.dataset.action;close();
      if(a==='notifications'){waitForApi(function(){return window.CURSAPP_NOTIFICATIONS},'open');return}
      if(a==='privacy'){
        var api=window.CURSAPP_USER_CONSENTS||window.CURSAPP_CONSENT;
        if(api&&typeof api.open==='function'){api.open();return}
        if(api&&typeof api.openSummary==='function'){api.openSummary();return}
        waitForApi(function(){return window.CURSAPP_USER_CONSENTS||window.CURSAPP_CONSENT},'open');return
      }
      if(a==='preferences'){waitForApi(function(){return window.CURSAPP_NOTIFICATION_PREFERENCES},'open');return}
      if(a==='logout'){try{localStorage.removeItem('cursapp_session_v1');localStorage.removeItem('cursapp_active_profile_v1');localStorage.removeItem('cursapp_active_role_v1')}catch(_){ }location.href='/index.html'}
    });
  }
  function onMenu(e){var b=e.target.closest?.('#menuBtn');if(!b)return;e.preventDefault();e.stopImmediatePropagation();document.getElementById('mxUnifiedRoleMenu')?close():open()}
  document.addEventListener('pointerdown',onMenu,true);
  document.addEventListener('click',function(e){if(e.target.closest?.('#menuBtn')){e.preventDefault();e.stopImmediatePropagation()}},true);
})();
