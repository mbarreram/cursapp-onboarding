(function(){
'use strict';
if(window.__MX_TES_REPORT_PREVIEW_BRIDGE_V1__)return;
window.__MX_TES_REPORT_PREVIEW_BRIDGE_V1__=true;

function ym(){return new Date().toISOString().slice(0,7);}
function published(){
  try{
    const key=window.CURSAPP?.scopedKey?window.CURSAPP.scopedKey('monthly_reports_v1'):'cursapp_monthly_reports_v1';
    const arr=JSON.parse(localStorage.getItem(key)||localStorage.getItem('cursapp_monthly_reports_v1')||'[]');
    return Array.isArray(arr)&&arr.some(r=>r&&r.published);
  }catch(_){return false}
}
function install(){
  window.tesV80Preview=function(){
    const fn=window.openTreasurerReportPreview||window.MICURSOX_COURSE_REPORT_V2?.openTreasurerPreview;
    if(typeof fn==='function'){
      fn(ym(),published());
      return;
    }
    const root=document.getElementById('modalRoot');
    if(root){
      root.innerHTML='<div class="tesV80Overlay"><section class="tesV80Modal"><button onclick="tesV80Close()">×</button><h2>Vista previa para apoderados</h2><p>No se pudo cargar el formato del informe. Recarga la página e inténtalo nuevamente.</p></section></div>';
    }
  };
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
setTimeout(install,500);
})();