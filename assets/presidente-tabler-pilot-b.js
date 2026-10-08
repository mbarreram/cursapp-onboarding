/* MiCursoX · Piloto iconográfico Presidente · Tabler Icons MIT
 * Alcance visual exclusivo: acciones rápidas de Home. Ningún handler ni dato se modifica.
 * SVG originales: https://github.com/tabler/tabler-icons/tree/main/icons/outline
 */
(function(){
'use strict';
if(window.__MX_PRES_TABLER_B_PILOT__)return;
window.__MX_PRES_TABLER_B_PILOT__=true;
const icons={
  "Crear campaña": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\n  <path d=\"M12 5l0 14\" />\n  <path d=\"M5 12l14 0\" />\n</svg>",
  "Enviar aviso": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\n  <path d=\"M18 8a3 3 0 0 1 0 6\" />\n  <path d=\"M10 8v11a1 1 0 0 1 -1 1h-1a1 1 0 0 1 -1 -1v-5\" />\n  <path d=\"M12 8l4.524 -3.77a.9 .9 0 0 1 1.476 .692v12.156a.9 .9 0 0 1 -1.476 .692l-4.524 -3.77h-8a1 1 0 0 1 -1 -1v-4a1 1 0 0 1 1 -1h8\" />\n</svg>",
  "Apoderados": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\n  <path d=\"M5 7a4 4 0 1 0 8 0a4 4 0 1 0 -8 0\" />\n  <path d=\"M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2\" />\n  <path d=\"M16 3.13a4 4 0 0 1 0 7.75\" />\n  <path d=\"M21 21v-2a4 4 0 0 0 -3 -3.85\" />\n</svg>",
  "Informe ejecutivo": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\n  <path d=\"M3 13a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v6a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -6\" />\n  <path d=\"M15 9a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v10a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -10\" />\n  <path d=\"M9 5a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v14a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -14\" />\n  <path d=\"M4 20h14\" />\n</svg>",
  "Registrar pago": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\n  <path d=\"M3 8a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3l0 -8\" />\n  <path d=\"M3 10l18 0\" />\n  <path d=\"M7 15l.01 0\" />\n  <path d=\"M11 15l2 0\" />\n</svg>",
  "Ver deudores": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\n  <path d=\"M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0\" />\n  <path d=\"M12 7v5l3 3\" />\n</svg>"
};
function apply(){
  document.querySelectorAll('.presMockQuick').forEach(button=>{
    if(button.dataset.mxTablerB==='1')return;
    const label=button.querySelector('b')?.textContent?.trim()||'';
    const svg=icons[label];
    if(!svg)return;
    const old=button.querySelector('svg');
    if(!old)return;
    const holder=document.createElement('span');
    holder.className='mxPresTablerBIcon';
    holder.setAttribute('aria-hidden','true');
    holder.innerHTML=svg;
    old.replaceWith(holder);
    button.dataset.mxTablerB='1';
  });
}
function boot(){apply();const root=document.getElementById('app')||document.body;new MutationObserver(apply).observe(root,{childList:true,subtree:true});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
