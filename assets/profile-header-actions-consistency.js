(function(){
  'use strict';
  if(window.__MICURSOX_PROFILE_HEADER_ACTIONS__)return;
  window.__MICURSOX_PROFILE_HEADER_ACTIONS__=true;

  function read(k,d){try{return JSON.parse(localStorage.getItem(k)||'')||d}catch(_){return d}}
  function role(){
    var s=read('cursapp_session_v1',{})||{};
    var r=String(localStorage.getItem('cursapp_active_role_v1')||s.currentRole||s.activeRole||s.role||'apoderado').toLowerCase();
    if(r.indexOf('pres')>=0)return'presidente';
    if(r.indexOf('tesor')>=0)return'tesorero';
    return'apoderado';
  }
  function openNotifications(){
    var tries=0;
    (function wait(){
      var api=window.CURSAPP_NOTIFICATIONS;
      if(api&&typeof api.open==='function'){api.open();return}
      if(++tries<20){setTimeout(wait,100);return}
    })();
  }
  function apply(){
    if(!document.body.classList.contains('cursapp-profile'))return;
    var top=document.querySelector('.topbar');
    var menu=document.getElementById('menuBtn');
    if(!top||!menu)return;
    var r=role();document.body.setAttribute('data-profile-role',r);

    var actions=top.querySelector('.mxProfileHeaderActions');
    if(!actions){actions=document.createElement('div');actions.className='mxProfileHeaderActions';top.appendChild(actions)}

    var bell=document.getElementById('notificationBtn');
    if(!bell){
      bell=document.createElement('button');bell.id='notificationBtn';bell.type='button';bell.setAttribute('aria-label','Notificaciones');bell.textContent='🔔';
      bell.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();openNotifications()});
    }
    if(bell.parentElement!==actions)actions.appendChild(bell);
    if(menu.parentElement!==actions)actions.appendChild(menu);

    /* evita una segunda campana flotante creada por capas legacy del perfil */
    document.querySelectorAll('body.cursapp-profile button[aria-label="Notificaciones"],body.cursapp-profile button[aria-label="Avisos"]').forEach(function(el){if(el!==bell&&el.id!=='notificationBtn')el.style.display='none'});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});else apply();
  [250,700,1400,2600].forEach(function(t){setTimeout(apply,t)});
})();
