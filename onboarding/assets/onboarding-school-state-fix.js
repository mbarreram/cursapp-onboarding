(function(){
  'use strict';
  if(window.__MICURSOX_SCHOOL_STATE_FIX_V2__) return;
  window.__MICURSOX_SCHOOL_STATE_FIX_V2__ = true;

  const DRAFT_KEY = 'cursapp_onb_draft_v1';
  const SCHOOL_KEY = 'micursox_onb_selected_school_v1';
  let territorySnapshot = null;

  function readJSON(key){
    try { return JSON.parse(localStorage.getItem(key) || '{}'); }
    catch (_) { return {}; }
  }

  function writeJSON(key, value){
    try { localStorage.setItem(key, JSON.stringify(value || {})); }
    catch (_) {}
  }

  function clean(value){ return String(value || '').trim(); }

  function captureTerritory(){
    const draft = readJSON(DRAFT_KEY);
    const region = document.getElementById('onbRegion');
    const comuna = document.getElementById('onbComuna');

    territorySnapshot = {
      regionId: clean(region?.value) || clean(draft.regionId),
      regionName: clean(draft.regionName),
      comunaId: clean(comuna?.value) || clean(draft.comunaId),
      comunaName: clean(draft.comunaName)
    };
  }

  function mergeProtected(extra){
    const current = readJSON(DRAFT_KEY);
    const protectedTerritory = territorySnapshot || {};
    const next = { ...current };

    ['regionId','regionName','comunaId','comunaName'].forEach(function(key){
      const protectedValue = clean(protectedTerritory[key]);
      if(protectedValue) next[key] = protectedValue;
    });

    Object.assign(next, extra || {});
    writeJSON(DRAFT_KEY, next);
    return next;
  }

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
    mergeProtected(school);
  }

  function restoreSchoolMetadata(){
    const draft = readJSON(DRAFT_KEY);
    const stored = readJSON(SCHOOL_KEY);

    const school = clean(draft.schoolName) ? {} : stored;
    if(clean(draft.schoolId) && clean(stored.schoolId) && clean(draft.schoolId) !== clean(stored.schoolId)) return;

    mergeProtected(school);
  }

  document.addEventListener('pointerdown', function(event){
    if(event.target.closest('.onbSchoolResult')) captureTerritory();
  }, true);

  document.addEventListener('touchstart', function(event){
    if(event.target.closest('.onbSchoolResult')) captureTerritory();
  }, { capture:true, passive:true });

  document.addEventListener('click', function(event){
    if(event.target.closest('.onbSchoolResult')){
      if(!territorySnapshot) captureTerritory();
      setTimeout(persistVisibleSchool, 0);
      setTimeout(persistVisibleSchool, 80);
      setTimeout(persistVisibleSchool, 220);
    }
    if(event.target.closest('.onbSchoolChange') || event.target.closest('#onbSchoolClearStable')){
      writeJSON(SCHOOL_KEY, {});
      territorySnapshot = null;
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
