/* MiCursoX — Cobro manual por alumno/cuota canónica. No crea cobros ni usa email ficticio. */
(function(){'use strict';if(window.__MX_MANUAL_COURSE_ROSTER_V1__)return;window.__MX_MANUAL_COURSE_ROSTER_V1__=true;
const originalOpen=window.openManualPayment;
const escapeHtml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const currentCourse=()=>{try{const c=JSON.parse(localStorage.getItem('cursapp_course_v1')||'{}');const s=JSON.parse(localStorage.getItem('cursapp_session_v1')||'{}');return String(c?.course?.id||c?.id||c?.curso_id||s?.courseId||s?.course?.id||'').trim()}catch(_){return''}};
const clp=n=>new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(Number(n)||0);
const pending=s=>['pendiente','pending','vencido','overdue','partial','parcial'].includes(String(s||'').toLowerCase());
function open(){
 const api=window.CURSAPP_SUPABASE;
 if(!api||typeof api.request!=='function'){alert('No se puede consultar Supabase. Revisa la conexión.');return}
 document.getElementById('mxManualRosterOverlay')?.remove();
 const overlay=document.createElement('div');overlay.id='mxManualRosterOverlay';overlay.className='mxManualRosterOverlay';overlay.innerHTML='<section class="mxManualRosterCard" role="dialog" aria-modal="true" aria-label="Registrar pago manual"><header><div><h2>Registrar pago manual</h2><p>Selecciona el alumno y su cuota pendiente.</p></div><button type="button" data-close aria-label="Cerrar">×</button></header><div class="mxManualRosterBody"><p id="mxManualRosterStatus" role="status">Cargando alumnos y cuotas de Supabase…</p><label>Buscar alumno<input id="mxManualSearch" type="search" placeholder="Nombre o apellido" autocomplete="off" disabled></label><label>Alumno<select id="mxManualStudent" disabled><option value="">Selecciona un alumno</option></select></label><label>Cuota pendiente<select id="mxManualPayment" disabled><option value="">Selecciona una cuota</option></select></label><p id="mxManualDetail" aria-live="polite"></p><label>Medio recibido<select id="mxManualMethod"><option value="transferencia">🏦 Transferencia</option><option value="efectivo">💵 Efectivo</option></select></label><p class="mxManualNote">Los pagos con Transbank solo se confirman por la pasarela. No se crean cuotas nuevas desde este formulario.</p><div class="mxManualActions"><button type="button" data-close>Cancelar</button><button type="button" id="mxManualConfirm" disabled>Confirmar pago recibido</button></div></div></section>';
 document.body.appendChild(overlay);overlay.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>overlay.remove());overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.remove()});
 const status=overlay.querySelector('#mxManualRosterStatus'),search=overlay.querySelector('#mxManualSearch'),student=overlay.querySelector('#mxManualStudent'),payment=overlay.querySelector('#mxManualPayment'),detail=overlay.querySelector('#mxManualDetail'),save=overlay.querySelector('#mxManualConfirm');
 let members=[],rows=[];let course=currentCourse();
 const drawStudents=()=>{const needle=search.value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();const filtered=members.filter(m=>String(m.nombre_alumno).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(needle));const keep=student.value;student.innerHTML='<option value="">Selecciona un alumno</option>'+filtered.map(m=>'<option value="'+escapeHtml(m.id)+'">'+escapeHtml(m.nombre_alumno)+'</option>').join('');if(filtered.some(m=>m.id===keep))student.value=keep;drawPayments()};
 const drawPayments=()=>{const id=student.value;const matches=rows.filter(p=>p.miembro_id===id&&pending(p.estado));payment.innerHTML='<option value="">Selecciona una cuota pendiente</option>'+matches.map(p=>'<option value="'+escapeHtml(p.id)+'">'+escapeHtml(p.concepto||p.campana_nombre||'Cuota')+' · '+escapeHtml(p.periodo||p.fecha_vencimiento||'Sin período')+' · '+clp((p.monto||0)-(p.monto_pagado||0))+'</option>').join('');payment.disabled=!id||!matches.length;save.disabled=true;detail.textContent=id&&!matches.length?'Este alumno no tiene cuotas pendientes disponibles. No se registrará un cobro sin una cuota identificada.':'';};
 const selected=()=>rows.find(r=>r.id===payment.value);
 payment.onchange=()=>{const p=selected();detail.textContent=p?'Saldo pendiente: '+clp((p.monto||0)-(p.monto_pagado||0))+' · '+(p.concepto||'Cuota'):'';save.disabled=!p||Number(p.monto||0)-Number(p.monto_pagado||0)<=0};
 search.oninput=drawStudents;student.onchange=drawPayments;
 save.onclick=async()=>{const p=selected();const method=overlay.querySelector('#mxManualMethod').value;if(!p||!['transferencia','efectivo'].includes(method))return;const amount=Number(p.monto||0)-Number(p.monto_pagado||0);if(!(amount>0))return;save.disabled=true;save.textContent='Confirmando…';try{
 const svc=window.CURSAPP_PAYMENTS_V11;if(typeof svc?.markPaid!=='function')throw Error('El servicio oficial de pagos no está disponible.');
 const check=await api.request('pagos?select=id,estado,monto,monto_pagado,miembro_id,curso_id&id=eq.'+encodeURIComponent(p.id)+'&limit=1');const current=Array.isArray(check)?check[0]:null;
 if(!current||current.miembro_id!==p.miembro_id||!pending(current.estado)||String(current.curso_id)!==String(course))throw Error('La cuota cambió de estado. Actualiza y vuelve a seleccionar.');
 const balance=Number(current.monto||0)-Number(current.monto_pagado||0);if(balance!==amount||balance<=0)throw Error('El saldo cambió. Actualiza y vuelve a seleccionar.');
 await svc.markPaid(p.id,{amount:balance,method,conciliated:true});
 if(typeof svc.refresh==='function')await svc.refresh('treasurer-manual-roster');
 overlay.remove();alert('Pago registrado y confirmado en Supabase.');try{window.dispatchEvent(new CustomEvent('cursapp:dataUpdated',{detail:{source:'tesorero-pago-manual'}}))}catch(_){}
 }catch(e){status.textContent=e?.message||'No se pudo confirmar el pago en Supabase.';save.disabled=false}finally{save.textContent='Confirmar pago recibido'}};
 (async()=>{try{
 if(!course)throw Error('No se pudo identificar el curso activo. Recarga Tesorero.');
 const [people,debt]=await Promise.all([
 api.request('miembros_curso?select=id,curso_id,nombre_alumno,nombre_apoderado&curso_id=eq.'+encodeURIComponent(course)+'&order=nombre_alumno.asc&limit=200'),
 api.request('pagos?select=id,curso_id,miembro_id,estado,monto,monto_pagado,concepto,periodo,fecha_vencimiento&curso_id=eq.'+encodeURIComponent(course)+'&limit=2000')]);
 members=Array.isArray(people)?people.filter(p=>p.id&&p.nombre_alumno):[];rows=Array.isArray(debt)?debt:[];
 const map=new Map();members.forEach(m=>{const k=String(m.nombre_alumno).trim().toLocaleLowerCase('es');const prev=map.get(k);const hasPending=id=>rows.some(p=>p.miembro_id===id&&pending(p.estado));if(!prev||(!hasPending(prev.id)&&hasPending(m.id)))map.set(k,m)});members=[...map.values()];
 if(!members.length)throw Error('No se pudo obtener la nómina del curso.');
 status.textContent=members.length+' alumnos encontrados. Busca por nombre o apellido.';search.disabled=false;student.disabled=false;drawStudents();
 }catch(e){status.textContent='No se pudo cargar la nómina y las cuotas: '+(e?.message||String(e))}})();
}
window.openManualPayment=open;
})();