(function(){
  'use strict';
  if(window.__MICURSOX_PROFILE_REFERENCE_APODERADO__) return;
  window.__MICURSOX_PROFILE_REFERENCE_APODERADO__=true;

  function read(k,d){try{return JSON.parse(localStorage.getItem(k)||'')||d}catch(_){return d}}
  function activeRole(){
    var s=read('cursapp_session_v1',{})||{};
    var r=String(localStorage.getItem('cursapp_active_role_v1')||s.currentRole||s.activeRole||s.role||'apoderado').toLowerCase();
    if(r.indexOf('pres')>=0)return'presidente';
    if(r.indexOf('tesor')>=0)return'tesorero';
    return'apoderado';
  }
  function text(el){return String(el?.textContent||'').trim()}
  function valueByLabel(card,label){
    if(!card)return'';
    var nodes=Array.from(card.querySelectorAll('.profileKv span'));
    var i=nodes.findIndex(function(n){return text(n).toLowerCase()===label.toLowerCase()});
    if(i<0)return'';
    var all=Array.from(card.querySelector('.profileKv')?.children||[]),pos=all.indexOf(nodes[i]);
    return pos>=0?text(all[pos+1]):'';
  }
  function roleLabel(r,student){
    if(r==='presidente')return'Presidente del curso';
    if(r==='tesorero')return'Tesorero del curso';
    return student?'Apoderado de '+student:'Apoderado del curso';
  }
  function apply(){
    var root=document.getElementById('perfilContent');
    if(!root||!root.querySelector('#pfName')||root.querySelector('.mxProfileReferenceHero'))return false;
    var cards=Array.from(root.querySelectorAll(':scope > .profileCard, :scope > section.profileCard'));
    if(!cards.length) cards=Array.from(root.querySelectorAll('.profileCard'));
    var personal=cards.find(function(c){return /informacion personal/i.test(text(c.querySelector('.h2')))});
    var courseCard=cards.find(function(c){return /curso actual/i.test(text(c.querySelector('.h2')))});
    if(!personal||!courseCard)return false;

    var identity=personal.querySelector('.profileIdentity');
    if(!identity)return false;
    var role=activeRole();
    var name=text(identity.querySelector('.h3'))||document.getElementById('pfName')?.value||'Usuario';
    var email=text(identity.querySelector('a'))||'—';
    var phone=document.getElementById('pfPhone')?.value||'Agregar teléfono';
    var student=document.getElementById('pfAlumno')?.value||'';
    var school=text(courseCard.querySelector('.profileTitleRow .pill'))||'—';
    var course=valueByLabel(courseCard,'Curso')||'—';
    var year=valueByLabel(courseCard,'Año');

    var hero=document.createElement('section');hero.className='mxProfileReferenceHero';
    var avatar=identity.querySelector('.profileAvatar');
    hero.innerHTML='<div class="mxProfileHeroAvatarHost"></div><div class="mxProfileHeroText"><h1></h1><p class="mxProfileRoleLine"></p><div class="mxProfileContactRow"><span>✉️</span><a></a><span class="mxProfileLock">🔒</span></div><button class="mxProfilePhoneRow" type="button"><span>📱</span><b></b><span>✎</span></button></div>';
    hero.querySelector('.mxProfileHeroAvatarHost').appendChild(avatar);
    hero.querySelector('h1').textContent=name;
    hero.querySelector('.mxProfileRoleLine').textContent=roleLabel(role,student);
    var mail=hero.querySelector('a');mail.textContent=email;mail.href=email&&email!=='—'?'mailto:'+email:'#';
    hero.querySelector('.mxProfilePhoneRow b').textContent=phone||'Agregar teléfono';
    hero.querySelector('.mxProfilePhoneRow').addEventListener('click',function(){var i=document.getElementById('pfPhone');i?.scrollIntoView({behavior:'smooth',block:'center'});setTimeout(function(){i?.focus()},250)});

    var locked=document.createElement('section');locked.className='mxProfileReferenceLocked';
    locked.innerHTML='<article><span class="mxProfileInfoIcon">🎓</span><div><b>Curso</b><small></small></div><span class="mxProfileLockBox">🔒</span></article><article><span class="mxProfileInfoIcon">🏫</span><div><b>Colegio</b><small></small></div><span class="mxProfileLockBox">🔒</span></article><div class="mxProfileReferenceNote">ⓘ Estos datos son administrados por la directiva del curso y no pueden ser modificados.</div>';
    locked.querySelectorAll('small')[0].textContent=[course,year].filter(function(x){return x&&x!=='—'}).join(' ')||'—';
    locked.querySelectorAll('small')[1].textContent=school;

    personal.classList.add('mxProfilePersonalCard');
    var title=personal.querySelector('.profileTitleRow .h2');if(title)title.textContent='Información personal';
    var muted=personal.querySelector('.profileTitleRow .muted');if(muted)muted.remove();
    var pill=personal.querySelector('.profileTitleRow .pill');if(pill)pill.remove();
    identity.remove();
    courseCard.style.display='none';

    root.insertBefore(hero,personal);
    root.insertBefore(locked,personal);
    document.body.classList.add('mx-profile-apoderado-reference');
    return true;
  }
  var timer=null;
  var mo=new MutationObserver(function(){clearTimeout(timer);timer=setTimeout(apply,40)});
  mo.observe(document.documentElement,{childList:true,subtree:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});else apply();
})();