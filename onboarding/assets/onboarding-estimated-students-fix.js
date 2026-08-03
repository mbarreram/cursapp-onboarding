(function(){
  'use strict';
  if(window.__MICURSOX_ESTIMATED_STUDENTS_FIX__) return;
  window.__MICURSOX_ESTIMATED_STUDENTS_FIX__ = true;

  const DRAFT_KEY = 'cursapp_onb_draft_v1';

  function readDraft(){
    try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}'); }
    catch (_) { return {}; }
  }

  function persistValue(input){
    if(!input) return;
    const value = Number(input.value || 0);
    if(!value) return;

    const draft = readDraft();
    draft.estimatedStudents = value;
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch (_) {}

    input.checked = true;
    document.querySelectorAll('input[name="onbEstimatedStudentsRadio"]').forEach(function(radio){
      const label = radio.closest('.onbRangeOption');
      if(label) label.classList.toggle('active', radio === input);
    });
  }

  document.addEventListener('click', function(event){
    const label = event.target && event.target.closest
      ? event.target.closest('.onbRangeOption')
      : null;
    if(!label) return;
    const input = label.querySelector('input[name="onbEstimatedStudentsRadio"]');
    if(!input) return;
    persistValue(input);
  }, true);

  document.addEventListener('change', function(event){
    const input = event.target;
    if(input && input.matches && input.matches('input[name="onbEstimatedStudentsRadio"]')){
      persistValue(input);
    }
  }, true);

  // En Safari/PWA la tarjeta puede verse seleccionada sin disparar change.
  // Sincronizamos el valor antes de que se ejecute el onclick original.
  document.addEventListener('click', function(event){
    const button = event.target && event.target.closest
      ? event.target.closest('#btnNext')
      : null;
    if(!button) return;
    const selected = document.querySelector('input[name="onbEstimatedStudentsRadio"]:checked');
    if(selected){
      persistValue(selected);
      selected.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }, true);
})();
