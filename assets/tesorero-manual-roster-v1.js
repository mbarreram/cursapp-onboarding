/* MiCursoX — Cobro manual por alumno/cuota canónica. No crea cobros ni usa email ficticio. */
(function(){'use strict';if(window.__MX_MANUAL_COURSE_ROSTER_V1__)return;window.__MX_MANUAL_COURSE_ROSTER_V1__=true;
const isPresident=document.body.classList.contains('cursapp-presidente');
const escapeHtml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const currentCourse=()=>{try{const c=JSON.parse(localStorage.getItem('cursapp_course_v1')||'{}');const s=JSON.parse(localStorage.getItem('cursapp_session_v1')||'{}');return String(c?.course?.id||c?.id||c?.curso_id||s?.courseId||s?.course?.id||'').trim()}catch(_){return''}};
const clp=n=>new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(Number(n)||0);
const pending=s=>['pendiente','pending','vencido','overdue','partial','parcial'].includes(String(s||'').toLowerCase());
function open(){
 const api=window.CURSAPP_SUPABASE;
 if(!api||typeof api.request!=='function'){alert('No se puede consultar Supabase. Revisa la conexión.');return}
 document.getElementById('mxManualRosterOverlay')?.remove();
 const overlay=document.createElement('div');overlay.id='mxManualRosterOverlay';overlay.className='mxManualRosterOverlay';overlay.innerHTML='<section class="mxManualRosterCard" role="dialog" aria-modal="true" aria-label="Registrar pago manual"><header><div><h2>Registrar pago manual</h2><p>Selecciona las cuotas o campañas recibidas.</p></div><button type="button" data-close aria-label="Cerrar">×</button></header><div class="mxManualRosterBody"><p id="mxManualRosterStatus" role="status">Cargando alumnos y cuotas de Supabase…</p><label>Buscar alumno<input id="mxManualSearch" type="search" placeholder="Nombre o apellido" autocomplete="off" disabled></label><label>Alumno<select id="mxManualStudent" disabled><option value="">Selecciona un alumno</option></select></label><div class="mxManualSection"><b>Cuotas y campañas pendientes</b><small>Elige cuántas cuotas recibiste de cada campaña.</small><div id="mxManualPayment" class="mxManualCampaignList"></div></div><p id="mxManualDetail" aria-live="polite"></p><label>Medio recibido<select id="mxManualMethod"><option value="transferencia">🏦 Transferencia</option><option value="efectivo">💵 Efectivo</option></select></label><p class="mxManualNote">Confirma únicamente dinero recibido y verificado. Cada cuota seleccionada quedará registrada y conciliada. Transbank se confirma exclusivamente por la pasarela.</p><div class="mxManualActions"><button type="button" data-close>Cancelar</button><button type="button" id="mxManualConfirm" disabled>Registrar y conciliar</button></div></div></section>';
 document.body.appendChild(overlay);overlay.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>overlay.remove());overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.remove()});
 const status=overlay.querySelector('#mxManualRosterStatus'),search=overlay.querySelector('#mxManualSearch'),student=overlay.querySelector('#mxManualStudent'),payment=overlay.querySelector('#mxManualPayment'),detail=overlay.querySelector('#mxManualDetail'),save=overlay.querySelector('#mxManualConfirm');
 let members=[],rows=[],campaigns=new Map();let course=currentCourse();
 const drawStudents=()=>{const needle=search.value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();const filtered=members.filter(m=>[m.nombre_alumno,m.nombre_apoderado].some(v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(needle)));const keep=student.value;student.innerHTML='<option value="">Selecciona un alumno</option>'+filtered.map(m=>'<option value="'+escapeHtml(m.id)+'">'+escapeHtml(m.nombre_alumno)+(m.nombre_apoderado?' · '+escapeHtml(m.nombre_apoderado):'')+'</option>').join('');if(filtered.some(m=>m.id===keep))student.value=keep;drawPayments()};
 let picked=new Set(),busy=false;
 const cleanName=v=>String(v||'Campaña').split(/\s*[·|]\s*(?:Histórico importado|Piloto V\d+|fecha exacta|importaci[oó]n)/i)[0].trim();
 const due=p=>Math.max(0,Number(p.monto||0)-Number(p.monto_pagado||0));
 const orderKey=p=>{const period=String(p.periodo||'').trim();const month=period.match(/^(\d{4})[-/](\d{1,2})(?:\D|$)/);if(month)return month[1]+'-'+month[2].padStart(2,'0');return String(p.fecha_vencimiento||period||'9999-99').slice(0,10)};
 const comparePeriods=(a,b)=>orderKey(a).localeCompare(orderKey(b))||String(a.fecha_vencimiento||'').localeCompare(String(b.fecha_vencimiento||''))||String(a.id).localeCompare(String(b.id));
 const selected=()=>rows.filter(p=>picked.has(p.id)&&p.miembro_id===student.value&&pending(p.estado)&&due(p)>0).sort(comparePeriods);
 const drawPayments=()=>{
   picked.clear();const id=student.value;if(!id){payment.innerHTML='<p class="mxManualSelectPrompt">Selecciona primero un alumno para ver sus cuotas y campañas.</p>';detail.innerHTML='';save.disabled=true;save.textContent='Selecciona cuotas para continuar';return;}const matches=rows.filter(p=>p.miembro_id===id&&pending(p.estado)&&due(p)>0);
   const groups=new Map();matches.forEach(p=>{const key=p.campana_id||p.concepto||p.id;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(p)});
   groups.forEach(list=>list.sort(comparePeriods));
   const unavailable=[...campaigns.values()].filter(c=>c?.estado==='activa'&&c?.tipo==='monthly'&&!groups.has(c.id)&&!rows.some(p=>p.miembro_id===id&&p.campana_id===c.id&&['no_participa','no_participo'].includes(String(p.estado||'').toLowerCase()))).map(c=>'<section class="mxManualCampaign mxManualUnready"><div class="mxManualCampaignTop"><b>'+escapeHtml(cleanName(c.titulo))+'</b><span>'+clp(c.monto)+'/cuota</span></div><small>Campaña disponible · No existen cuotas pendientes para este alumno. Deben generarse las cuotas faltantes antes de registrar un pago, sin duplicar cuotas ya pagadas.</small></section>').join('');
   payment.innerHTML=[...groups].map(([id,list])=>{const name=cleanName(campaigns.get(id)?.titulo||list[0].concepto);return '<section class="mxManualCampaign" data-group="'+escapeHtml(String(id))+'"><div class="mxManualCampaignTop"><b>'+escapeHtml(name)+'</b><span>'+list.length+' cuota(s) · '+clp(list.reduce((v,p)=>v+due(p),0))+'</span></div><div class="mxManualCampaignChoices">'+(list.length<=3?list.map((p,i)=>'<button type="button" data-pick="'+(i+1)+'">'+(i+1)+' cuota'+(i===0?'':'s')+'</button>').join(''):'<label class="mxManualQtyLabel">Cantidad de cuotas <select class="mxManualQty" aria-label="Cantidad de cuotas a pagar"><option value="0">Ninguna · quitar selección</option>'+list.map((p,i)=>'<option value="'+(i+1)+'">'+(i+1)+' cuotas</option>').join('')+'</select></label>')+'<button type="button" data-pick="all">Total pendiente</button></div><div class="mxManualCampaignSelected" aria-live="polite">Sin cuotas seleccionadas · $0</div><small>'+escapeHtml(list.length>1?'Selecciona cuántas cuotas recibiste.':'Cuota pendiente disponible.')+'</small></section>'}).join('')+unavailable||'<p>No hay cuotas pendientes para este alumno.</p>';
   const update=()=>{const pickedRows=selected();const amount=pickedRows.reduce((v,p)=>v+due(p),0);payment.querySelectorAll('[data-group]').forEach(section=>{const group=groups.get(section.dataset.group)||[];const chosen=group.filter(p=>picked.has(p.id));const subtotal=chosen.reduce((v,p)=>v+due(p),0);const caption=section.querySelector('.mxManualCampaignSelected');if(caption){caption.textContent=chosen.length?chosen.length+' de '+group.length+' cuotas seleccionadas · '+clp(subtotal):'Sin cuotas seleccionadas · $0';caption.classList.toggle('hasSelection',!!chosen.length);}});detail.innerHTML=pickedRows.length?'<b>Resumen del pago</b>'+pickedRows.map(p=>'<div>'+escapeHtml(cleanName(campaigns.get(p.campana_id)?.titulo||p.concepto))+' · '+escapeHtml(p.periodo||p.fecha_vencimiento||'Cuota')+' <strong>'+clp(due(p))+'</strong></div>').join('')+'<hr><b>Total recibido: '+clp(amount)+'</b>':'';save.disabled=busy||!pickedRows.length;save.textContent=pickedRows.length?'Registrar y conciliar · '+clp(amount):'Selecciona cuotas para continuar'};
   payment.querySelectorAll('[data-pick]').forEach(btn=>btn.onclick=()=>{const section=btn.closest('[data-group]');const group=groups.get(section.dataset.group)||[];const requested=btn.dataset.pick==='all'?group.length:Number(btn.dataset.pick);const currently=group.filter(p=>picked.has(p.id)).length;const count=currently===requested?0:requested;group.forEach(p=>picked.delete(p.id));group.slice(0,count).forEach(p=>picked.add(p.id));section.querySelectorAll('button').forEach(b=>b.classList.toggle('selected',count>0&&(b.dataset.pick===String(count)||(b.dataset.pick==='all'&&count===group.length))));const qty=section.querySelector('.mxManualQty');if(qty)qty.value=String(count);update()});
   payment.querySelectorAll('.mxManualQty').forEach(qty=>qty.onchange=()=>{const section=qty.closest('[data-group]');const group=groups.get(section.dataset.group)||[];const count=Number(qty.value);if(!Number.isInteger(count)||count<0||count>group.length)return;group.forEach(p=>picked.delete(p.id));group.slice(0,count).forEach(p=>picked.add(p.id));section.querySelectorAll('[data-pick]').forEach(btn=>btn.classList.toggle('selected',btn.dataset.pick===String(count)||(btn.dataset.pick==='all'&&count===group.length)));update()});
   update();
 };
 search.oninput=drawStudents;student.onchange=drawPayments;
 save.onclick=async()=>{
 const chosen=selected();const method=overlay.querySelector('#mxManualMethod').value;if(!chosen.length||!['transferencia','efectivo'].includes(method)||busy)return;
 const invoice=chosen.map(p=>({id:p.id,amount:due(p),campaign:cleanName(campaigns.get(p.campana_id)?.titulo||p.concepto),period:p.periodo||p.fecha_vencimiento||''}));
 const total=invoice.reduce((a,b)=>a+b.amount,0);
 if(!window.confirm('¿Confirmas que recibiste y verificaste '+clp(total)+' para '+invoice.length+' cuota(s)? Se registrarán y conciliarán en una sola operación.'))return;
 busy=true;save.disabled=true;
 const operationId=(window.crypto&&crypto.randomUUID)?crypto.randomUUID():null;
 if(!operationId){status.textContent='Este navegador no puede generar un identificador seguro. No se registró nada.';busy=false;return;}
 try{
  if(window.MICURSOX_CONNECTION?.isReady&&!window.MICURSOX_CONNECTION.isReady())throw Error('Conexión financiera sin verificar. Vuelve a intentar.');
  const result=await api.request('rpc/registrar_pago_manual_lote',{method:'POST',body:JSON.stringify({
   p_operacion_id:operationId,p_curso_id:course,p_miembro_id:student.value,
   p_pagos:invoice.map(p=>p.id),p_medio:method
  })});
  const data=Array.isArray(result)?result[0]:result;
  if(!data||data.id!==operationId||Number(data.monto_total)!==total||Number(data.cuotas)!==invoice.length)throw Error('La operación necesita verificación. No repitas el pago: consulta el historial con el folio '+operationId);
  overlay.remove();
  alert('Pago registrado y conciliado: '+clp(total)+' · '+invoice.length+' cuota(s). Folio: '+operationId);
  try{window.MICURSOX_REFRESH_BUSINESS_DATA?.('pago-manual-conciliado');window.dispatchEvent(new CustomEvent('cursapp:dataUpdated',{detail:{source:'registro-pago-manual',financial:true,operacionId}}));}catch(_){}
 }catch(e){status.textContent='No se confirmó el registro. '+(e?.message||String(e))+' Si hubo una interrupción, verifica el historial antes de intentarlo de nuevo.';save.disabled=true;}
 finally{busy=false;save.textContent='Registrar y conciliar';}
 };
 (async()=>{try{
 if(!course)throw Error('No se pudo identificar el curso activo. Recarga Tesorero.');
 const [people,debt,activeCampaigns]=await Promise.all([
 api.request('miembros_curso?select=id,curso_id,nombre_alumno,nombre_apoderado&curso_id=eq.'+encodeURIComponent(course)+'&order=nombre_alumno.asc&limit=200'),
 api.request('pagos?select=id,curso_id,campana_id,miembro_id,estado,monto,monto_pagado,concepto,periodo,fecha_vencimiento&curso_id=eq.'+encodeURIComponent(course)+'&limit=2000'),api.request('campanas?select=id,titulo,tipo,monto,estado,obligatoria&curso_id=eq.'+encodeURIComponent(course)+'&limit=200')]);
 members=Array.isArray(people)?people.filter(p=>p.id&&p.nombre_alumno):[];rows=Array.isArray(debt)?debt:[];campaigns=new Map((Array.isArray(activeCampaigns)?activeCampaigns:[]).map(c=>[c.id,c]));
 // Unificar entradas visuales repetidas sin fusionar registros financieros: elegir el miembro con cuotas pendientes.
 const canonicalName=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
 const aliases=new Map();
 members.forEach(m=>{const key=canonicalName(m.nombre_alumno)+'|'+canonicalName(m.nombre_apoderado);const prior=aliases.get(key);const active=id=>rows.filter(p=>p.miembro_id===id&&pending(p.estado)&&due(p)>0).length;if(!prior||active(m.id)>active(prior.id))aliases.set(key,m)});
 members=[...aliases.values()];
 members.sort((a,b)=>String(a.nombre_alumno).localeCompare(String(b.nombre_alumno),'es'));
 if(!members.length)throw Error('No se pudo obtener la nómina del curso.');
 status.textContent=members.length+' alumnos encontrados. Busca por nombre o apellido del alumno o apoderado.';search.disabled=false;student.disabled=false;drawStudents();
 }catch(e){status.textContent='No se pudo cargar la nómina y las cuotas: '+(e?.message||String(e))}})();
}
if(document.body.classList.contains('cursapp-tesorero'))if(isPresident){window.openPresidentPaymentModal=open;window.openPresidentManualPayment=open;}else{window.openManualPayment=open;}
if(document.body.classList.contains('cursapp-presidente'))window.openPresidentPaymentModal=open;
})();