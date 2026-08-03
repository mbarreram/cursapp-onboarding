(function(){
  'use strict';
  if(window.__MICURSOX_ONBOARDING_STATE_STABILITY_V2__) return;
  window.__MICURSOX_ONBOARDING_STATE_STABILITY_V2__ = true;

  const DRAFT_KEY = 'cursapp_onb_draft_v1';
  const INTERNAL_RELOAD_KEY = 'micursox_onboarding_internal_reload';

  const readDraft = () => {
    try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}'); }
    catch (_) { return {}; }
  };

  const writeDraft = patch => {
    try {
      const current = readDraft();
      localStorage.setItem(DRAFT_KEY, JSON.stringify(Object.assign({}, current, patch || {})));
    } catch (_) {}
  };

  function selectEstimated(input){
    if(!input) return;
    const value = Number(input.value || 0);
    if(!value) return;

    writeDraft({ estimatedStudents: value });
    document.querySelectorAll('input[name="onbEstimatedStudentsRadio"]').forEach(radio => {
      const active = radio === input;
      radio.checked = active;
      const option = radio.closest('.onbRangeOption');
      if(option) option.classList.toggle('active', active);
    });
  }

  // Safari/PWA puede marcar visualmente el label sin mantener el estado.
  // Se captura el toque sin ejecutar el onchange antiguo, porque ese handler
  // vuelve a renderizar usando una copia desactualizada y borra territorio/colegio.
  document.addEventListener('click', function(event){
    const option = event.target && event.target.closest
      ? event.target.closest('.onbRangeOption')
      : null;
    if(!option) return;
    const input = option.querySelector('input[name="onbEstimatedStudentsRadio"]');
    if(!input) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    selectEstimated(input);
  }, true);

  document.addEventListener('change', function(event){
    const target = event.target;
    if(!(target instanceof HTMLInputElement)) return;
    if(target.name !== 'onbEstimatedStudentsRadio') return;

    event.preventDefault();
    event.stopImmediatePropagation();
    selectEstimated(target);
  }, true);

  // En el paso 1 avanzamos usando el borrador consolidado. La recarga interna
  // permite que onboarding.js reconstruya su estado en memoria sin perder datos.
  document.addEventListener('click', function(event){
    const button = event.target && event.target.closest ? event.target.closest('#btnNext') : null;
    if(!button) return;

    const draft = readDraft();
    const isStepOne = Number(draft.step || 1) === 1;
    const params = new URLSearchParams(location.search);
    const isPresidentFlow = (params.get('mode') || 'apoderado').toLowerCase() === 'directiva' &&
      (params.get('role') || 'presidente').toLowerCase() === 'presidente';
    if(!isStepOne || !isPresidentFlow) return;

    const selected = document.querySelector('input[name="onbEstimatedStudentsRadio"]:checked');
    if(selected) selectEstimated(selected);

    const current = readDraft();
    if(!current.regionId || !current.comunaId || !current.schoolId) return;
    if(!Number(current.estimatedStudents || 0)) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    writeDraft({ step: 2 });
    try { sessionStorage.setItem(INTERNAL_RELOAD_KEY, '1'); } catch (_) {}
    location.reload();
  }, true);
})();