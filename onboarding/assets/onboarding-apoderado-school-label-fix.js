(function(){
  'use strict';
  if(window.__MX_APODERADO_SCHOOL_LABEL_FIX__) return;
  window.__MX_APODERADO_SCHOOL_LABEL_FIX__ = true;

  const qs = new URLSearchParams(location.search || '');
  if(String(qs.get('mode') || '').toLowerCase() !== 'apoderado') return;

  const DRAFT_KEY = 'cursapp_onb_draft_v1';
  let lastInvite = '';
  let pending = false;

  function draft(){
    try{return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {};}catch(_){return {};}
  }
  function saveDraft(d){
    try{localStorage.setItem(DRAFT_KEY, JSON.stringify(d || {}));}catch(_){ }
  }
  function q(v){return encodeURIComponent(String(v == null ? '' : v));}

  async function resolveSchool(){
    if(pending) return;
    const api = window.CURSAPP_SUPABASE;
    if(!api || typeof api.request !== 'function') return;
    const d = draft();
    const invite = String(d.inviteCode || '').trim().toUpperCase();
    if(!invite || invite === lastInvite && d.schoolName && d.schoolName !== 'Colegio'){
      paint(d);
      return;
    }
    pending = true;
    try{
      const rows = await api.request('cursos?invite_code=eq.' + q(invite) + '&select=id,nombre,nivel,letra,anio,jornada,course_key,invite_code,colegios(nombre,region,comuna,rbd)&limit=1', {method:'GET'});
      const row = Array.isArray(rows) ? rows[0] : rows;
      if(!row) return;
      const colegio = row.colegios || {};
      const schoolName = String(colegio.nombre || '').trim();
      if(schoolName){
        d.schoolName = schoolName;
        d.regionName = String(colegio.region || d.regionName || '');
        d.comunaName = String(colegio.comuna || d.comunaName || '');
        d.schoolId = String(colegio.rbd || d.schoolId || '');
      }
      d.level = row.nivel || d.level || '';
      d.letter = row.letra || d.letter || '';
      d.year = row.anio || d.year || '';
      d.jornada = row.jornada || d.jornada || '';
      d.courseKey = row.course_key || d.courseKey || '';
      saveDraft(d);
      lastInvite = invite;
      paint(d);
    }catch(err){
      try{console.warn('[MiCursoX] no se pudo resolver el nombre del colegio', err);}catch(_){ }
    }finally{
      pending = false;
    }
  }

  function paint(d){
    const school = String(d.schoolName || '').trim();
    if(!school || school === 'Colegio') return;
    const text = [school, String(d.level || '') + String(d.letter || ''), d.year || '', d.jornada || '']
      .filter(Boolean).join(' · ').replace(' · ' + String(d.year || '') + ' · ', ' ' + String(d.year || '') + ' · ');
    document.querySelectorAll('.onbCourseBannerText').forEach(function(el){
      if(el.textContent !== text) el.textContent = text;
    });
  }

  function schedule(){ setTimeout(resolveSchool, 40); }
  document.addEventListener('click', function(ev){
    if(ev.target && (ev.target.id === 'validateInvite' || /validar|continuar/i.test(String(ev.target.textContent || '')))) schedule();
  }, true);
  window.addEventListener('pageshow', schedule);
  window.addEventListener('storage', function(ev){ if(ev.key === DRAFT_KEY) schedule(); });

  const observer = new MutationObserver(function(){
    const banner = document.querySelector('.onbCourseBannerText');
    if(!banner) return;
    const d = draft();
    if(d.schoolName && d.schoolName !== 'Colegio') paint(d);
    else schedule();
  });
  observer.observe(document.documentElement, {childList:true, subtree:true});

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule, {once:true});
  else schedule();
})();
