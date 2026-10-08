(function(){
'use strict';
if(window.__MICURSOX_UNIFIED_ROLE_MENU_V4__)return;window.__MICURSOX_UNIFIED_ROLE_MENU_V4__=true;
function read(k,d){try{return JSON.parse(localStorage.getItem(k)||'')||d}catch(_){return d}}
function role(){var body=document.body;if(body?.classList.contains('cursapp-tesorero'))return'tesorero';if(body?.classList.contains('cursapp-presidente'))return'presidente';if(body?.classList.contains('cursapp-apoderado'))return'apoderado';var s=read('cursapp_session_v1',{})||{},r=String(localStorage.getItem('cursapp_active_role_v1')||s.currentRole||s.activeRole||s.role||'apoderado').toLowerCase();if(r.includes('pres'))return'presidente';if(r.includes('tesor'))return'tesorero';return'apoderado'}
function items(r){if(r==='presidente')return[['🏠','Inicio','/presidente.html#home'],['📣','Campañas','/presidente.html#campanas'],['🕘','Deudores','/presidente.html#deudores'],['📊','Informes','/presidente.html#informes'],['💰','Retiros / Recaudado','/presidente.html#retiros'],['👥','Apoderados del curso','/apoderados.html']];if(r==='tesorero')return[['🏠','Inicio','/tesorero.html#home'],['💳','Conciliar pagos','/tesorero.html#conciliacion'],['🧾','Rendiciones','/tesorero.html#rendiciones'],['📊','Informes','/tesorero.html#informes'],['💰','Retiros / Recaudado','/tesorero.html#retiros']];return[['🏠','Inicio','/apoderado.html#home'],['💳','Pagos','/apoderado.html#payments'],['📄','Informes','/apoderado.html#informes'],['🏪','Mercado Escolar','/mercado-escolar/mercado-escolar.html']]}
function close(){document.getElementById('mxUnifiedRoleMenuV4')?.remove();document.getElementById('menuBtn')?.setAttribute('aria-expanded','false')}
function route(h){
  var m=h.match(/^\/(apoderado|presidente|tesorero)\.html#(.+)$/);
  if(!m){location.href=h;return}
  var page='/'+m[1]+'.html',tab=String(m[2]||'home').trim();

  // Usar el controlador existente y los botones reales, sin rutas genéricas a Inicio.
  if(location.pathname===page){
    if(tab==='retiros'){
      var funds=document.querySelector('.bottomNav [data-mx-funds="1"], [data-mx-funds="1"]');
      if(funds){funds.click();return}
      if(typeof window.MX_DIRECTIVA_FUNDS?.open==='function'){window.MX_DIRECTIVA_FUNDS.open();return}
      alert('La sección Retiros todavía no está disponible. Intenta nuevamente.');
      return;
    }
    var valid={
      presidente:['home','campanas','deudores','informes'],
      tesorero:['home','conciliacion','rendiciones','informes'],
      apoderado:['home','payments','informes']
    };
    var current=page.slice(1,-5);
    if(!(valid[current]||[]).includes(tab)){alert('La sección seleccionada no está disponible en este perfil.');return}
    var buttonTab=document.querySelector('.bottomNav [data-tab="'+tab+'"]');
    if(buttonTab){buttonTab.click();return}
    if(typeof window.go==='function'){window.go(tab);return}
    alert('No se pudo abrir la sección. Intenta nuevamente.');
    return;
  }

  // Navegación entre páginas: usar el mecanismo oficial que consumen los dashboards al iniciar.
  try{
    if(window.CURSAPP&&typeof window.CURSAPP.setNextNavTab==='function')window.CURSAPP.setNextNavTab(tab);
    else{
      localStorage.setItem('cursapp_nav_tab_v1',tab);
      localStorage.setItem('cursapp_nav_at_v1',String(Date.now()));
    }
  }catch(_){}
  location.href=page;
}
function openNotifications(){close();var n=0;(function w(){var a=window.CURSAPP_NOTIFICATIONS;if(a&&typeof a.open==='function'){close();return a.open()}if(++n<30)setTimeout(w,100)})()}
function openSupport(){close();var n=0;(function w(){var a=window.CURSAPP_SUPPORT;if(a&&typeof a.openMyTickets==='function'){close();return a.openMyTickets()}if(a&&typeof a.open==='function'){close();return a.open('mine')}if(++n<30)return setTimeout(w,100);alert('Soporte aún se está cargando. Intenta nuevamente en unos segundos.')})()}
function openHelp(){close();var n=0;(function w(){var a=window.MICURSOX_PRESIDENT_HELP;if(a&&typeof a.open==='function'){close();return a.open()}if(++n<30)return setTimeout(w,100);alert('La ayuda aún se está cargando. Intenta nuevamente en unos segundos.')})()}
function openPizarron(){close();var a=window.MICURSOX_PIZARRON;if(a&&typeof a.open==='function')return a.open();location.href='/pizarron.html'}
async function logout(){try{if(window.cursappSupabase&&window.cursappSupabase.auth&&typeof window.cursappSupabase.auth.signOut==='function')await window.cursappSupabase.auth.signOut()}catch(_){ }try{['cursapp_session_v1','cursapp_active_profile_v1','cursapp_active_role_v1','cursapp_active_course_v1','cursapp_active_miembro_id_v1','cursapp_supabase_auth_session_v1','cursapp_supabase_oauth_v1'].forEach(k=>localStorage.removeItem(k));sessionStorage.clear()}catch(_){ }location.replace('/login.html')}
var BTN='width:100%!important;min-height:43px!important;border:0!important;background:transparent!important;border-radius:12px!important;padding:9px 10px!important;display:flex!important;align-items:center!important;justify-content:flex-start!important;gap:10px!important;margin:0!important;color:#0f172a!important;font-family:inherit!important;font-size:13.5px!important;font-weight:820!important;line-height:1.2!important;text-align:left!important;box-shadow:none!important;box-sizing:border-box!important;';
function button(attrs,icon,label,extra){return '<button type="button" '+attrs+' style="'+BTN+(extra||'')+'"><span style="flex:0 0 23px;width:23px;text-align:center;font-size:16px">'+icon+'</span><span style="min-width:0;flex:1;white-space:normal">'+label+'</span><span aria-hidden="true" style="flex:0 0 auto;color:#94a3b8;font-size:15px">›</span></button>'}
function section(title){return '<div style="padding:10px 10px 5px;color:#94a3b8;font-size:9px;font-weight:950;text-transform:uppercase;letter-spacing:.08em">'+title+'</div>'}
function divider(){return '<div style="height:1px;background:#eef2f7;margin:5px 6px"></div>'}
function open(){
 close();
 var r=role(),root=document.createElement('div');
 root.id='mxUnifiedRoleMenuV4';
 root.setAttribute('role','presentation');
 root.style.cssText='position:fixed!important;inset:0!important;z-index:2147483000!important;background:rgba(15,23,42,.08)!important;';
 var sheet=document.createElement('div');
 sheet.setAttribute('role','menu');
 sheet.style.cssText='position:absolute!important;top:max(76px,calc(env(safe-area-inset-top) + 58px))!important;right:12px!important;width:min(316px,calc(100vw - 24px))!important;max-height:calc(100dvh - 96px)!important;overflow:auto!important;-webkit-overflow-scrolling:touch!important;background:#fff!important;border:1px solid #e2e8f0!important;border-radius:20px!important;padding:7px!important;box-shadow:0 22px 58px rgba(15,23,42,.20)!important;box-sizing:border-box!important;';
 var html='<div style="padding:6px 10px 7px;color:#6d28d9;font-size:11px;font-weight:950;text-transform:uppercase;letter-spacing:.05em">'+r+'</div>';
 html+=section('Principal');
 items(r).forEach(function(x){html+=button('data-href="'+x[2]+'"',x[0],x[1])});
 html+=divider();
 html+=section('Utilidades');
 html+=button('data-action="pizarron"','📝','Pizarrón del curso','background:#faf7ff!important;color:#5b21b6!important;');
 html+=divider();
 html+=section('Cuenta');
 html+=button('data-href="/perfil.html"','👤','Mi perfil');
 html+=button('data-action="notifications"','🔔','Notificaciones');
 html+=button('data-action="preferences"','⚙️','Preferencias');
 html+=button('data-action="privacy"','🛡️','Consentimientos y privacidad');
 html+=divider();
 html+=section('Ayuda');
 if(r==='presidente')html+=button('data-action="help"','❓','Ayuda y primeros pasos','background:#faf5ff!important;color:#6d28d9!important;');
 html+=button('data-action="support"','💬','Soporte / Mis tickets');
 html+=divider();
 html+=button('data-action="logout"','🚪','Cerrar sesión','color:#b91c1c!important;');
 sheet.innerHTML=html;
 root.appendChild(sheet);
 document.body.appendChild(root);
 document.getElementById('menuBtn')?.setAttribute('aria-expanded','true');
 root.addEventListener('click',function(e){
   if(e.target===root){close();return}
   var b=e.target.closest('button');if(!b)return;
   var href=b.dataset.href;if(href){close();route(href);return}
   var a=b.dataset.action;close();
   if(a==='pizarron'){requestAnimationFrame(openPizarron);return}
   if(a==='notifications'){requestAnimationFrame(openNotifications);return}
   if(a==='help'){requestAnimationFrame(openHelp);return}
   if(a==='privacy'){requestAnimationFrame(function(){close();var p=window.CURSAPP_USER_CONSENTS||window.CURSAPP_CONSENT;if(p?.open)return p.open();if(p?.openSummary)return p.openSummary()});return}
   if(a==='preferences'){requestAnimationFrame(function(){close();window.CURSAPP_NOTIFICATION_PREFERENCES?.open?.()});return}
   if(a==='support'){requestAnimationFrame(openSupport);return}
   if(a==='logout')return logout();
 });
}
document.addEventListener('pointerdown',function(e){if(!e.target.closest?.('#menuBtn'))return;e.preventDefault();e.stopImmediatePropagation();document.getElementById('mxUnifiedRoleMenuV4')?close():open()},true);
document.addEventListener('click',function(e){if(e.target.closest?.('#menuBtn')){e.preventDefault();e.stopImmediatePropagation()}},true);
var __mxMenuModalObserver=new MutationObserver(function(ms){
  for(var i=0;i<ms.length;i++){
    for(var j=0;j<ms[i].addedNodes.length;j++){
      var n=ms[i].addedNodes[j];
      if(!n||n.nodeType!==1)continue;
      if(n.id==='supportTicketOverlay'||n.id==='mxPresidentHelpV1'||n.id==='cnOverlay'||n.classList?.contains('supportOverlay')||n.classList?.contains('pzOverlay')){close();return}
      if(n.querySelector?.('#supportTicketOverlay,#mxPresidentHelpV1,#cnOverlay,.supportOverlay,.pzOverlay')){close();return}
    }
  }
});
if(document.documentElement)__mxMenuModalObserver.observe(document.documentElement,{childList:true,subtree:true});
})();
