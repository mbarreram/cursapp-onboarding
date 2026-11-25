/* MiCursoX · Seguridad de datos financieros ante desconexión · fase 1.
   No guarda ni modifica pagos. Navegación de lectura permanece disponible. */
(function(){'use strict';if(window.__MX_CONNECTION_GUARD_V1__)return;window.__MX_CONNECTION_GUARD_V1__=true;
const roles=['cursapp-presidente','cursapp-tesorero','cursapp-apoderado'];
if(!roles.some(c=>document.body.classList.contains(c)))return;
let state='checking',lastOK=0,pending=null,epoch=0;
// Comprobar acceso real a datos mediante el cliente autenticado de la app; /auth/v1/health no sirve como prueba desde Safari.
function banner(){let el=document.getElementById('mxConnectivityBannerV1');if(!el){el=document.createElement('div');el.id='mxConnectivityBannerV1';el.setAttribute('role','status');el.setAttribute('aria-live','polite');el.style.cssText='position:relative!important;inset:auto!important;top:auto!important;z-index:1!important;margin:8px 12px 12px!important;padding:12px 14px!important;border-radius:14px!important;box-sizing:border-box!important;display:flex;align-items:center;gap:10px;flex-wrap:wrap;';const main=document.querySelector('main,#app,.appContainer,.pageContent');(main||document.body).appendChild(el)}return el}
function paint(){const el=banner();document.documentElement.dataset.mxConnection=state;if(state==='ready'||state==='checking'){el.hidden=true;el.style.display='none';return}el.hidden=false;el.style.display='flex';const offline=state==='offline';const message=offline?'Sin conexión a Internet. Los datos pueden estar desactualizados y las operaciones financieras están bloqueadas.':'Conexión disponible, pero no se pudo verificar la actualización de datos. Revisa tu sesión antes de operar.';el.replaceChildren();const msg=document.createElement('span');msg.textContent=message;msg.style.flex='1 1 220px';el.appendChild(msg);const retry=document.createElement('button');retry.type='button';retry.textContent='↻ Actualizar';retry.style.cssText='background:#fff;color:#6d28d9;border:1px solid #d8c8f6;border-radius:10px;padding:8px 12px;font-weight:700;cursor:pointer;';retry.addEventListener('click',async()=>{retry.disabled=true;retry.textContent='Verificando…';const ok=await check(true);if(!ok)retry.textContent='↻ Actualizar';retry.disabled=false;});el.appendChild(retry);el.title=lastOK?'Última conexión comprobada: '+new Date(lastOK).toLocaleString('es-CL'):'Todavía no se ha confirmado una conexión';}
function set(next){const was=state;state=next;paint();if(was!=='ready'&&next==='ready'){try{window.MICURSOX_REFRESH_BUSINESS_DATA?.('conexion-recuperada')?.catch?.(()=>{});}catch(_){}window.dispatchEvent(new Event('micursox:connection-restored'));}}
async function check(force){
 if(pending&&!force)return pending;
 const id=++epoch;
 const run=(async()=>{
  if(!navigator.onLine){set('offline');return false}
  set('checking');
  try{
   const api=window.CURSAPP_SUPABASE;
   if(!api||typeof api.request!=='function'){if(id===epoch)set('unverified');return false}
   // La consulta se ejecuta con las credenciales normales de MiCursoX.
   const timeout=new Promise((_,reject)=>setTimeout(()=>reject(new Error('timeout')),8000));
   await Promise.race([api.request('cursos?select=id&limit=1'),timeout]);
   if(id!==epoch)return false;
   lastOK=Date.now();set('ready');return true;
  }catch(err){
   // Una respuesta 401/403, timeout o error CORS no significa falta de Internet.
   if(id===epoch)set(navigator.onLine?'unverified':'offline');
   return false;
  }
 })();
 pending=run;try{return await run}finally{if(pending===run)pending=null}
}

function blockedTarget(el){const target=el.closest('button,a,[role="button"],input[type="submit"]');if(!target)return null;
 const txt=(target.textContent||target.getAttribute('aria-label')||target.value||'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase().trim();
 // Nunca bloquear enlaces de navegación ni botones que abren vistas.
 if(target.closest('.bottomNav,#mxUnifiedRoleMenuV4,.menuDropdown,.tesBottomNav')||target.hasAttribute('data-tab')||target.hasAttribute('data-href')||target.closest('nav'))return null;
 if(!/^(registrar y conciliar|confirmar pago recibido|confirmar pago|conciliar seleccionado|conciliar pagos seleccionados|conciliar masivo|registrar pago|guardar pago|confirmar conciliacion|publicar informe|actualizar para apoderados|publicar para apoderados|aprobar rendicion|enviar rendicion|confirmar retiro|solicitar retiro|pagar ahora|pagar cuota|ir a pagar|realizar pago|efectuar pago)/.test(txt))return null;
 return target;
}
function block(e){if(state==='ready')return;const t=blockedTarget(e.target);if(!t)return;e.preventDefault();e.stopImmediatePropagation();paint();banner().focus?.();if(e.type==='click')alert('No se puede realizar esta operación mientras MiCursoX no confirme conexión. Reintenta cuando los datos estén actualizados.');}
function protectPaymentNavigation(e){
 const link=e.target?.closest?.('a[href]');if(!link)return;
 let url;try{url=new URL(link.href,location.href)}catch(_){return}
 if(url.origin!==location.origin||!/^\/pay(?:\.html)?\/?$/.test(url.pathname))return;
 if(state==='ready'&&navigator.onLine)return;
 e.preventDefault();e.stopImmediatePropagation();
 alert('No puedes iniciar un pago sin conexión verificada con MiCursoX. Conéctate y vuelve a intentar desde Pagos.');
 if(navigator.onLine)check(true);
}
function init(){paint();check(true);window.addEventListener('online',()=>check(true));window.addEventListener('offline',()=>{++epoch;set('offline')});window.addEventListener('pageshow',()=>check(true));document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')check(true)});document.addEventListener('click',protectPaymentNavigation,true);document.addEventListener('click',block,true);document.addEventListener('submit',block,true);setInterval(()=>{if(document.visibilityState==='visible')check(false)},45000);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
window.MICURSOX_CONNECTION={get status(){return state},check:()=>check(true),isReady:()=>state==='ready'};
})();