(function(){
'use strict';
if(window.__MX_MANUAL_REVERSAL_V1__)return;
window.__MX_MANUAL_REVERSAL_V1__=true;
const api=()=>window.CURSAPP_SUPABASE;
const escape=s=>String(s??'').replace(/[&<>"]/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[x]));
const money=n=>new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(Number(n)||0);
function course(){try{const a=JSON.parse(localStorage.getItem('cursapp_course_v1')||'{}'),b=JSON.parse(localStorage.getItem('cursapp_session_v1')||'{}');return a?.course?.id||a?.id||a?.curso_id||b?.courseId||b?.course?.id||''}catch(e){return''}}
const call=(name,params)=>api().request('rpc/'+name,{method:'POST',body:JSON.stringify(params)});
let inFlight=false,rendered='';
async function reload(){
 const r=document.body.classList.contains('cursapp-presidente')||document.body.classList.contains('cursapp-tesorero');
 const app=document.getElementById('app'),id=course();
 if(!r||!app||!id||!api()?.request)return;
 const home=app.querySelector('.mxManualPaymentEntry-home');
 if(!home){const panel=document.getElementById('mxManualReversalPanel');if(panel)panel.hidden=true;return}
 const key=id+'|'+(document.body.classList.contains('cursapp-presidente')?'p':'t');
 const existing=document.getElementById('mxManualReversalPanel');if(existing)existing.hidden=false;if(inFlight||(rendered===key&&existing))return;
 inFlight=true;
 const el=document.getElementById('mxManualReversalPanel')||document.createElement('section');
 el.id='mxManualReversalPanel';el.className='mxManualTraceCard';el.innerHTML='<strong>Historial de pagos manuales</strong><p>Cargando operaciones…</p>';
 if(!el.isConnected)app.insertAdjacentElement('afterend',el);
 try{
 const data=await call('listar_operaciones_manuales',{p_curso_id:id,p_miembro_id:null});if(!el.isConnected)return;
 const arr=Array.isArray(data)?data:[];
 if(document.body.classList.contains('cursapp-tesorero')){
   const table=app.querySelector('.tesMovementTableWrap');
   if(table){
     table.querySelectorAll('[data-mx-manual-movement]').forEach(n=>n.remove());
     const recent=arr.filter(x=>x.estado==='conciliado').slice(0,2);
     const head=table.querySelector('.tesMovementTableHead');
     recent.reverse().forEach(x=>{
       const row=document.createElement('article');row.className='tesMovementProRow v68';row.dataset.mxManualMovement=x.id;
       row.innerHTML='<div class="tesMoveInfo"><span class="tesRowIcon income">↓</span><span><b>Pago manual recibido</b><small>'+escape(x.medio)+'</small></span></div><span class="tesMovePerson">'+escape(x.alumno)+'</span><strong class="tesMoveAmount ok">+ '+money(x.monto_total)+'</strong><span class="tesMoveDate">'+escape(new Date(x.fecha).toLocaleDateString('es-CL'))+'</span>';
       if(head)head.insertAdjacentElement('afterend',row);else table.prepend(row);
     });
   }
 }
 el.innerHTML='<strong>Historial de pagos manuales</strong><small>Puedes reversar un registro incorrecto dejando evidencia y motivo.</small>'+(arr.length?arr.map(x=>'<div class="mxManualTraceRow"><span>'+escape(x.alumno)+' · '+escape(new Date(x.fecha).toLocaleString('es-CL'))+'<br><b>'+money(x.monto_total)+'</b> · '+escape(x.medio)+'<br><small>'+escape(x.estado==='reversado'?'Reversado · '+(x.reversa_motivo||''): 'Conciliado')+'</small></span>'+(x.estado==='conciliado'?'<button type="button" data-reverse="'+escape(x.id)+'">Reversar</button>':'')+'</div>').join(''):'<p>Sin operaciones manuales registradas.</p>');
 el.querySelectorAll('[data-reverse]').forEach(button=>button.addEventListener('click',async()=>{
 if(inFlight)return;
 const reason=window.prompt('Indica el motivo de la reversa (mínimo 8 caracteres):','Registro realizado por error');
 if(reason===null)return;
 if(reason.trim().length<8){window.alert('El motivo debe contener al menos 8 caracteres.');return}
 if(!window.confirm('¿Confirmas la reversa? Las cuotas regresarán a pendiente y el historial conservará la operación original.'))return;
 inFlight=true;button.disabled=true;
 try{
 const result=await call('reversar_pago_manual',{p_operacion_id:button.dataset.reverse,p_motivo:reason.trim()});
 if(result?.estado!=='reversado')throw Error('No se confirmó la reversa');
 window.alert('Operación reversada. Folio: '+result.id);
 el.remove();rendered='';
 window.dispatchEvent(new CustomEvent('cursapp:dataUpdated',{detail:{source:'reversa-manual'}}));
 }catch(err){window.alert('No se pudo reversar: '+(err.message||String(err)));button.disabled=false}finally{inFlight=false;reload()}
 }));
 rendered=key;
 }catch(err){el.innerHTML='<strong>Historial de pagos manuales</strong><p>No disponible: '+escape(err.message)+'</p>';rendered=''}finally{inFlight=false}
}
function init(){
 const app=document.getElementById('app');
 if(!app)return;
 let scheduled=false;
 const observer=new MutationObserver(()=>{
  if(scheduled)return;
  scheduled=true;
  setTimeout(()=>{
   scheduled=false;
   const panel=document.getElementById('mxManualReversalPanel');
   const onHome=!!app.querySelector('.mxManualPaymentEntry-home');
   if(panel)panel.hidden=!onHome;
   if(onHome&&!panel)reload();
  },350);
 });
 observer.observe(app,{childList:true,subtree:false});
 window.addEventListener('cursapp:dataUpdated',()=>{
  rendered='';
  const panel=document.getElementById('mxManualReversalPanel');
  if(panel)panel.remove();
  reload();
 });
 reload();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();