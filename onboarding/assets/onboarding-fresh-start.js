(function(){
  'use strict';

  const DRAFT_KEYS = [
    'cursapp_onb_draft_v1',
    'cursapp_onboarding_step',
    'cursapp_onboarding_mode',
    'cursapp_onboarding_progress'
  ];

  /*
   * El onboarding es un flujo transitorio. Cada carga nueva del documento debe
   * comenzar desde el paso 1 y no recuperar información incompleta de una sesión
   * anterior. Los cambios entre pasos ocurren dentro de la misma página, por lo
   * que esta limpieza no interrumpe el avance normal del usuario.
   */
  DRAFT_KEYS.forEach(function(key){
    try { localStorage.removeItem(key); } catch (_) {}
    try { sessionStorage.removeItem(key); } catch (_) {}
  });

  window.__MICURSOX_ONBOARDING_FRESH_START__ = true;
})();
