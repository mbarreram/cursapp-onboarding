(function(){
  'use strict';
  if(window.__MICURSOX_ONBOARDING_STATE_STABILITY_V3__) return;
  window.__MICURSOX_ONBOARDING_STATE_STABILITY_V3__ = true;

  const DRAFT_KEY = 'cursapp_onb_draft_v1';
  const nativeSetItem = Storage.prototype.setItem;

  function parseObject(value){
    try {
      const parsed = JSON.parse(String(value || '{}'));
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  /*
   * El onboarding principal mantiene una copia del draft dentro de su render.
   * Los catálogos de región, comuna y colegio actualizan el draft real después.
   * Cuando otro control (por ejemplo cantidad de alumnos) guardaba la copia
   * anterior, reemplazaba el objeto completo y eliminaba los datos territoriales.
   *
   * Para este único draft transitorio, fusionamos la escritura entrante con el
   * valor vigente. Así se conserva la información más reciente sin alterar el
   * comportamiento del resto de localStorage.
   */
  Storage.prototype.setItem = function(key, value){
    if(String(key) !== DRAFT_KEY){
      return nativeSetItem.call(this, key, value);
    }

    const current = parseObject(this.getItem(DRAFT_KEY));
    const incoming = parseObject(value);
    const merged = Object.assign({}, current, incoming);
    return nativeSetItem.call(this, DRAFT_KEY, JSON.stringify(merged));
  };
})();
