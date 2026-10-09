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
 const overlay=document.createElement('div');overlay.id='mxManualRosterOverlay';overlay.className='mxManualRosterOverlay';overlay.innerHTML='<section class="mxManualRosterCard" role="dialog" aria-modal="true" aria-label="Registrar pago manual"><header><div><h2>Registrar pago manual</h2><p>Selecciona el alumno y su cuota pendiente.</p></div><button type="button" data-close aria-label="Cerrar">×</button></header><div class="mxManualRosterBody"><p id="mxManualRosterStatus" role="status">Cargando alumnos y cuotas de Supabase…</p><label>Buscar alumno<input id="mxManualSearch" type="search" placeholder="Nombre o apellido" autocomplete="off" disabled></label><label>Alumno<select id="mxManualStudent" disabled><option value="">Selecciona un alumno</option></select></label><div><b>Cuotas y campañas pendientes</b><div id="mxManualPayment" class="mxManualCampaignList"></div></div><p id="mxManualDetail" aria-live="polite"></p><label>Medio recibido<select id="mxManualMethod"><option value="transferencia">🏦 Transferencia</option><option value="efectivo">💵 Efectivo</option></select></label><p class="mxManualNote">Los pagos con Transbank solo se confirman por la pasarela. No se crean cuotas nuevas desde este formulario.</p><div class="mxManualActions"><button type="button" data-close>Cancelar</button><button type="button" id="mxManualConfirm" disabled>Registrar y conciliar</button></div></div></section>';
 document.body.appendChild(overlay);overlay.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>overlay.remove());overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.remove()});
 const status=overlay.querySelector('#mxManualRosterStatus'),search=overlay.querySelector('#mxManualSearch'),student=overlay.querySelector('#mxManualStudent'),payment=overlay.querySelector('#mxManualPayment'),detail=overlay.querySelector('#mxManualDetail'),save=overlay.querySelector('#mxManualConfirm');
 let members=[],rows=[],campaigns=new Map();let course=currentCourse();
 const drawStudents=()=>{const needle=search.value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();const filtered=members.filter(m=>String(m.nombre_alumno).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(needle));const keep=student.value;student.innerHTML='<option value="">Selecciona un alumno</option>'+filtered.map(m=>'<option value="'+escapeHtml(m.id)+'">'+escapeHtml(m.nombre_alumno)+'</option>').join('');if(filtered.some(m=>m.id===keep))student.value=keep;drawPayments()};
 let picked=new Set(),busy=false;
 const cleanName=v=>String(v||'Campaña').split(/\s*[·|]\s*(?:Histórico importado|Piloto V\d+|fecha exacta|importaci[oó]n)/i)[0].trim();
 const due=p=>Math.max(0,Number(p.monto||0)-Number(p.monto_pagado||0));
 const selected=()=>rows.filter(p=>picked.has(p.id)&&p.miembro_id===student.value&&pending(p.estado)&&due(p)>0);
 const drawPayments=()=>{
   picked.clear();const id=student.value;const matches=rows.filter(p=>p.miembro_id===id&&pending(p.estado)&&due(p)>0);
   const groups=new Map();matches.forEach(p=>{const key=p.campana_id||p.concepto||p.id;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(p)});
   groups.forEach(list=>list.sort((a,b)=>String(a.fecha_vencimiento||a.periodo||a.id).localeCompare(String(b.fecha_vencimiento||b.periodo||b.id))));
   payment.innerHTML=[...groups].map(([id,list])=>{const name=cleanName(campaigns.get(id)||list[0].concepto);return '<section class="mxManualCampaign" data-group="'+escapeHtml(String(id))+'"><div class="mxManualCampaignTop"><b>'+escapeHtml(name)+'</b><span>'+list.length+' cuota(s) · '+clp(list.reduce((v,p)=>v+due(p),0))+'</span></div><div class="mxManualCampaignChoices"><button type="button" data-pick="1">1 cuota</button><button type="button" data-pick="2">2 cuotas</button><button type="button" data-pick="all">Total pendiente</button></div><small>'+escapeHtml(list.length>1?'Selecciona cuántas cuotas recibiste.':'Cuota pendiente disponible.')+'</small></section>'}).join('')||'<p>No hay cuotas pendientes para este alumno.</p>';
   const update=()=>{const pickedRows=selected();const amount=pickedRows.reduce((v,p)=>v+due(p),0);detail.innerHTML=pickedRows.length?'<b>Resumen del pago</b>'+pickedRows.map(p=>'<div>'+escapeHtml(cleanName(campaigns.get(p.campana_id)||p.concepto))+' · '+escapeHtml(p.periodo||p.fecha_vencimiento||'Cuota')+' <strong>'+clp(due(p))+'</strong></div>').join('')+'<hr><b>Total recibido: '+clp(amount)+'</b>':'';save.disabled=busy||!pickedRows.length;save.textContent=pickedRows.length?'Registrar y conciliar · '+clp(amount):'Registrar y conciliar'};
   payment.querySelectorAll('[data-pick]').forEach(btn=>btn.onclick=()=>{const section=btn.closest('[data-group]');const group=groups.get(section.dataset.group)||[];const count=btn.dataset.pick==='all'?group.length:Number(btn.dataset.pick);group.forEach(p=>picked.delete(p.id));group.slice(0,count).forEach(p=>picked.add(p.id));section.querySelectorAll('button').forEach(b=>b.classList.toggle('selected',b===btn));update()});
   update();
 };
 search.oninput=drawStudents;student.onchange=drawPayments;
 save.onclick=async()=>{
 const chosen=selected();const method=overlay.querySelector('#mxManualMethod').value;if(!chosen.length||!['transferencia','efectivo'].includes(method)||busy)return;
 const svc=window.CURSAPP_PAYMENTS_V11;if(typeof svc?.markPaid!=='function'){status.textContent='Servicio oficial de pagos no disponible.';return}
 if(!window.confirm('¿Confirmas que recibiste y verificaste '+clp(chosen.reduce((v,p)=>v+due(p),0))+' para '+chosen.length+' cuota(s)? Se registrarán y conciliarán.'))return;
 busy=true;save.disabled=true;let successes=0;try{
 for(const p of chosen){
 const check=await api.request('pagos?select=id,estado,monto,monto_pagado,miembro_id,curso_id&id=eq.'+encodeURIComponent(p.id)+'&limit=1');const current=Array.isArray(check)?check[0]:null;
 if(!current||current.miembro_id!==p.miembro_id||!pending(current.estado)||String(current.curso_id)!==String(course))throw Error('La cuota cambió de estado. Actualiza antes de continuar.');
 const balance=due(current);if(balance!==due(p)||balance<=0)throw Error('El saldo de una cuota cambió. Actualiza antes de continuar.');
 await svc.markPaid(p.id,{amount:balance,method,conciliated:true});successes++;
 }
 if(typeof svc.refresh==='function')await svc.refresh('treasurer-manual-multi');
 overlay.remove();alert(successes+' cuota(s) registradas y conciliadas en Supabase.');try{window.dispatchEvent(new CustomEvent('cursapp:dataUpdated',{detail:{source:'tesorero-pago-manual'}}))}catch(_){}
 }catch(e){status.textContent='Se confirmaron '+successes+' de '+chosen.length+' cuotas. '+(e?.message||'Error')+' No repitas el pago: recarga y revisa los movimientos.';try{if(successes&&typeof svc.refresh==='function')await svc.refresh('treasurer-manual-partial')}catch(_){}}
 finally{busy=false;save.disabled=false;save.textContent='Registrar y conciliar'}
 };
 (async()=>{try{
 if(!course)throw Error('No se pudo identificar el curso activo. Recarga Tesorero.');
 const [people,debt,activeCampaigns]=await Promise.all([
 api.request('miembros_curso?select=id,curso_id,nombre_alumno,nombre_apoderado&curso_id=eq.'+encodeURIComponent(course)+'&order=nombre_alumno.asc&limit=200'),
 api.request('pagos?select=id,curso_id,campana_id,miembro_id,estado,monto,monto_pagado,concepto,periodo,fecha_vencimiento&curso_id=eq.'+encodeURIComponent(course)+'&limit=2000'),api.request('campanas?select=id,titulo&curso_id=eq.'+encodeURIComponent(course)+'&limit=200')]);
 members=Array.isArray(people)?people.filter(p=>p.id&&p.nombre_alumno):[];rows=Array.isArray(debt)?debt:[];campaigns=new Map((Array.isArray(activeCampaigns)?activeCampaigns:[]).map(c=>[c.id,c.titulo]));
 members.sort((a,b)=>String(a.nombre_alumno).localeCompare(String(b.nombre_alumno),'es'));
 if(!members.length)throw Error('No se pudo obtener la nómina del curso.');
 status.textContent=members.length+' alumnos encontrados. Busca por nombre o apellido.';search.disabled=false;student.disabled=false;drawStudents();
 }catch(e){status.textContent='No se pudo cargar la nómina y las cuotas: '+(e?.message||String(e))}})();
}
window.openManualPayment=open;
})();