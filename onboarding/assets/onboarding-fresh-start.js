(function(){
  'use strict';

  const DRAFT_KEYS = [
    'cursapp_onb_draft_v1',
    'cursapp_onboarding_step',
    'cursapp_onboarding_mode',
    'cursapp_onboarding_progress'
  ];
  const INTERNAL_RELOAD_KEY = 'micursox_onboarding_internal_reload';

  let preserveInternalReload = false;
  try {
    preserveInternalReload = sessionStorage.getItem(INTERNAL_RELOAD_KEY) === '1';
    sessionStorage.removeItem(INTERNAL_RELOAD_KEY);
  } catch (_) {}

  // Una apertura nueva comienza desde cero. Solo una recarga interna controlada
  // para avanzar de paso conserva el borrador actual.
  if(!preserveInternalReload){
    DRAFT_KEYS.forEach(function(key){
      try { localStorage.removeItem(key); } catch (_) {}
      try { sessionStorage.removeItem(key); } catch (_) {}
    });
  }

  window.__MICURSOX_ONBOARDING_FRESH_START__ = true;
})();