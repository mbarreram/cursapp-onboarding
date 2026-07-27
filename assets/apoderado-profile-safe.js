(function(){
  'use strict';
  if(window.__MICURSOX_APODERADO_PROFILE_SAFE__) return;
  window.__MICURSOX_APODERADO_PROFILE_SAFE__=true;

  const read=(key,fallback)=>{try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):fallback;}catch(_){return fallback;}};
  const esc=(v)=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const first=(v)=>String(v||'').trim().split(/\s+/).filter(Boolean)[0]||'';

  function profileData(){
    const session=read('cursapp_session_v1',{})||{};
    const stored=read('cursapp_active_profile_v1',{})||{};
    const alumno=read('cursapp_alumno_activo_v1',{})||{};
    const course=read('cursapp_course_v1',{})||{};
    const editable=read('cursapp_profile_editable_v1',{})||{};
    const profiles=read('cursapp_profiles_v1',[])||[];
    const activeCourse=String(localStorage.getItem('cursapp_active_course_v1')||session.courseKey||stored.courseKey||'');
    const email=String(session.email||session.userEmail||stored.email||alumno.email||'').trim();
    const match=(Array.isArray(profiles)?profiles:[]).find(p=>{
      const pe=String(p?.apoderado?.email||p?.user?.email||'').toLowerCase();
      const pc=String(p?.courseKey||'');
      return (!email||pe===email.toLowerCase())&&(!activeCourse||pc===activeCourse);
    })||{};
    const ap=match.apoderado||stored.apoderado||{};
    const c=match.course||stored.course||course||{};
    const name=editable.name||ap.name||ap.nombre||session.name||session.nombre||'Apoderado';
    const phone=editable.phone||ap.phone||ap.telefono||session.phone||session.telefono||'';
    const student=ap.alumno||match.alumno||alumno.alumno||alumno.nombre||stored.alumno||'Alumno/a';
    const courseLabel=stored.courseLabel||stored.courseName||c.courseLabel||c.name||`${c.level||''}${c.letter||''} ${c.year||''}`.trim()||'Curso actual';
    const school=stored.schoolName||stored.colegio||c.schoolName||c.colegio||c.school||course.schoolName||course.colegio||'Colegio';
    return {name,phone,email,student,courseLabel,school};
  }

  function prefs(){
    return Object.assign({push:true,email:true,sms:false},read('cursapp_profile_comm_prefs_v1',{})||{});
  }

  function edit(field){
    const d=profileData();
    const current=field==='phone'?d.phone:d.name;
    const next=prompt(field==='phone'?'Editar teléfono':'Editar nombre completo',current||'');
    if(next===null)return;
    const data=read('cursapp_profile_editable_v1',{})||{};
    data[field]=String(next||'').trim();
    try{localStorage.setItem('cursapp_profile_editable_v1',JSON.stringify(data));}catch(_){}
    render();
  }

  function render(){
    const app=document.getElementById('app');
    if(!app)return;
    const d=profileData();
    const p=prefs();
    const initials=String(d.name||'A').trim().split(/\s+/).slice(0,2).map(x=>x.charAt(0)).join('').toUpperCase()||'A';
    const counts=window.__apoProfileCommunicationCounts||{push:0,email:0,sms:0};
    app.innerHTML=`<div class="apoProfilePage">
      <section class="apoProfileHero">
        <div class="apoProfileAvatar"><span>${esc(initials)}</span></div>
        <div class="apoProfileHeroText"><h1>${esc(d.name)}</h1><p>Apoderado de ${esc(first(d.student)||d.student)}</p><div><span>✉️ ${esc(d.email||'correo no registrado')}</span><span class="apoProfileLock">🔒</span></div><div><span>📱 ${esc(d.phone||'Agregar teléfono')}</span><button class="apoProfileEdit" id="profileEditPhone" type="button">✎</button></div></div>
      </section>
      <section class="apoProfileCard apoProfileLockedCard">
        <article><span>🎓</span><div><b>Curso</b><small>${esc(d.courseLabel)}</small></div><span class="apoProfileLock">🔒</span></article>
        <article><span>🏫</span><div><b>Colegio</b><small>${esc(d.school)}</small></div><span class="apoProfileLock">🔒</span></article>
        <p>ⓘ Estos datos son administrados por la directiva del curso y no pueden ser modificados.</p>
      </section>
      <section class="apoProfileCard"><h2>Información personal</h2>
        <article class="apoProfileRow"><span>👤</span><div><b>Nombre completo</b><small>${esc(d.name)}</small></div><button class="apoProfileEdit" id="profileEditName" type="button">✎</button></article>
        <article class="apoProfileRow"><span>📱</span><div><b>Teléfono</b><small>${esc(d.phone||'Agregar teléfono')}</small></div><button class="apoProfileEdit" id="profileEditPhone2" type="button">✎</button></article>
      </section>
      <section class="apoProfileCard apoProfileCommCard"><div class="apoProfileCardHead"><h2>Mis preferencias de comunicación</h2></div><div class="apoProfileChannels"><article class="apoProfileChannel push"><span>🔔</span><b>Push</b><small>${p.push?'Activado':'Desactivado'}</small></article><article class="apoProfileChannel email"><span>✉️</span><b>Correos</b><small>${p.email?'Activado':'Desactivado'}</small></article><article class="apoProfileChannel sms"><span>💬</span><b>SMS</b><small>${p.sms?'Activado':'Desactivado'}</small></article></div></section>
      <section class="apoProfileCard apoProfileSummary"><div class="apoProfileCardHead"><div><h2>Resumen de comunicaciones</h2><p>Últimos 30 días</p></div></div><div class="apoProfileSummaryGrid"><article><span>🔔</span><b>${Number(counts.push||0)}</b><small>Push recibidas</small></article><article><span>✉️</span><b>${Number(counts.email||0)}</b><small>Correos recibidos</small></article><article><span>💬</span><b>${Number(counts.sms||0)}</b><small>SMS recibidos</small></article></div></section>
    </div>`;
    document.getElementById('profileEditName')?.addEventListener('click',()=>edit('name'));
    document.getElementById('profileEditPhone')?.addEventListener('click',()=>edit('phone'));
    document.getElementById('profileEditPhone2')?.addEventListener('click',()=>edit('phone'));
    document.querySelectorAll('.navItem').forEach(b=>b.classList.remove('active'));
  }

  function bind(){
    const menu=document.getElementById('menuDropdown');
    if(!menu)return;
    const button=menu.querySelector('[data-action="perfil"],[data-action="profile"]');
    if(!button||button.dataset.safeProfileBound==='1')return;
    button.dataset.safeProfileBound='1';
    button.addEventListener('click',ev=>{
      ev.preventDefault();
      ev.stopPropagation();
      ev.stopImmediatePropagation();
      menu.style.display='none';
      render();
    },true);
  }

  const observer=new MutationObserver(bind);
  observer.observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('load',()=>setTimeout(bind,100));
  window.MICURSOX_OPEN_SAFE_PROFILE=render;
})();