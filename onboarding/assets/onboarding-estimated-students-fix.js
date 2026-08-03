(function(){
  'use strict';
  if(window.__MICURSOX_ESTIMATED_STUDENTS_FIX_V2__) return;
  window.__MICURSOX_ESTIMATED_STUDENTS_FIX_V2__ = true;

  const DRAFT_KEY = 'cursapp_onb_draft_v1';
  let syncing = false;

  function readDraft(){
    try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}'); }
    catch (_) { return {}; }
  }

  function writeValue(input){
    if(!input) return 0;
    const value = Number(input.value || 0);
    if(!value) return 0;

    const draft = readDraft();
    draft.estimatedStudents = value;
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch (_) {}

    input.checked = true;
    document.querySelectorAll('input[name="onbEstimatedStudentsRadio"]').forEach(function(radio){
      const label = radio.closest('.onbRangeOption');
      if(label) label.classList.toggle('active', radio === input);
    });
    return value;
  }

  function synchronizeOriginalHandler(input){
    if(!input || syncing) return;
    const value = writeValue(input);
    if(!value) return;

    syncing = true;
    try {
      // El onboarding principal mantiene su estado en una clausura. Ejecutar
      // su onchange original es necesario para sincronizar ese estado, no
      // basta con cambiar localStorage o la apariencia de la tarjeta.
      if(typeof input.onchange === 'function'){
        input.onchange.call(input, new Event('change', { bubbles: false }));
      } else {
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    } finally {
      setTimeout(function(){ syncing = false; }, 0);
    }
  }

  function selectedInputFromTarget(target){
    const label = target && target.closest ? target.closest('.onbRangeOption') : null;
    return label ? label.querySelector('input[name="onbEstimatedStudentsRadio"]') : null;
  }

  // En iOS el click del label puede marcar visualmente la tarjeta sin
  // ejecutar de forma confiable el onchange del radio. Esperamos a que el
  // gesto termine y luego invocamos el manejador original.
  document.addEventListener('click', function(event){
    const input = selectedInputFromTarget(event.target);
    if(!input) return;
    writeValue(input);
    setTimeout(function(){
      const current = document.querySelector(
        'input[name="onbEstimatedStudentsRadio"][value="' + String(input.value) + '"]'
      );
      synchronizeOriginalHandler(current || input);
    }, 0);
  }, true);

  document.addEventListener('change', function(event){
    const input = event.target;
    if(input && input.matches && input.matches('input[name="onbEstimatedStudentsRadio"]')){
      writeValue(input);
    }
  }, true);

  // Última protección antes de continuar: sincroniza el radio marcado con
  // el manejador original del componente.
  document.addEventListener('click', function(event){
    const button = event.target && event.target.closest ? event.target.closest('#btnNext') : null;
    if(!button) return;
    const selected = document.querySelector('input[name="onbEstimatedStudentsRadio"]:checked');
    if(selected) writeValue(selected);
  }, true);
})();
