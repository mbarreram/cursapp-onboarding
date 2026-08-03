(function(){
  'use strict';
  if(window.__MICURSOX_ESTIMATED_STUDENTS_FIX_V3__) return;
  window.__MICURSOX_ESTIMATED_STUDENTS_FIX_V3__ = true;

  const DRAFT_KEY = 'cursapp_onb_draft_v1';
  let dispatching = false;

  function readDraft(){
    try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}'); }
    catch (_) { return {}; }
  }

  function saveSelected(input){
    if(!input) return 0;
    const value = Number(input.value || 0);
    if(!value) return 0;

    const draft = readDraft();
    draft.estimatedStudents = value;
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch (_) {}

    document.querySelectorAll('input[name="onbEstimatedStudentsRadio"]').forEach(function(radio){
      const active = radio === input;
      radio.checked = active;
      const label = radio.closest('.onbRangeOption');
      if(label) label.classList.toggle('active', active);
    });
    return value;
  }

  function radioFromTarget(target){
    const option = target && target.closest ? target.closest('.onbRangeOption') : null;
    return option ? option.querySelector('input[name="onbEstimatedStudentsRadio"]') : null;
  }

  /* Safari/PWA puede marcar el label sin emitir change. Guardamos primero el
     valor y, solo si el manejador principal todavía no lo reflejó, emitimos un
     único change. La capa de estabilidad fusiona el draft y conserva región,
     comuna y colegio. */
  document.addEventListener('click', function(event){
    const input = radioFromTarget(event.target);
    if(!input || dispatching) return;
    const value = saveSelected(input);
    if(!value) return;

    setTimeout(function(){
      const current = document.querySelector(
        'input[name="onbEstimatedStudentsRadio"][value="' + String(value) + '"]'
      );
      if(!current) return;
      const draft = readDraft();
      if(Number(draft.estimatedStudents || 0) !== value) saveSelected(current);

      dispatching = true;
      try {
        current.dispatchEvent(new Event('change', { bubbles:true }));
      } finally {
        setTimeout(function(){ dispatching = false; }, 0);
      }
    }, 0);
  }, true);

  document.addEventListener('change', function(event){
    const input = event.target;
    if(input && input.matches && input.matches('input[name="onbEstimatedStudentsRadio"]')){
      saveSelected(input);
    }
  }, true);
})();
