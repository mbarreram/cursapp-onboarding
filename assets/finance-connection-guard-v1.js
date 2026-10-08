/* MiCursoX · Seguridad de datos financieros ante desconexión · fase 1.
   No guarda ni modifica pagos. Navegación de lectura permanece disponible. */
(function(){'use strict';if(window.__MX_CONNECTION_GUARD_V1__)return;window.__MX_CONNECTION_GUARD_V1__=true;
const roles=['cursapp-presidente','cursapp-tesorero','cursapp-apoderado'];
if(!roles.some(c=>document.body.classList.contains(c)))return;
let state='checking',lastOK=0,pending=null,epoch=0;
const endpoint='https://ngxistgymgdkoaiulfbq.supabase.co/auth/v1/health';
function banner(){let el=document.getElementById('mxConnectivityBannerV1');if(!el){el=document.createElement('div');el.id='mxConnectivityBannerV1';el.setAttribute('role','status');el.setAttribute('aria-live','polite');document.body.appendChild(el)}return el}
function paint(){let el=banner();document.documentElement.dataset.mxConnection=state;if(state==='ready'){el.hidden=true;return}el.hidden=false;const offline=state==='offline';el.textContent=offline?'Sin conexión con MiCursoX. Pagos, saldos y deudas pueden estar desactualizados. Operaciones financieras bloqueadas.':'Verificando conexión con MiCursoX. Los datos financieros podrían no estar actualizados.';el.title=lastOK?'Última conexión comprobada: '+new Date(lastOK).toLocaleString('es-CL'): 'Todavía no se ha confirmado una conexión';}
function set(next){const was=state;state=next;paint();if(was!=='ready'&&next==='ready'){try{window.MICURSOX_REFRESH_BUSINESS_DATA?.('conexion-recuperada')?.catch?.(()=>{});}catch(_){}window.dispatchEvent(new Event('micursox:connection-restored'));}}
async function check(force){if(pending&&!force)return pending;const id=++epoch;const run=(async()=>{if(!navigator.onLine){set('offline');return false}set('checking');const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),6500);try{const response=await fetch(endpoint,{method:'GET',cache:'no-store',signal:controller.signal});if(id!==epoch)return false;if(!response.ok){set('offline');return false}lastOK=Date.now();set('ready');return true}catch(_){if(id===epoch)set('offline');return false}finally{clearTimeout(timeout)}})();pending=run;try{return await run}finally{if(pending===run)pending=null}}
function blockedTarget(el){const target=el.closest('button,a,[role="button"],input[type="submit"]');if(!target)return null;
 const txt=(target.textContent||target.getAttribute('aria-label')||target.value||'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase().trim();
 // Nunca bloquear enlaces de navegación ni botones que abren vistas.
 if(target.closest('.bottomNav,#mxUnifiedRoleMenuV4,.menuDropdown,.tesBottomNav')||target.hasAttribute('data-tab')||target.hasAttribute('data-href')||target.closest('nav'))return null;
 if(!/^(confirmar pago|conciliar seleccionado|conciliar pagos seleccionados|conciliar masivo|registrar pago|guardar pago|confirmar conciliacion|publicar informe|actualizar para apoderados|publicar para apoderados|aprobar rendicion|enviar rendicion|confirmar retiro|solicitar retiro|pagar ahora|pagar cuota|ir a pagar|realizar pago|efectuar pago)/.test(txt))return null;
 return target;
}
function block(e){if(state==='ready')return;const t=blockedTarget(e.target);if(!t)return;e.preventDefault();e.stopImmediatePropagation();paint();banner().focus?.();if(e.type==='click')alert('No se puede realizar esta operación mientras MiCursoX no confirme conexión. Reintenta cuando los datos estén actualizados.');}
function init(){paint();check(true);window.addEventListener('online',()=>check(true));window.addEventListener('offline',()=>{++epoch;set('offline')});window.addEventListener('pageshow',()=>check(true));document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')check(true)});document.addEventListener('click',block,true);document.addEventListener('submit',block,true);setInterval(()=>{if(document.visibilityState==='visible')check(false)},45000);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
window.MICURSOX_CONNECTION={get status(){return state},check:()=>check(true),isReady:()=>state==='ready'};
})();