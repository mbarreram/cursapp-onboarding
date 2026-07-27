(function(){
  'use strict';
  if(window.__MICURSOX_ONBOARDING_STATE_STABILITY__) return;
  window.__MICURSOX_ONBOARDING_STATE_STABILITY__ = true;

  const DRAFT_KEY = 'cursapp_onb_draft_v1';
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

  /* El onboarding original conserva una copia del borrador en memoria. Después de
     elegir región/comuna/colegio, el catálogo territorial actualiza localStorage,
     pero el cambio de cantidad de alumnos volvía a guardar la copia antigua y
     borraba esos datos. Interceptamos solo ese radio y fusionamos el estado real. */
  document.addEventListener('change', function(event){
    const target = event.target;
    if(!(target instanceof HTMLInputElement)) return;
    if(target.name !== 'onbEstimatedStudentsRadio') return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const value = Number(target.value || 0);
    writeDraft({ estimatedStudents: value });

    document.querySelectorAll('input[name="onbEstimatedStudentsRadio"]').forEach(input => {
      const option = input.closest('.onbRangeOption');
      const active = input === target;
      input.checked = active;
      if(option) option.classList.toggle('active', active);
    });
  }, true);
})();
