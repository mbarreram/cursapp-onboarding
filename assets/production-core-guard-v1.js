(function(){
  'use strict';
  if (window.__MICURSOX_PRODUCTION_CORE_GUARD_V1__) return;
  window.__MICURSOX_PRODUCTION_CORE_GUARD_V1__ = true;

  // La experiencia productiva nunca debe activar datos demo desde los roles.
  try {
    window.CURSAPP = window.CURSAPP || {};
    window.CURSAPP.DEMO_MODE = false;
  } catch (_) {}

  // Evita habilitar herramientas de depuración mediante la URL productiva.
  try {
    const url = new URL(window.location.href);
    let changed = false;
    ['debug','demo','seed','reset'].forEach(function(key){
      if (url.searchParams.has(key)) {
        url.searchParams.delete(key);
        changed = true;
      }
    });
    if (changed) history.replaceState(history.state, document.title, url.pathname + (url.search ? url.search : '') + url.hash);
  } catch (_) {}

  const DEV_IDS = [
    'resetBtn','resetDemoBtn','demoResetBtn','presResetBtn','tesResetBtn',
    'debugBtn','debugPanel','demoPanel','seedDemoBtn'
  ];

  function neutralizeDevControls(root){
    const scope = root && root.querySelectorAll ? root : document;
    DEV_IDS.forEach(function(id){
      const el = document.getElementById(id);
      if (!el) return;
      try {
        el.disabled = true;
        el.hidden = true;
        el.setAttribute('aria-hidden','true');
        el.tabIndex = -1;
      } catch (_) {}
    });
    try {
      scope.querySelectorAll('[data-debug],[data-demo-action],[data-reset-demo]').forEach(function(el){
        el.disabled = true;
        el.hidden = true;
        el.setAttribute('aria-hidden','true');
        el.tabIndex = -1;
      });
    } catch (_) {}
  }

  function start(){
    neutralizeDevControls(document);
    const observer = new MutationObserver(function(mutations){
      mutations.forEach(function(m){
        Array.from(m.addedNodes || []).forEach(function(node){
          if (node && node.nodeType === Node.ELEMENT_NODE) neutralizeDevControls(node);
        });
      });
    });
    observer.observe(document.documentElement,{subtree:true,childList:true});
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true});
  else start();
})();
