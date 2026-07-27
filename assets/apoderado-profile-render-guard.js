(function(){
  'use strict';
  if(window.__APO_PROFILE_RENDER_GUARD__) return;
  window.__APO_PROFILE_RENDER_GUARD__ = true;

  function esc(value){
    return String(value == null ? '' : value).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});
  }
  function readJson(key,fallback){
    try{var raw=localStorage.getItem(key);return raw?JSON.parse(raw):fallback;}catch(_e){return fallback;}
  }
  function profileData(){
    var session=readJson('cursapp_session_v1',{})||{};
    var active=readJson('cursapp_active_profile_v1',{})||{};
    var profiles=readJson('cursapp_profiles_v1',[])||[];
    if(typeof active==='string') active={};
    var email=String(session.email||session.userEmail||active.email||'').trim();
    var courseKey=String(localStorage.getItem('cursapp_active_course_v1')||session.courseKey||active.courseKey||'');
    var row=Array.isArray(profiles)?profiles.find(function(p){
      var pe=String((p&&p.apoderado&&p.apoderado.email)||(p&&p.user&&p.user.email)||'').toLowerCase();
      return (!email||pe===email.toLowerCase())&&(!courseKey||String(p&&p.courseKey||'')===courseKey);
    }):null;
    row=row||{};
    var ap=row.apoderado||{};
    var course=row.course||{};
    var editable=readJson('cursapp_profile_editable_v1',{})||{};
    return {
      name:editable.name||ap.name||ap.nombre||session.name||session.nombre||'Apoderado',
      phone:editable.phone||ap.phone||ap.telefono||session.phone||session.telefono||'',
      email:email||ap.email||'Correo no registrado',
      student:ap.alumno||row.alumno||active.alumno||'Alumno/a',
      course:course.courseLabel||course.name||active.courseLabel||active.courseName||active.curso||'Curso actual',
      school:course.schoolName||course.colegio||active.schoolName||active.colegio||'Colegio'
    };
  }
  function fallback(){
    var app=document.getElementById('app');
    if(!app) return;
    var d=profileData();
    var initials=String(d.name||'A').trim().split(/\s+/).slice(0,2).map(function(x){return x.charAt(0);}).join('').toUpperCase();
    app.innerHTML='<div class="apoProfilePage">'+
      '<section class="apoProfileHero"><div class="apoProfileAvatar"><span>'+esc(initials)+'</span></div><div class="apoProfileHeroText"><h1>'+esc(d.name)+'</h1><p>Apoderado de '+esc(d.student)+'</p><div><span>✉️ '+esc(d.email)+'</span></div><div><span>📱 '+esc(d.phone||'Agregar teléfono')+'</span></div></div></section>'+
      '<section class="apoProfileCard apoProfileLockedCard"><article><span>🎓</span><div><b>Curso</b><small>'+esc(d.course)+'</small></div><span class="apoProfileLock">🔒</span></article><article><span>🏫</span><div><b>Colegio</b><small>'+esc(d.school)+'</small></div><span class="apoProfileLock">🔒</span></article><p>ⓘ Estos datos son administrados por la directiva del curso.</p></section>'+
      '<section class="apoProfileCard"><h2>Información personal</h2><article class="apoProfileRow"><span>👤</span><div><b>Nombre completo</b><small>'+esc(d.name)+'</small></div></article><article class="apoProfileRow"><span>📱</span><div><b>Teléfono</b><small>'+esc(d.phone||'Agregar teléfono')+'</small></div></article></section>'+
      '<section class="apoProfileCard apoProfileCommCard"><div class="apoProfileCardHead"><h2>Mis preferencias de comunicación</h2></div><div class="apoProfileChannels"><article class="apoProfileChannel push"><span>🔔</span><b>Push</b><small>Activado</small></article><article class="apoProfileChannel email"><span>✉️</span><b>Correos</b><small>Activado</small></article><article class="apoProfileChannel sms"><span>💬</span><b>SMS</b><small>Desactivado</small></article></div></section>'+
      '</div>';
  }
  function openProfile(ev){
    var item=ev.target&&ev.target.closest?ev.target.closest('.apoV42MenuItem[data-action="perfil"]'):null;
    if(!item) return;
    ev.preventDefault();
    ev.stopImmediatePropagation();
    var menu=document.getElementById('menuDropdown'); if(menu) menu.style.display='none';
    var app=document.getElementById('app'); if(app) app.innerHTML='';
    try{
      if(typeof window.renderProfile==='function') window.renderProfile(false);
      if(!app||!app.firstElementChild) fallback();
    }catch(error){
      console.error('MiCursoX: error controlado al abrir perfil',error);
      fallback();
    }
  }
  document.addEventListener('click',openProfile,true);
  document.addEventListener('touchend',openProfile,true);
})();
