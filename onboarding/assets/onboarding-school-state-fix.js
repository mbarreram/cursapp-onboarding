(function(){
  'use strict';
  if(window.__MICURSOX_SCHOOL_STATE_FIX__) return;
  window.__MICURSOX_SCHOOL_STATE_FIX__ = true;

  const DRAFT_KEY = 'cursapp_onb_draft_v1';
  const SCHOOL_KEY = 'micursox_onb_selected_school_v1';

  function readJSON(key){
    try { return JSON.parse(localStorage.getItem(key) || '{}'); }
    catch (_) { return {}; }
  }

  function writeJSON(key, value){
    try { localStorage.setItem(key, JSON.stringify(value || {})); }
    catch (_) {}
  }

  function clean(value){ return String(value || '').trim(); }

  function persistVisibleSchool(){
    const selected = document.querySelector('#onbSchoolSelectedStable.isVisible');
    const name = clean(selected?.querySelector('.onbSchoolSelectedName')?.textContent);
    const meta = clean(selected?.querySelector('.onbSchoolMeta')?.textContent);
    const select = document.getElementById('onbSchool');
    const schoolId = clean(select?.value);

    if(!name || !schoolId) return;

    const rbdMatch = meta.match(/RBD\s+([^·]+)/i);
    const school = {
      schoolId,
      schoolName: name,
      schoolRbd: clean(rbdMatch?.[1]).replace(/^—$/, '')
    };

    writeJSON(SCHOOL_KEY, school);
    writeJSON(DRAFT_KEY, { ...readJSON(DRAFT_KEY), ...school });
  }

  function restoreSchoolMetadata(){
    const draft = readJSON(DRAFT_KEY);
    if(clean(draft.schoolName)) return;

    const stored = readJSON(SCHOOL_KEY);
    if(!clean(stored.schoolName)) return;
    if(clean(draft.schoolId) && clean(stored.schoolId) && clean(draft.schoolId) !== clean(stored.schoolId)) return;

    writeJSON(DRAFT_KEY, { ...draft, ...stored });
  }

  document.addEventListener('click', function(event){
    if(event.target.closest('.onbSchoolResult')){
      setTimeout(persistVisibleSchool, 0);
      setTimeout(persistVisibleSchool, 80);
    }
    if(event.target.closest('.onbSchoolChange') || event.target.closest('#onbSchoolClearStable')){
      writeJSON(SCHOOL_KEY, {});
    }
    if(event.target.closest('#btnNext')){
      persistVisibleSchool();
      restoreSchoolMetadata();
    }
  }, true);

  const app = document.getElementById('app') || document.body;
  const observer = new MutationObserver(function(){
    persistVisibleSchool();
    restoreSchoolMetadata();
  });
  observer.observe(app, { childList: true, subtree: true });

  restoreSchoolMetadata();
})();
