(() => {
  'use strict';

  const isDesktop = () => window.matchMedia('(min-width:1024px)').matches;
  const SNAP_KEY = 'micursox_tesorero_header_home_v1';

  function nodes(){
    return {
      name: document.querySelector('.tesHeaderName'),
      role: document.querySelector('.tesHeaderRole'),
      course: document.querySelector('.tesHeaderCourse')
    };
  }

  function isGeneric(value){
    const text = String(value || '').replace(/\s+/g,' ').trim().toLowerCase();
    return !text || text === 'tesorero' || text === 'gestión financiera del curso' || text === 'gestion financiera del curso';
  }

  function isConciliacion(){
    const app = document.getElementById('app');
    return !!app && /conciliación por campaña/i.test(app.textContent || '');
  }

  function saveHomeHeader(){
    if(!isDesktop() || isConciliacion()) return;
    const h = nodes();
    if(!h.name || !h.role || !h.course || isGeneric(h.name.textContent)) return;
    const payload = {
      name: h.name.innerHTML,
      role: h.role.innerHTML,
      course: h.course.innerHTML
    };
    try{ sessionStorage.setItem(SNAP_KEY, JSON.stringify(payload)); }catch(_e){}
  }

  function restoreHomeHeader(){
    if(!isDesktop() || !isConciliacion()) return;
    let payload = null;
    try{ payload = JSON.parse(sessionStorage.getItem(SNAP_KEY) || 'null'); }catch(_e){}
    if(!payload) return;
    const h = nodes();
    if(h.name && payload.name) h.name.innerHTML = payload.name;
    if(h.role && payload.role) h.role.innerHTML = payload.role;
    if(h.course && payload.course) h.course.innerHTML = payload.course;
  }

  function sync(){
    if(isConciliacion()) restoreHomeHeader();
    else saveHomeHeader();
  }

  function start(){
    if(!isDesktop()) return;
    sync();
    const app = document.getElementById('app');
    if(app){
      new MutationObserver(() => {
        requestAnimationFrame(() => {
          sync();
          setTimeout(sync, 40);
          setTimeout(sync, 160);
        });
      }).observe(app, {childList:true, subtree:true});
    }
    setTimeout(sync, 300);
    setTimeout(sync, 900);
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true});
  else start();
})();