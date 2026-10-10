(function(){
'use strict';
if(window.__MX_MANUAL_REVERSAL_V1__)return;
window.__MX_MANUAL_REVERSAL_V1__=true;
const api=()=>window.CURSAPP_SUPABASE;
const escape=s=>String(s??'').replace(/[&<>"]/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[x]));
const money=n=>new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(Number(n)||0);
function course(){try{const a=JSON.parse(localStorage.getItem('cursapp_course_v1')||'{}'),b=JSON.parse(localStorage.getItem('cursapp_session_v1')||'{}');return a?.course?.id||a?.id||a?.curso_id||b?.courseId||b?.course?.id||''}catch(e){return''}}
const call=(name,params)=>api().request('rpc/'+name,{method:'POST',body:JSON.stringify(params)});
let inFlight=false,rendered='',panelNode=null,refreshAfterFlight=false,lastOperations=[];
function syncMovements(arr){
 const app=document.getElementById('app');
 if(!app||!document.body.classList.contains('cursapp-tesorero'))return;
 const table=app.querySelector('.tesMovementTableWrap');
 if(!table)return;
 table.querySelectorAll('[data-mx-manual-movement]').forEach(n=>n.remove());
 const recent=arr.filter(x=>x.estado==='conciliado'||x.estado==='reversado')
   .slice().sort((a,b)=>String(b.estado==='reversado'?(b.reversado_at||b.fecha):b.fecha).localeCompare(String(a.estado==='reversado'?(a.reversado_at||a.fecha):a.fecha))).slice(0,3);
 const head=table.querySelector('.tesMovementTableHead');
 recent.reverse().forEach(x=>{
   const reversed=x.estado==='reversado';
   const row=document.createElement('article');row.className='tesMovementProRow v68';row.dataset.mxManualMovement=x.id;
   const at=reversed?(x.reversado_at||x.fecha):x.fecha;row.dataset.mxFinancialAt=at;
   row.innerHTML='<div class="tesMoveInfo"><span class="tesRowIcon '+(reversed?'expense':'income')+'" '+(reversed?'style="background:#fee2e2;color:#b91c1c"':'')+'>'+(reversed?'↶':'↓')+'</span><span><b>'+(reversed?'Pago manual reversado':'Pago manual recibido')+'</b><small>'+escape(x.medio)+'</small></span></div><span class="tesMovePerson">'+escape(x.alumno)+'</span><strong class="tesMoveAmount '+(reversed?'':'ok')+'" '+(reversed?'style="color:#b91c1c"':'')+'>'+(reversed?'− ':'+ ')+money(x.monto_total)+'</strong><span class="tesMoveDate">'+escape(new Date(at).toLocaleDateString('es-CL'))+'</span>';
   if(head)head.insertAdjacentElement('afterend',row);else table.prepend(row);
 });
 sortFinancialRows(table);
}
let lastTransbank=[],transbankCourse='',transbankFetchedAt=0;
function sortFinancialRows(table){
 const head=table.querySelector('.tesMovementTableHead');if(!head)return;
 const rows=Array.from(table.querySelectorAll('[data-mx-manual-movement],[data-mx-transbank-movement]'));
 rows.sort((a,b)=>String(b.dataset.mxFinancialAt||'').localeCompare(String(a.dataset.mxFinancialAt||'')));
 let anchor=head;for(const row of rows){anchor.insertAdjacentElement('afterend',row);anchor=row}
}
function renderTransbankHistory(arr){
 const panel=document.getElementById('mxManualReversalPanel');
 if(!panel||!document.body.classList.contains('cursapp-tesorero'))return;
 let list=panel.querySelector('#mxTransbankPaymentHistory');
 if(!list){list=document.createElement('section');list.id='mxTransbankPaymentHistory';list.style.cssText='margin-top:16px;border-top:1px solid #e2e8f0;padding-top:14px';panel.appendChild(list)}
 const items=Array.isArray(arr)?arr:[];
 list.innerHTML='<strong>Historial Transbank</strong><small>Últimas '+items.length+' transacciones autorizadas del curso, según Supabase.</small>'+
  (items.length?items.map(x=>'<div class="mxManualTraceRow"><span>'+escape(x.alumno||'Alumno')+' · '+escape(x.campana||'Campaña')+'<br><b>'+money(x.monto_cuota)+'</b> · Transbank · Autorizado<br><small>'+escape(x.fecha?new Date(x.fecha).toLocaleString('es-CL'):'Sin fecha')+'</small></span>'+(x.environment==='integration'?'<button type="button" data-mx-refund="'+escape(x.id)+'">Anular pago</button>':'')+'</div>').join(''):'<p>No hay transacciones Transbank autorizadas.</p>');
 list.querySelectorAll('[data-mx-refund]').forEach(b=>b.addEventListener('click',()=>requestRefund(b.dataset.mxRefund)));
}
let refundBusy=false;
async function requestRefund(id){
 if(refundBusy)return;
 const tx=lastTransbank.find(x=>x.id===id);
 if(!tx||tx.environment!=='integration')return;
 const reason=window.prompt('Motivo de anulación total de '+money(tx.monto_cobrado)+' (mínimo 8 caracteres):','Pago de prueba en integración');
 if(reason===null)return;
 if(reason.trim().length<8){window.alert('Indica un motivo de al menos 8 caracteres.');return}
 if(!window.confirm('ATENCIÓN: se enviará una anulación TOTAL a Transbank por '+money(tx.monto_cobrado)+'. El curso dejará de contabilizar '+money(tx.monto_cuota)+'. ¿Continuar?'))return;
 if(!window.confirm('Confirma por segunda vez la anulación de '+escape(tx.alumno||'este alumno')+'. Esta solicitud no se debe repetir si ocurre un error.'))return;
 refundBusy=true;
 const buttons=document.querySelectorAll('[data-mx-refund]');buttons.forEach(b=>b.disabled=true);
 try{
  const res=await api().functions.invoke('webpay-refund',{body:{transaction_id:id,reason:reason.trim()}});
  if(res.error)throw res.error;
  if(!res.data?.ok)throw new Error('Transbank no confirmó la anulación.');
  window.alert('Anulación confirmada. Referencia: '+res.data.refund_id);
  transbankFetchedAt=0;rendered='';lastTransbank=[];
  window.dispatchEvent(new CustomEvent('cursapp:dataUpdated',{detail:{financial:true,source:'transbank-refund'}}));
  await reload();
 }catch(e){
  window.alert('No se confirmó la anulación: '+String(e.message||e)+'. Si existe una solicitud, revisa el estado antes de volver a intentar.');
 }finally{refundBusy=false;buttons.forEach(b=>b.disabled=false)}
}
function syncTransbankMovements(arr){
 const table=document.querySelector('#app .tesMovementTableWrap');
 if(!table||!document.body.classList.contains('cursapp-tesorero'))return;
 renderTransbankHistory(arr);
 table.querySelectorAll('[data-mx-transbank-movement]').forEach(x=>x.remove());
 const head=table.querySelector('.tesMovementTableHead');
 arr.slice(0,3).reverse().forEach(x=>{
  const row=document.createElement('article');row.className='tesMovementProRow v68';row.dataset.mxTransbankMovement=x.id;row.dataset.mxFinancialAt=x.fecha||'';
  const at=x.fecha?new Date(x.fecha):null;
  row.innerHTML='<div class="tesMoveInfo"><span class="tesRowIcon income">↓</span><span><b>Pago recibido · Transbank</b><small>'+escape(x.campana||'Pago Webpay')+'</small></span></div><span class="tesMovePerson">'+escape(x.alumno||'Alumno')+'</span><strong class="tesMoveAmount ok">+ '+money(x.monto_cuota)+'</strong><span class="tesMoveDate">'+escape(at&&!isNaN(at.getTime())?at.toLocaleDateString('es-CL'):'')+'</span>';
  if(head)head.insertAdjacentElement('afterend',row);else table.prepend(row);
 });
 sortFinancialRows(table);
}
async function refreshTransbank(id,force=false){
 if(!document.body.classList.contains('cursapp-tesorero'))return;
 if(!force&&transbankCourse===id&&Date.now()-transbankFetchedAt<30000){syncTransbankMovements(lastTransbank);return}
 try{
  const result=await call('movimientos_transbank_curso',{p_curso_id:id});
  if(course()!==id)return;
  lastTransbank=Array.isArray(result)?result:[];transbankCourse=id;transbankFetchedAt=Date.now();
  syncTransbankMovements(lastTransbank);
 }catch(e){console.warn('[MiCursoX] Movimientos Transbank',e)}
}
async function reload(){
 const r=document.body.classList.contains('cursapp-presidente')||document.body.classList.contains('cursapp-tesorero');
 const app=document.getElementById('app'),id=course();
 if(!r||!app||!id||!api()?.request)return;
 const home=app.querySelector('.mxManualPaymentEntry-home');
 if(!home){if(panelNode)panelNode.hidden=true;return}
 const key=id+'|'+(document.body.classList.contains('cursapp-presidente')?'p':'t');
 if(document.body.classList.contains('cursapp-tesorero')){if(lastOperations.length)syncMovements(lastOperations);refreshTransbank(id);}
 const existing=panelNode;if(existing&&existing.parentElement!==app)app.appendChild(existing);if(existing)existing.hidden=false;if(inFlight){if(rendered!==key)refreshAfterFlight=true;return}if(rendered===key&&existing)return;
 inFlight=true;
 const el=existing||document.createElement('section');panelNode=el;
 el.id='mxManualReversalPanel';el.className='mxManualTraceCard';el.innerHTML='<strong>Historial de pagos manuales</strong><p>Cargando operaciones…</p>';
 if(el.parentElement!==app)app.appendChild(el);
 try{
 const data=await call('listar_operaciones_manuales',{p_curso_id:id,p_miembro_id:null});if(!el.isConnected)return;
 const arr=Array.isArray(data)?data:[];
 lastOperations=arr;
 syncMovements(arr);
 refreshTransbank(id,true);
 el.innerHTML='<strong>Historial de pagos manuales</strong><small>Puedes reversar un registro incorrecto dejando evidencia y motivo.</small>'+(arr.length?arr.map(x=>'<div class="mxManualTraceRow"><span>'+escape(x.alumno)+' · '+escape(new Date(x.fecha).toLocaleString('es-CL'))+'<br><b>'+money(x.monto_total)+'</b> · '+escape(x.medio)+'<br><small>'+escape(x.estado==='reversado'?'Reversado · '+(x.reversa_motivo||''): 'Conciliado')+'</small></span>'+(x.estado==='conciliado'?'<button type="button" data-reverse="'+escape(x.id)+'">Reversar</button>':'')+'</div>').join(''):'<p>Sin operaciones manuales registradas.</p>');
 renderTransbankHistory(lastTransbank);
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
 rendered='';
 window.dispatchEvent(new CustomEvent('cursapp:dataUpdated',{detail:{source:'reversa-manual'}}));
 }catch(err){window.alert('No se pudo reversar: '+(err.message||String(err)));button.disabled=false}finally{inFlight=false;reload()}
 }));
 rendered=key;
 }catch(err){el.innerHTML='<strong>Historial de pagos manuales</strong><p>No disponible: '+escape(err.message)+'</p>';rendered=''}finally{inFlight=false;if(refreshAfterFlight){refreshAfterFlight=false;rendered='';queueMicrotask(reload)}}
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
   const onHome=!!app.querySelector('.mxManualPaymentEntry-home');
   if(panelNode)panelNode.hidden=!onHome;
   if(onHome)reload();
  },350);
 });
 observer.observe(app,{childList:true,subtree:false});
 window.addEventListener('cursapp:dataUpdated',e=>{
  const source=e?.detail?.source;
  if(e?.detail?.financial!==true&&!['reversa-manual','pago-manual','registro-pago-manual','manual-payment','manual-payment-reversal','conciliacion-manual','transbank-payment'].includes(source))return;
  rendered='';
  if(inFlight)refreshAfterFlight=true;else reload();
 });
 reload();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();