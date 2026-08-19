(function(){
  'use strict';
  if(window.__MICURSOX_PROFILE_MENU_STABLE__) return;
  window.__MICURSOX_PROFILE_MENU_STABLE__=true;

  function read(k,d){try{return JSON.parse(localStorage.getItem(k)||'')||d}catch(_){return d}}
  function role(){
    var s=read('cursapp_session_v1',{})||{};
    var r=String(localStorage.getItem('cursapp_active_role_v1')||s.currentRole||s.activeRole||s.role||'apoderado').toLowerCase();
    if(r.indexOf('pres')>=0)return'presidente';
    if(r.indexOf('tesor')>=0)return'tesorero';
    return'apoderado';
  }
  function homeFor(r){return r==='presidente'?'/presidente.html':r==='tesorero'?'/tesorero.html':'/apoderado.html'}
  function esc(v){return String(v||'').replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}

  function css(){
    if(document.getElementById('mxProfileStableMenuCss'))return;
    var s=document.createElement('style');s.id='mxProfileStableMenuCss';s.textContent=`
      body.cursapp-profile #menuDropdown.mxProfileStableMenu{position:fixed!important;z-index:1000000!important;width:min(318px,calc(100vw - 24px))!important;max-height:min(72vh,640px)!important;overflow:auto!important;background:#fff!important;border:1px solid #e2e8f0!important;border-radius:20px!important;padding:8px!important;box-shadow:0 24px 64px rgba(15,23,42,.22)!important;display:none}
      body.cursapp-profile #menuDropdown.mxProfileStableMenu.isOpen{display:block!important}
      .mxProfileMenuRole{padding:10px 12px 8px;font-size:12px;font-weight:900;color:#64748b;text-transform:uppercase;letter-spacing:.04em}
      .mxProfileMenuItem{width:100%;border:0;background:transparent;border-radius:14px;padding:12px 13px;display:flex;align-items:center;gap:11px;text-align:left;color:#0f172a;font:inherit;font-weight:850;min-height:46px}
      .mxProfileMenuItem:active{background:#f5f3ff}.mxProfileMenuItem span:first-child{width:24px;text-align:center;font-size:18px}.mxProfileMenuDivider{height:1px;background:#eef2f7;margin:6px 4px}.mxProfileMenuItem.danger{color:#b91c1c}
    `;document.head.appendChild(s);
  }

  function render(dd){
    var r=role();
    var roleItems=r==='presidente'
      ?[['🏠','Inicio','/presidente.html#home'],['📣','Campañas','/presidente.html#campanas'],['🕘','Deudores','/presidente.html#deudores'],['📊','Informes','/presidente.html#informes']]
      :r==='tesorero'
        ?[['🏠','Inicio','/tesorero.html#home'],['💳','Conciliar','/tesorero.html#conciliacion'],['🧾','Rendiciones','/tesorero.html#rendiciones'],['📊','Informes','/tesorero.html#informes']]
        :[['🏠','Inicio','/apoderado.html#home'],['💳','Pagos','/apoderado.html#payments'],['📄','Informes','/apoderado.html#informes'],['🏪','Mercado Escolar','/mercado-escolar/mercado-escolar.html']];
    dd.innerHTML='<div class="mxProfileMenuRole">'+esc(r)+'</div>'+
      roleItems.map(function(x){return'<button class="mxProfileMenuItem" type="button" data-href="'+esc(x[2])+'"><span>'+x[0]+'</span><span>'+esc(x[1])+'</span></button>'}).join('')+
      '<div class="mxProfileMenuDivider"></div>'+
      '<button class="mxProfileMenuItem" type="button" data-action="notifications"><span>🔔</span><span>Notificaciones</span></button>'+
      '<button class="mxProfileMenuItem" type="button" data-action="privacy"><span>🛡️</span><span>Consentimientos y privacidad</span></button>'+
      '<button class="mxProfileMenuItem" type="button" data-action="preferences"><span>⚙️</span><span>Preferencias de notificaciones</span></button>'+
      '<div class="mxProfileMenuDivider"></div>'+
      '<button class="mxProfileMenuItem danger" type="button" data-action="logout"><span>🚪</span><span>Cerrar sesión</span></button>';
  }

  function init(){
    var btn=document.getElementById('menuBtn'),dd=document.getElementById('menuDropdown');
    if(!btn||!dd)return;
    css();
    dd.hidden=false;dd.removeAttribute('hidden');dd.className='menuDropdown mxProfileStableMenu';
    render(dd);

    function place(){var r=btn.getBoundingClientRect();dd.style.top=Math.round(r.bottom+8)+'px';dd.style.right=Math.max(12,Math.round(innerWidth-r.right))+'px';dd.style.left='auto'}
    function close(){dd.classList.remove('isOpen');btn.setAttribute('aria-expanded','false')}
    function toggle(e){e.preventDefault();e.stopImmediatePropagation();var open=!dd.classList.contains('isOpen');if(open){place();dd.classList.add('isOpen');btn.setAttribute('aria-expanded','true')}else close()}
    btn.setAttribute('aria-haspopup','menu');btn.setAttribute('aria-expanded','false');
    btn.onclick=null;
    btn.addEventListener('click',toggle,true);
    dd.addEventListener('click',function(e){
      var b=e.target.closest('button');if(!b)return;
      var href=b.dataset.href,action=b.dataset.action;
      if(href){close();location.href=href;return}
      if(action==='notifications'){close();window.CURSAPP_NOTIFICATIONS?.open?.();return}
      if(action==='privacy'){close();window.CURSAPP_USER_CONSENTS?.open?.();return}
      if(action==='preferences'){close();window.CURSAPP_NOTIFICATION_PREFERENCES?.open?.();return}
      if(action==='logout'){
        close();
        try{localStorage.removeItem('cursapp_session_v1');localStorage.removeItem('cursapp_active_profile_v1');localStorage.removeItem('cursapp_active_role_v1')}catch(_){ }
        location.href='/index.html';
      }
    });
    document.addEventListener('click',function(e){if(!dd.contains(e.target)&&!btn.contains(e.target))close()},true);
    addEventListener('resize',function(){if(dd.classList.contains('isOpen'))place()});
    addEventListener('orientationchange',function(){setTimeout(function(){if(dd.classList.contains('isOpen'))place()},120)});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();