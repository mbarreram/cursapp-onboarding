(function(){
  'use strict';
  if(window.__MICURSOX_PROFILE_MENU_V2__) return;
  window.__MICURSOX_PROFILE_MENU_V2__=true;

  function read(k,d){try{return JSON.parse(localStorage.getItem(k)||'')||d}catch(_){return d}}
  function activeRole(){
    var s=read('cursapp_session_v1',{})||{};
    var r=String(localStorage.getItem('cursapp_active_role_v1')||s.currentRole||s.activeRole||s.role||'apoderado').toLowerCase();
    if(r.indexOf('pres')>=0)return'presidente';
    if(r.indexOf('tesor')>=0)return'tesorero';
    return'apoderado';
  }
  function itemsFor(r){
    if(r==='presidente') return [['🏠','Inicio','/presidente.html#home'],['📣','Campañas','/presidente.html#campanas'],['🕘','Deudores','/presidente.html#deudores'],['📊','Informes','/presidente.html#informes']];
    if(r==='tesorero') return [['🏠','Inicio','/tesorero.html#home'],['💳','Conciliar','/tesorero.html#conciliacion'],['🧾','Rendiciones','/tesorero.html#rendiciones'],['📊','Informes','/tesorero.html#informes']];
    return [['🏠','Inicio','/apoderado.html#home'],['💳','Pagos','/apoderado.html#payments'],['📄','Informes','/apoderado.html#informes'],['🏪','Mercado Escolar','/mercado-escolar/mercado-escolar.html']];
  }
  function esc(v){return String(v||'').replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function ensureCss(){if(document.getElementById('mxProfileMenuV2Css'))return;var s=document.createElement('style');s.id='mxProfileMenuV2Css';s.textContent=`
    .mxPmOverlay{position:fixed;inset:0;z-index:2000000;background:rgba(15,23,42,.34);backdrop-filter:blur(3px)}
    .mxPmSheet{position:absolute;top:max(86px,calc(env(safe-area-inset-top) + 72px));right:12px;width:min(330px,calc(100vw - 24px));max-height:72vh;overflow:auto;background:#fff;border:1px solid #e2e8f0;border-radius:22px;padding:9px;box-shadow:0 28px 70px rgba(15,23,42,.28)}
    .mxPmRole{padding:10px 12px 8px;color:#64748b;font-size:12px;font-weight:950;text-transform:uppercase;letter-spacing:.05em}.mxPmItem{width:100%;min-height:48px;border:0;background:#fff;border-radius:14px;padding:11px 12px;display:flex;align-items:center;gap:11px;text-align:left;color:#0f172a;font:inherit;font-weight:850}.mxPmItem:active{background:#f5f3ff}.mxPmItem>span:first-child{width:25px;text-align:center;font-size:18px}.mxPmDivider{height:1px;background:#eef2f7;margin:6px 4px}.mxPmItem.danger{color:#b91c1c}
  `;document.head.appendChild(s)}
  function close(){document.getElementById('mxProfileMenuV2')?.remove();document.getElementById('menuBtn')?.setAttribute('aria-expanded','false')}
  function open(){
    close();ensureCss();var role=activeRole(),root=document.createElement('div');root.id='mxProfileMenuV2';root.className='mxPmOverlay';
    root.innerHTML='<div class="mxPmSheet" role="menu"><div class="mxPmRole">'+esc(role)+'</div>'+itemsFor(role).map(function(x){return'<button class="mxPmItem" type="button" data-href="'+esc(x[2])+'"><span>'+x[0]+'</span><span>'+esc(x[1])+'</span></button>'}).join('')+'<div class="mxPmDivider"></div><button class="mxPmItem" type="button" data-action="notifications"><span>🔔</span><span>Notificaciones</span></button><button class="mxPmItem" type="button" data-action="privacy"><span>🛡️</span><span>Consentimientos y privacidad</span></button><button class="mxPmItem" type="button" data-action="preferences"><span>⚙️</span><span>Preferencias de notificaciones</span></button><div class="mxPmDivider"></div><button class="mxPmItem danger" type="button" data-action="logout"><span>🚪</span><span>Cerrar sesión</span></button></div>';
    document.body.appendChild(root);document.getElementById('menuBtn')?.setAttribute('aria-expanded','true');
    root.addEventListener('click',function(e){
      if(e.target===root){close();return}
      var b=e.target.closest('button');if(!b)return;
      if(b.dataset.href){location.href=b.dataset.href;return}
      var a=b.dataset.action;
      if(a==='notifications'){close();window.CURSAPP_NOTIFICATIONS?.open?.();return}
      if(a==='privacy'){close();window.CURSAPP_USER_CONSENTS?.open?.();return}
      if(a==='preferences'){close();window.CURSAPP_NOTIFICATION_PREFERENCES?.open?.();return}
      if(a==='logout'){try{localStorage.removeItem('cursapp_session_v1');localStorage.removeItem('cursapp_active_profile_v1');localStorage.removeItem('cursapp_active_role_v1')}catch(_){ }location.href='/index.html'}
    });
  }
  document.addEventListener('click',function(e){
    var btn=e.target.closest?.('#menuBtn');if(!btn)return;
    e.preventDefault();e.stopImmediatePropagation();
    if(document.getElementById('mxProfileMenuV2'))close();else open();
  },true);
  document.addEventListener('touchend',function(e){
    var btn=e.target.closest?.('#menuBtn');if(!btn)return;
    e.preventDefault();e.stopImmediatePropagation();
    if(document.getElementById('mxProfileMenuV2'))close();else open();
  },{capture:true,passive:false});
})();