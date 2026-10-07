(function(){
'use strict';
if(window.__MX_TES_REVERSE_CONC_V1__) return;
window.__MX_TES_REVERSE_CONC_V1__=true;

function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}
function clp(v){try{return new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(Number(v)||0)}catch(_){return '$'+(Number(v)||0).toLocaleString('es-CL')}}
function scoped(base){try{return window.CURSAPP?.scopedKey?window.CURSAPP.scopedKey(base):'cursapp_'+base}catch(_){return 'cursapp_'+base}}
function payments(){try{const a=JSON.parse(localStorage.getItem(scoped('payments_v1'))||localStorage.getItem('cursapp_payments_v1')||'[]');return Array.isArray(a)?a:[]}catch(_){return[]}}
function findPayment(id){return payments().find(p=>String(p?.id||p?.remoteId||'')===String(id||''))||null}
function methodOf(p){return String(p?.paymentMethod||p?.paidWith||p?.metodo_pago||'').toLowerCase().trim()}
function channelOf(p){return String(p?.collectionChannel||p?.canal_recaudacion||'').toLowerCase().trim()}
function concState(p){return String(p?.conciliationStatus||p?.conciliacion_estado||'').toLowerCase().trim()}
function isAuto(p){return ['transbank','webpay'].includes(methodOf(p))||['transbank','webpay'].includes(channelOf(p))}
function paidAmount(p){return Number(p?.paidAmount??p?.monto_pagado??p?.amount??p?.monto??0)||0}

function injectCss(){
 if(document.getElementById('mxTesReverseConcCss'))return;
 const s=document.createElement('style');s.id='mxTesReverseConcCss';
 s.textContent=`
 body.cursapp-tesorero .tesUndoConcBtn{margin-top:6px;border:1px solid #fecaca;border-radius:10px;background:#fff;color:#b91c1c;padding:6px 9px;font-size:10.5px;font-weight:900;line-height:1.1;white-space:nowrap}
 body.cursapp-tesorero .tesUndoConcBtn:active{transform:scale(.98)}
 .mxTesReverseOverlay{position:fixed;inset:0;z-index:99999;background:rgba(15,23,42,.48);display:flex;align-items:flex-end;justify-content:center;padding:16px}
 .mxTesReverseSheet{width:min(100%,520px);background:#fff;border-radius:24px;padding:18px;box-shadow:0 24px 70px rgba(15,23,42,.28)}
 .mxTesReverseSheet h2{margin:2px 0 8px;font-size:21px;color:#0f172a}
 .mxTesReverseSheet p{margin:0 0 14px;color:#64748b;font-size:13px;line-height:1.45;font-weight:700}
 .mxTesReverseSummary{display:grid;grid-template-columns:1fr auto;gap:8px 14px;padding:12px 14px;border:1px solid #e2e8f0;border-radius:16px;background:#f8fafc;margin-bottom:14px}
 .mxTesReverseSummary b{color:#0f172a}.mxTesReverseSummary span{color:#64748b;font-size:12px}.mxTesReverseSummary strong{grid-row:1/3;grid-column:2;align-self:center;color:#0f172a}
 .mxTesReverseSheet label{display:block;color:#334155;font-size:12px;font-weight:900}
 .mxTesReverseSheet textarea{width:100%;box-sizing:border-box;margin-top:7px;border:1px solid #cbd5e1;border-radius:14px;padding:11px 12px;font:inherit;font-size:13px;resize:vertical;outline:none}
 .mxTesReverseSheet textarea:focus{border-color:#8b5cf6;box-shadow:0 0 0 3px #ede9fe}
 .mxTesReverseSheet textarea.is-error{border-color:#ef4444;box-shadow:0 0 0 3px #fee2e2}
 .mxTesReverseActions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px}
 .mxTesReverseActions button{min-height:44px;border-radius:14px;font-weight:900;font-size:13px}
 .mxTesReverseCancel{border:1px solid #dbe2ea;background:#fff;color:#475569}
 .mxTesReverseConfirm{border:1px solid #fecaca;background:#fff1f2;color:#b91c1c}
 .mxTesReverseConfirm:disabled{opacity:.55}
 .mxTesReverseError{margin-top:10px;padding:9px 10px;border-radius:12px;background:#fff1f2;color:#b91c1c;font-size:12px;font-weight:800;display:none}
 `;
 document.head.appendChild(s);
}

function enhance(){
 injectCss();
 document.querySelectorAll('.tesV73PayRow.done[data-payment-id]').forEach(row=>{
   if(row.dataset.reverseReady==='1')return;
   row.dataset.reverseReady='1';
   const id=row.dataset.paymentId,p=findPayment(id),action=row.querySelector('.tesV73Action');
   if(!p||!action||concState(p)!=='conciliado'||isAuto(p))return;
   const b=document.createElement('button');
   b.type='button';b.className='tesUndoConcBtn';b.textContent='↩ Anular conciliación';
   b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();openModal(id);});
   action.appendChild(b);
 });
}

function openModal(id){
 const p=findPayment(id);if(!p||concState(p)!=='conciliado'||isAuto(p))return;
 const overlay=document.createElement('div');overlay.className='mxTesReverseOverlay';
 overlay.innerHTML=`<section class="mxTesReverseSheet" role="dialog" aria-modal="true">
   <h2>↩ Anular conciliación</h2>
   <p>El pago seguirá registrado como recibido. Solo volverá a quedar <b>pendiente de validación</b>.</p>
   <div class="mxTesReverseSummary"><div><b>${esc(p.studentName||p.alumno||'Alumno')}</b><br><span>${esc(p.guardianName||p.apoderadoName||'Apoderado')}</span></div><strong>${clp(paidAmount(p))}</strong></div>
   <label>Motivo de la anulación<textarea id="mxTesReverseReason" rows="3" placeholder="Ej: concilié el pago con un medio incorrecto"></textarea></label>
   <div class="mxTesReverseError"></div>
   <div class="mxTesReverseActions"><button type="button" class="mxTesReverseCancel">Cancelar</button><button type="button" class="mxTesReverseConfirm">Anular conciliación</button></div>
 </section>`;
 overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.remove();});
 overlay.querySelector('.mxTesReverseCancel').onclick=()=>overlay.remove();
 overlay.querySelector('.mxTesReverseConfirm').onclick=()=>confirmReverse(id,overlay);
 document.body.appendChild(overlay);
 setTimeout(()=>overlay.querySelector('#mxTesReverseReason')?.focus(),50);
}

async function confirmReverse(id,overlay){
 const reason=String(overlay.querySelector('#mxTesReverseReason')?.value||'').trim();
 const field=overlay.querySelector('#mxTesReverseReason'),err=overlay.querySelector('.mxTesReverseError'),btn=overlay.querySelector('.mxTesReverseConfirm');
 if(!reason){field?.classList.add('is-error');field?.focus();return;}
 field?.classList.remove('is-error');btn.disabled=true;btn.textContent='Anulando…';err.style.display='none';
 try{
   const api=window.CURSAPP_PAYMENTS_V11;
   if(!api||typeof api.reversePaymentReconciliation!=='function')throw new Error('La función aún no está disponible.');
   await api.reversePaymentReconciliation(id,{reason});
   overlay.remove();
   if(typeof window.go==='function')window.go('conciliacion');
 }catch(e){
   btn.disabled=false;btn.textContent='Anular conciliación';err.textContent=String(e?.message||e||'No se pudo anular la conciliación.');err.style.display='block';
 }
}

function boot(){
 injectCss();enhance();
 const root=document.getElementById('app');
 if(root)new MutationObserver(()=>requestAnimationFrame(enhance)).observe(root,{childList:true,subtree:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();