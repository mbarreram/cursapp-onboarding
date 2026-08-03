(function(){
  'use strict';
  if(window.__MICURSOX_ESTIMATED_STUDENTS_FIX_V5__) return;
  window.__MICURSOX_ESTIMATED_STUDENTS_FIX_V5__ = true;

  const DRAFT_KEY = 'cursapp_onb_draft_v1';

  function readDraft(){
    try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}'); }
    catch (_) { return {}; }
  }

  function writeDraft(draft){
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft || {})); }
    catch (_) {}
  }

  function persistValue(value){
    const numeric = Number(value || 0);
    if(!numeric) return 0;
    const draft = readDraft();
    draft.estimatedStudents = numeric;
    writeDraft(draft);
    return numeric;
  }

  function applyVisualSelection(selected){
    document.querySelectorAll('input[name="onbEstimatedStudentsRadio"]').forEach(function(radio){
      const active = radio === selected;
      radio.checked = active;
      const label = radio.closest('.onbRangeOption');
      if(label) label.classList.toggle('active', active);
    });
  }

  function radioFromTarget(target){
    const option = target && target.closest ? target.closest('.onbRangeOption') : null;
    return option ? option.querySelector('input[name="onbEstimatedStudentsRadio"]') : null;
  }

  // Safari/PWA: guardar la selección sin ejecutar el onchange original,
  // porque ese onchange hace render() con una copia antigua del territorio.
  document.addEventListener('click', function(event){
    const input = radioFromTarget(event.target);
    if(!input) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    if(persistValue(input.value)) applyVisualSelection(input);
  }, true);

  document.addEventListener('change', function(event){
    const input = event.target;
    if(!input || !input.matches || !input.matches('input[name="onbEstimatedStudentsRadio"]')) return;

    event.stopImmediatePropagation();
    if(persistValue(input.value)) applyVisualSelection(input);
  }, true);

  // La validación original conserva una copia interna antigua del draft.
  // En el paso 1 avanzamos usando la fuente vigente de localStorage, sin
  // reconstruir ni borrar región, comuna o colegio.
  document.addEventListener('click', function(event){
    const next = event.target && event.target.closest ? event.target.closest('#btnNext') : null;
    if(!next) return;

    const selected = document.querySelector('input[name="onbEstimatedStudentsRadio"]:checked');
    const draft = readDraft();
    const value = Number((selected && selected.value) || draft.estimatedStudents || 0);
    const isPresidentStepOne = Number(draft.step || 1) === 1;

    if(!isPresidentStepOne || !value) return;
    if(!draft.regionId || !draft.comunaId || !draft.schoolId) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    draft.estimatedStudents = value;
    draft.step = 2;
    writeDraft(draft);

    // Recarga controlada para que onboarding.js cree una nueva instancia con
    // el draft correcto. onboarding-fresh-start mantiene el flujo en esta pestaña.
    window.location.reload();
  }, true);
})();
