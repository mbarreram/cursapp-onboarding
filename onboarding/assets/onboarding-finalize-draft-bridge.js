(function(){
  'use strict';
  if(window.__MICURSOX_ONBOARDING_FINALIZE_DRAFT_BRIDGE__) return;
  window.__MICURSOX_ONBOARDING_FINALIZE_DRAFT_BRIDGE__ = true;

  const DRAFT_KEY = 'cursapp_onb_draft_v1';

  function readDraft(){
    try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}'); }
    catch (_) { return {}; }
  }

  function ensureHidden(id, value){
    let el = document.getElementById(id);
    if(el) return el;
    const app = document.getElementById('app') || document.body;
    el = document.createElement('input');
    el.type = 'hidden';
    el.id = id;
    el.value = String(value || '');
    el.setAttribute('data-mx-finalize-bridge', '1');
    app.appendChild(el);
    return el;
  }

  function prepareFinalize(){
    const qs = new URLSearchParams(location.search);
    const mode = String(qs.get('mode') || 'apoderado').toLowerCase();
    const role = String(qs.get('role') || 'presidente').toLowerCase();
    if(mode !== 'directiva' || role !== 'presidente') return;

    const draft = readDraft();
    if(Number(draft.step || 0) !== 4) return;

    // En el paso 4 los inputs visibles de credenciales ya no existen, pero
    // onboarding.js todavía los consulta antes de finalizar. Reponemos solo
    // esos valores desde el draft ya validado en el paso 3 para no vaciarlos.
    ensureHidden('pEmail', draft.pEmail || '');
    ensureHidden('pPass', draft.pPass || '');
    ensureHidden('pPass2', draft.pPass2 || '');
  }

  document.addEventListener('pointerdown', function(ev){
    const btn = ev.target && ev.target.closest ? ev.target.closest('#btnNext') : null;
    if(!btn) return;
    if(String(btn.textContent || '').trim().toLowerCase() !== 'finalizar') return;
    prepareFinalize();
  }, true);

  document.addEventListener('click', function(ev){
    const btn = ev.target && ev.target.closest ? ev.target.closest('#btnNext') : null;
    if(!btn) return;
    if(String(btn.textContent || '').trim().toLowerCase() !== 'finalizar') return;
    prepareFinalize();
  }, true);
})();
