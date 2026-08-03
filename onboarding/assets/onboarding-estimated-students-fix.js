(function(){
  'use strict';
  if(window.__MICURSOX_ESTIMATED_STUDENTS_FIX_V4__) return;
  window.__MICURSOX_ESTIMATED_STUDENTS_FIX_V4__ = true;

  const DRAFT_KEY = 'cursapp_onb_draft_v1';

  function readDraft(){
    try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}'); }
    catch (_) { return {}; }
  }

  function persistValue(value){
    const numeric = Number(value || 0);
    if(!numeric) return 0;
    const draft = readDraft();
    draft.estimatedStudents = numeric;
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch (_) {}
    return numeric;
  }

  function applyVisualSelection(selected, value){
    document.querySelectorAll('input[name="onbEstimatedStudentsRadio"]').forEach(function(radio){
      const active = radio === selected;
      radio.checked = active;
      const label = radio.closest('.onbRangeOption');
      if(label) label.classList.toggle('active', active);
    });

    const select = document.getElementById('onbEstimatedStudents');
    if(select){
      select.value = String(value);
      // Este manejador actualiza el estado interno del onboarding sin render().
      if(typeof select.onchange === 'function') select.onchange.call(select);
    }
  }

  function radioFromTarget(target){
    const option = target && target.closest ? target.closest('.onbRangeOption') : null;
    return option ? option.querySelector('input[name="onbEstimatedStudentsRadio"]') : null;
  }

  // Se ejecuta antes que el onchange original del radio. Evita el render()
  // que reconstruía el paso con una copia antigua y borraba región/comuna/colegio.
  document.addEventListener('click', function(event){
    const input = radioFromTarget(event.target);
    if(!input) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const value = persistValue(input.value);
    if(!value) return;
    applyVisualSelection(input, value);
  }, true);

  // Protección adicional para interacción por teclado/accesibilidad.
  document.addEventListener('change', function(event){
    const input = event.target;
    if(!input || !input.matches || !input.matches('input[name="onbEstimatedStudentsRadio"]')) return;

    event.stopImmediatePropagation();
    const value = persistValue(input.value);
    if(value) applyVisualSelection(input, value);
  }, true);
})();
