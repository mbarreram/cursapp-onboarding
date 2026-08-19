(function(){
  'use strict';
  if(window.__MICURSOX_ONBOARDING_PRODUCTION_SOURCE_V1__) return;
  window.__MICURSOX_ONBOARDING_PRODUCTION_SOURCE_V1__ = true;
  window.MICURSOX_ONBOARDING_SOURCE = 'supabase';

  try { localStorage.removeItem('cursapp_onb_debug'); } catch (_) {}

  const DEMO_REFERRALS = new Set(['CURSAPP2026','DIRECTIVA2026']);

  function catalogReady(){
    return window.MICURSOX_TERRITORIAL_CATALOG?.source === 'supabase';
  }

  function placeholder(select, text){
    if(!select) return;
    const current = Array.from(select.options || []);
    const hasDemo = current.some(option => /\(demo\)|demo/i.test(option.textContent || ''));
    if(hasDemo || !catalogReady()){
      select.replaceChildren(new Option(text, '', true, true));
      select.disabled = true;
    }
  }

  function cleanDemoNodes(root){
    const scope = root?.querySelectorAll ? root : document;
    try {
      scope.querySelectorAll('option').forEach(option => {
        if(/\(demo\)|\bdemo\b/i.test(option.textContent || '')) option.remove();
      });
    } catch (_) {}

    if(!catalogReady()){
      placeholder(document.getElementById('onbRegion'), 'Cargando regiones…');
      placeholder(document.getElementById('onbComuna'), 'Cargando comunas…');
      placeholder(document.getElementById('onbSchool'), 'Cargando colegios…');
    }
  }

  function blockDemoReferral(target){
    if(!(target instanceof HTMLInputElement)) return;
    const identity = [target.id,target.name,target.placeholder].join(' ').toLowerCase();
    if(!/refer|agente|c[oó]digo/.test(identity)) return;
    const code = String(target.value || '').trim().toUpperCase();
    if(!DEMO_REFERRALS.has(code)) return;
    target.value = '';
    target.setCustomValidity('Este código de prueba no está disponible.');
    target.reportValidity();
    setTimeout(() => target.setCustomValidity(''), 1200);
  }

  document.addEventListener('input', event => blockDemoReferral(event.target), true);
  document.addEventListener('change', event => blockDemoReferral(event.target), true);

  function start(){
    cleanDemoNodes(document);
    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => Array.from(mutation.addedNodes || []).forEach(node => {
        if(node?.nodeType === Node.ELEMENT_NODE) cleanDemoNodes(node);
      }));
    });
    observer.observe(document.getElementById('app') || document.body, {childList:true,subtree:true});

    // El catálogo territorial publica este objeto sólo después de cargar BD.
    const wait = setInterval(() => {
      if(!catalogReady()) return;
      clearInterval(wait);
      try { window.MICURSOX_TERRITORIAL_CATALOG.refresh(); } catch (_) {}
    }, 120);
    setTimeout(() => clearInterval(wait), 12000);
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true});
  else start();
})();
