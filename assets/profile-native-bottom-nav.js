(function(){
  'use strict';
  if(window.__MICURSOX_PROFILE_NATIVE_BOTTOM_NAV__) return;
  window.__MICURSOX_PROFILE_NATIVE_BOTTOM_NAV__=true;

  function read(k,d){try{return JSON.parse(localStorage.getItem(k)||'')||d}catch(_){return d}}
  function role(){
    var s=read('cursapp_session_v1',{})||{};
    var r=String(localStorage.getItem('cursapp_active_role_v1')||s.currentRole||s.activeRole||s.role||'apoderado').toLowerCase();
    if(r.indexOf('pres')>=0)return'presidente';
    if(r.indexOf('tesor')>=0)return'tesorero';
    return'apoderado';
  }
  function go(path,tab){try{sessionStorage.setItem('micursox_pending_tab',tab||'home')}catch(_){ }location.href=path+(tab?'#'+tab:'')}
  function ensureCss(){
    if(document.getElementById('mxProfileNativeBottomNavCss'))return;
    var s=document.createElement('style');s.id='mxProfileNativeBottomNavCss';s.textContent=`
      body.cursapp-profile .bottomNav.mxProfileNativeNav{display:grid!important;align-items:stretch!important;gap:4px!important;width:calc(100% - 28px)!important;max-width:760px!important;left:50%!important;transform:translateX(-50%)!important;bottom:max(10px,env(safe-area-inset-bottom))!important;padding:8px!important;border:1px solid #e2e8f0!important;border-radius:28px!important;background:rgba(255,255,255,.97)!important;box-shadow:0 16px 38px rgba(15,23,42,.14)!important;backdrop-filter:blur(14px)!important;z-index:5000!important}
      body.cursapp-profile .bottomNav.mxProfileNativeNav.apoderado-bottom-nav,body.cursapp-profile .bottomNav.mxProfileNativeNav.tesBottomNav{grid-template-columns:repeat(4,minmax(0,1fr))!important}
      body.cursapp-profile .bottomNav.mxProfileNativeNav.presBottomNav{grid-template-columns:repeat(5,minmax(0,1fr))!important}
      body.cursapp-profile .bottomNav.mxProfileNativeNav .navItem,body.cursapp-profile .bottomNav.mxProfileNativeNav .marketBottomTab{min-width:0!important;min-height:66px!important;border:0!important;border-radius:20px!important;background:transparent!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:4px!important;text-decoration:none!important;color:#64748b!important;font-size:12px!important;font-weight:850!important;line-height:1.05!important;padding:6px 3px!important}
      body.cursapp-profile .bottomNav.mxProfileNativeNav .navItem.active{background:#f3e8ff!important;color:#6d28d9!important}
      body.cursapp-profile .bottomNav.mxProfileNativeNav.tesBottomNav .navItem.active{background:#eaf4ff!important;color:#2563eb!important}
      body.cursapp-profile .bottomNav.mxProfileNativeNav svg{width:25px!important;height:25px!important;display:block!important;fill:none!important;stroke:currentColor!important;stroke-width:2.2!important;stroke-linecap:round!important;stroke-linejoin:round!important}
      body.cursapp-profile .bottomNav.mxProfileNativeNav .nav-icon,body.cursapp-profile .bottomNav.mxProfileNativeNav .presNavIcon,body.cursapp-profile .bottomNav.mxProfileNativeNav .tesNavIcon{width:28px!important;height:28px!important;display:grid!important;place-items:center!important;color:inherit!important}
      body.cursapp-profile .bottomNav.mxProfileNativeNav .nav-label,body.cursapp-profile .bottomNav.mxProfileNativeNav .tesNavLabel,body.cursapp-profile .bottomNav.mxProfileNativeNav .presNavLabel{font-size:12px!important;font-weight:850!important;color:inherit!important;text-align:center!important}
      body.cursapp-profile .bottomNav.mxProfileNativeNav.apoderado-bottom-nav .marketBottomTab{color:#64748b!important;background:transparent!important}
      @media(max-width:430px){body.cursapp-profile .bottomNav.mxProfileNativeNav{width:calc(100% - 22px)!important;padding:7px!important}body.cursapp-profile .bottomNav.mxProfileNativeNav .navItem,body.cursapp-profile .bottomNav.mxProfileNativeNav .marketBottomTab{min-height:62px!important;font-size:11px!important}body.cursapp-profile .bottomNav.mxProfileNativeNav.presBottomNav .navItem{font-size:10px!important;padding-left:1px!important;padding-right:1px!important}}
    `;document.head.appendChild(s);
  }
  function apoderado(){return '<button class="navItem apoderado-bottom-nav-item active" data-tab="home" type="button"><span class="nav-icon"><svg viewBox="0 0 24 24"><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/></svg></span><span class="nav-label">Inicio</span></button><button class="navItem apoderado-bottom-nav-item" data-tab="payments" type="button"><span class="nav-icon"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18"/><path d="M7 15h4"/></svg></span><span class="nav-label">Pagos</span></button><button class="navItem apoderado-bottom-nav-item" data-tab="informes" type="button"><span class="nav-icon"><svg viewBox="0 0 24 24"><path d="M6 3h9l3 3v15H6V3Z"/><path d="M14 3v4h4"/><path d="M9 13h6"/><path d="M9 17h6"/></svg></span><span class="nav-label">Informes</span></button><a class="marketBottomTab apoderado-bottom-nav-item" href="/mercado-escolar/mercado-escolar.html"><span class="nav-icon"><svg viewBox="0 0 24 24"><path d="M4 10h16l-1-5H5l-1 5Z"/><path d="M6 10v10h12V10"/><path d="M9 20v-6h6v6"/></svg></span><span class="nav-label">Mercado Escolar</span></a>'}
  function presidente(){return '<button class="navItem active" data-tab="home" type="button"><span class="presNavIcon"><svg viewBox="0 0 24 24"><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/></svg></span><span class="presNavLabel">Inicio</span></button><button class="navItem" data-tab="campanas" type="button"><span class="presNavIcon"><svg viewBox="0 0 24 24"><path d="m3 11 18-5v12L3 13v-2Z"/><path d="M11 14v4a2 2 0 0 1-2 2H8l-2-6"/></svg></span><span class="presNavLabel">Campañas</span></button><button class="navItem" data-tab="deudores" type="button"><span class="presNavIcon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg></span><span class="presNavLabel">Deudores</span></button><button class="navItem" data-tab="informes" type="button"><span class="presNavIcon"><svg viewBox="0 0 24 24"><path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/></svg></span><span class="presNavLabel">Informes</span></button><button class="navItem" data-tab="retiros" type="button"><span class="presNavIcon"><svg viewBox="0 0 24 24"><rect x="4" y="6" width="16" height="12" rx="1"/><path d="M8 12h8"/></svg></span><span class="presNavLabel">Retiros</span></button>'}
  function tesorero(){return '<button class="navItem active" data-tab="home" type="button"><span class="tesNavIcon"><svg viewBox="0 0 24 24"><path d="M3 10.8 12 3l9 7.8"/><path d="M5.5 10.5V21h13V10.5"/><path d="M9.5 21v-6h5v6"/></svg></span><span class="tesNavLabel">Inicio</span></button><button class="navItem" data-tab="conciliacion" type="button"><span class="tesNavIcon"><svg viewBox="0 0 24 24"><path d="M7 3h10v18H7z"/><path d="M9.5 8.5 11 10l3.5-3.5"/><path d="M9.5 14h5"/></svg></span><span class="tesNavLabel">Conciliar</span></button><button class="navItem" data-tab="rendiciones" type="button"><span class="tesNavIcon"><svg viewBox="0 0 24 24"><path d="M7 3h8l4 4v14H7z"/><path d="M15 3v5h4"/><path d="M10 12h6M10 16h6"/></svg></span><span class="tesNavLabel">Rendiciones</span></button><button class="navItem" data-tab="informes" type="button"><span class="tesNavIcon"><svg viewBox="0 0 24 24"><path d="M4 19V5"/><path d="M4 19h16"/><path d="M8 16v-5"/><path d="M12 16V8"/><path d="M16 16v-9"/></svg></span><span class="tesNavLabel">Informes</span></button>'}
  function render(){
    var nav=document.querySelector('body.cursapp-profile .bottomNav');if(!nav)return;
    ensureCss();var r=role();
    nav.className='bottomNav mxProfileNativeNav '+(r==='presidente'?'presBottomNav':r==='tesorero'?'tesBottomNav':'apoderado-bottom-nav');
    nav.setAttribute('aria-label','Navegación '+r);
    nav.innerHTML=r==='presidente'?presidente():r==='tesorero'?tesorero():apoderado();
    nav.querySelectorAll('[data-tab]').forEach(function(b){b.addEventListener('click',function(){go('/'+r+'.html',b.dataset.tab)})});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',render,{once:true});else render();
  [350,1000,2000].forEach(function(t){setTimeout(render,t)});
})();
