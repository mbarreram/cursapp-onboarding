(function(){
  'use strict';
  if(window.__MICURSOX_ONBOARDING_STATE_STABILITY_V4__) return;
  window.__MICURSOX_ONBOARDING_STATE_STABILITY_V4__ = true;

  const DRAFT_KEY = 'cursapp_onb_draft_v1';
  const nativeSetItem = Storage.prototype.setItem;
  const PROTECTED_FIELDS = [
    'regionId',
    'regionName',
    'comunaId',
    'comunaName',
    'schoolId',
    'schoolName',
    'schoolRbd',
    'rbd'
  ];

  function parseObject(value){
    try {
      const parsed = JSON.parse(String(value || '{}'));
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  function hasValue(value){
    return value !== undefined && value !== null && String(value).trim() !== '';
  }

  /*
   * Los catálogos territoriales se sincronizan después del render original.
   * Al elegir la cantidad de alumnos, el manejador principal puede guardar una
   * copia anterior del draft con región, comuna o colegio vacíos. Conservamos
   * esos campos cuando la escritura entrante no trae un valor real.
   */
  Storage.prototype.setItem = function(key, value){
    if(String(key) !== DRAFT_KEY){
      return nativeSetItem.call(this, key, value);
    }

    const current = parseObject(this.getItem(DRAFT_KEY));
    const incoming = parseObject(value);
    const merged = Object.assign({}, current, incoming);

    PROTECTED_FIELDS.forEach(function(field){
      if(hasValue(current[field]) && !hasValue(incoming[field])){
        merged[field] = current[field];
      }
    });

    return nativeSetItem.call(this, DRAFT_KEY, JSON.stringify(merged));
  };
})();
