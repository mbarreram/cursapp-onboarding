/* MiCursoX · Acceso directo a registro de pagos manuales, sin nuevos asientos contables. */
(function(){'use strict';if(window.__MX_MANUAL_PAY_ENTRY_V1__)return;window.__MX_MANUAL_PAY_ENTRY_V1__=true;
const isTes=()=>document.body.classList.contains('cursapp-tesorero');
const isPres=()=>document.body.classList.contains('cursapp-presidente');
function open(){const fn=isTes()?window.openManualPayment:window.openPresidentPaymentModal;if(typeof fn!=='function'){alert('El registro de pagos todavía no termina de cargar. Intenta nuevamente en unos segundos.');return}fn();}
function button(kind){const b=document.createElement('button');b.type='button';b.className='mxManualPaymentEntry mxManualPaymentEntry-'+kind;b.setAttribute('aria-label','Registrar pago manual de una cuota');b.innerHTML='<span aria-hidden="true">💵</span><span><strong>Registrar pago manual</strong><small>Efectivo o transferencia recibida</small></span><span aria-hidden="true">›</span>';b.addEventListener('click',open);return b;}
function apply(){if(isPres()){document.querySelectorAll('.presMockQuick').forEach(b=>{if(b.querySelector('b')?.textContent.trim()==='Registrar pago'){b.querySelector('b').textContent='Registrar pago manual';b.setAttribute('aria-label','Registrar pago manual de una cuota');}});return}
if(!isTes())return;const app=document.getElementById('app');if(!app)return;const home=document.querySelector('.navItem.active[data-tab="home"]');const conc=document.querySelector('.navItem.active[data-tab="conciliacion"]');
if(home){const dash=app.querySelector('.tesV81Home,.tesHomeV81,.tesHomeV68,.tesDashboard,.tesHomePage')||app.firstElementChild;if(dash&&dash.querySelector('.mxManualPaymentEntry-home')===null){const b=button('home');const candidate=dash.querySelector('.tesQuickGrid,.tesV81QuickGrid,.tesV68QuickGrid,.tesHomeQuick,.tesV68QuickActions');if(candidate)candidate.prepend(b);else dash.prepend(b)}}
if(conc){const root=app.querySelector('.tesConcPage');if(root&&!root.querySelector('.mxManualPaymentEntry-conciliar')){const b=button('conciliar');const first=root.querySelector('.tesV73CampaignCompact,.tesCampaignSelector,.tesV75CampaignCard,.tesConcTools')||root.firstElementChild;if(first)first.before(b);else root.prepend(b)}}
}
function boot(){apply();const observer=new MutationObserver(()=>{apply()});observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();