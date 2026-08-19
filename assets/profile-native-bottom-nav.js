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
  function go(path,tab){
    try{sessionStorage.setItem('micursox_pending_tab',tab||'home')}catch(_){ }
    location.href=path+(tab?'#'+tab:'');
  }
  function apoderado(){return '<button class="navItem apoderado-bottom-nav-item active" data-tab="home" type="button"><span class="nav-icon"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/></svg></span><span class="nav-label">Inicio</span></button><button class="navItem apoderado-bottom-nav-item" data-tab="payments" type="button"><span class="nav-icon"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18"/><path d="M7 15h4"/></svg></span><span class="nav-label">Pagos</span></button><button class="navItem apoderado-bottom-nav-item" data-tab="informes" type="button"><span class="nav-icon"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h9l3 3v15H6V3Z"/><path d="M14 3v4h4"/><path d="M9 13h6"/><path d="M9 17h6"/></svg></span><span class="nav-label">Informes</span></button><a class="marketBottomTab apoderado-bottom-nav-item" href="/mercado-escolar/mercado-escolar.html"><span class="nav-icon"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10h16l-1-5H5l-1 5Z"/><path d="M6 10v10h12V10"/><path d="M9 20v-6h6v6"/></svg></span><span class="nav-label">Mercado Escolar</span></a>'}
  function presidente(){return '<button class="navItem active" data-tab="home" type="button"><span class="presNavIcon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/></svg></span><span>Inicio</span></button><button class="navItem" data-tab="campanas" type="button"><span class="presNavIcon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m3 11 18-5v12L3 13v-2Z"/><path d="M11 14v4a2 2 0 0 1-2 2H8l-2-6"/></svg></span><span>Campañas</span></button><button class="navItem" data-tab="deudores" type="button"><span class="presNavIcon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg></span><span>Deudores</span></button><button class="navItem" data-tab="informes" type="button"><span class="presNavIcon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/></svg></span><span>Informes</span></button>'}
  function tesorero(){return '<button class="navItem active" data-tab="home" type="button"><span class="tesNavIcon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M3 10.8 12 3l9 7.8"/><path d="M5.5 10.5V21h13V10.5"/><path d="M9.5 21v-6h5v6"/></svg></span><span class="tesNavLabel">Inicio</span></button><button class="navItem" data-tab="conciliacion" type="button"><span class="tesNavIcon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 6.5v11"/><path d="M8.8 9.2c.8-1 2-1.4 3.2-1.4 1.7 0 3 .8 3 2.1 0 2.8-6 1.3-6 4.1 0 1.4 1.3 2.3 3.1 2.3 1.4 0 2.7-.5 3.5-1.6"/></svg></span><span class="tesNavLabel">Conciliar</span></button><button class="navItem" data-tab="rendiciones" type="button"><span class="tesNavIcon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 3h8l4 4v14H7z"/><path d="M15 3v5h4"/><path d="M10 12h6M10 16h6"/></svg></span><span class="tesNavLabel">Rendiciones</span></button><button class="navItem" data-tab="informes" type="button"><span class="tesNavIcon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 19V5"/><path d="M4 19h16"/><path d="M8 16v-5"/><path d="M12 16V8"/><path d="M16 16v-9"/></svg></span><span class="tesNavLabel">Informes</span></button>'}
  function render(){
    var nav=document.querySelector('body.cursapp-profile .bottomNav');if(!nav)return;
    var r=role();
    nav.className='bottomNav '+(r==='presidente'?'presBottomNav':r==='tesorero'?'tesBottomNav':'apoderado-bottom-nav');
    nav.setAttribute('aria-label','Navegación '+r);
    nav.innerHTML=r==='presidente'?presidente():r==='tesorero'?tesorero():apoderado();
    nav.querySelectorAll('[data-tab]').forEach(function(b){b.addEventListener('click',function(){var t=b.dataset.tab;go('/'+r+'.html',t)})});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',render,{once:true});else render();
  [350,1000,2000].forEach(function(t){setTimeout(render,t)});
})();
