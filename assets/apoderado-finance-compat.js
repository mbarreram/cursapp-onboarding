(function(){
  'use strict';
  // Compatibilidad incremental: Informes de Apoderado espera el objeto global `finance`.
  // Usa datos financieros ya hidratados cuando existen y evita que la vista completa falle
  // mientras esa respuesta todavía no está disponible.
  if(!window.finance || typeof window.finance!=='object'){
    window.finance=(window.CURSAPP_APODERADO_FINANCE&&typeof window.CURSAPP_APODERADO_FINANCE==='object')
      ? window.CURSAPP_APODERADO_FINANCE
      : {};
  }
  window.addEventListener('cursapp:apoderado-finance',function(event){
    var detail=event&&event.detail;
    if(detail&&typeof detail==='object') window.finance=detail;
  });
})();
