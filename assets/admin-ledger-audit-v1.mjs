// MiCursoX · Admin financiero: anulaciones y bitácora verificadas en servidor
const sb=window.CURSAPP_SUPABASE;
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clp=n=>'$'+Number(n||0).toLocaleString('es-CL');
const fmt=d=>d?new Date(d).toLocaleString('es-CL'):'—';
function section(id,title,body){return '<section class="panel" id="'+id+'" style="margin-top:16px"><div class="panelHead"><h2>'+title+'</h2></div>'+body+'</section>';}
async function drawRefunds(){
 const host=document.getElementById('adminApp');if(!host||!document.getElementById('mxFinRows'))return;
 try{
  const rows=await sb.request('rpc/admin_financial_refunds',{method:'POST',body:'{}'});
  if(!document.getElementById('mxFinRows'))return;
  host.querySelector('#mxFinanceRefunds')?.remove();
  host.insertAdjacentHTML('beforeend',section('mxFinanceRefunds','Anulaciones Transbank · libro histórico',
  '<p class="muted">Montos de anulación; no se suman nuevamente a la recaudación ni a los ingresos. Comisión pasarela referencial sujeta a liquidación.</p><div class="tableWrap"><table><thead><tr><th>Fecha</th><th>Estado</th><th>Total anulado</th><th>Cuota</th><th>MiCursoX</th><th>Pasarela</th><th>Motivo</th><th>Referencia</th></tr></thead><tbody>'+
  ((Array.isArray(rows)?rows:[]).map(r=>'<tr><td>'+escape(fmt(r.completed_at||r.requested_at))+'</td><td>'+escape(r.status)+'</td><td>'+clp(r.total_reversed)+'</td><td>'+clp(r.course_reversal)+'</td><td>'+clp(r.micursox_reversal)+'</td><td>'+clp(r.gateway_fee_reference)+'</td><td>'+escape(r.reason)+'</td><td><small>'+escape(r.id)+'</small></td></tr>').join('')||'<tr><td colspan="8">Sin anulaciones registradas</td></tr>')+'</tbody></table></div>'));
 }catch(error){console.warn('[Admin] Refund ledger',error)}
}
const auditState={page:1,size:25,query:'',event:'',source:'',from:'',to:''};
let auditSerial=0;
async function drawAudit(){
 const host=document.getElementById('adminApp');if(!host||!document.querySelector('.sideItem[data-tab="auditoria"].active'))return;
 const serial=++auditSerial;
 let panel=host.querySelector('#mxAuditServer');
 if(!panel){
  host.insertAdjacentHTML('beforeend',section('mxAuditServer','Bitácora verificable · Supabase',
   '<p class="muted">Busca la actividad de un usuario o una operación para reconstruir la secuencia de acciones. Los clics son indicios de navegación; la confirmación financiera se verifica en eventos del servidor.</p>'+
   '<div id="mxAuditControls" style="display:grid;grid-template-columns:2fr repeat(2,minmax(120px,1fr));gap:10px;padding:12px 16px">'+
   '<input id="mxAuditQuery" type="search" placeholder="Correo, usuario, curso, folio o acción" style="min-width:0" aria-label="Buscar eventos">'+
   '<select id="mxAuditEvent"><option value="">Todos los eventos</option><option value="button_click">Clics</option><option value="form_submit">Formularios</option><option value="payment_confirmed">Pago confirmado</option><option value="payment_unpaid">Pago revertido</option><option value="transbank_refund_completed">Anulación Transbank</option><option value="manual_payment_reversed">Reversa manual</option></select>'+
   '<select id="mxAuditSource"><option value="">Todos los orígenes</option><option value="client">Interfaz</option><option value="server">Servidor</option></select>'+
   '<label>Desde <input id="mxAuditFrom" type="date"></label><label>Hasta <input id="mxAuditTo" type="date"></label>'+
   '<button type="button" id="mxAuditSearchBtn" class="adminBtn">Buscar</button><button type="button" id="mxAuditTestConnection" class="adminBtn ghost">Probar base independiente</button></div>'+
   '<div id="mxAuditCount" style="padding:4px 16px;color:#667085"></div><div class="tableWrap"><table><thead><tr><th>Fecha</th><th>Evento</th><th>Origen</th><th>Rol</th><th>Usuario</th><th>Curso</th><th>Acción</th><th>Referencia</th></tr></thead><tbody id="mxAuditRows"></tbody></table></div>'+
   '<div id="mxAuditPager" style="padding:14px;display:flex;gap:10px;align-items:center;justify-content:center"></div>'));
  panel=host.querySelector('#mxAuditServer');
  const controls=panel.querySelector('#mxAuditControls');
  controls.style.gridTemplateColumns='repeat(auto-fit,minmax(155px,1fr))';
  panel.querySelector('#mxAuditQuery').value=auditState.query;
  panel.querySelector('#mxAuditEvent').value=auditState.event;
  panel.querySelector('#mxAuditSource').value=auditState.source;
  panel.querySelector('#mxAuditFrom').value=auditState.from;
  panel.querySelector('#mxAuditTo').value=auditState.to;
  const search=()=>{
   auditState.query=panel.querySelector('#mxAuditQuery').value.trim();
   auditState.event=panel.querySelector('#mxAuditEvent').value;
   auditState.source=panel.querySelector('#mxAuditSource').value;
   auditState.from=panel.querySelector('#mxAuditFrom').value;
   auditState.to=panel.querySelector('#mxAuditTo').value;
   auditState.page=1;drawAudit();
  };
  panel.querySelector('#mxAuditSearchBtn').addEventListener('click',search);
  panel.querySelector('#mxAuditTestConnection').addEventListener('click',async()=>{
   const btn=panel.querySelector('#mxAuditTestConnection');btn.disabled=true;btn.textContent='Probando…';
   try{
    const eventId=crypto.randomUUID();
    const payload={events:[{event_id:eventId,type:'navigation',target:'admin_audit_connection_test'}]};
    const result=await sb.functions.invoke('audit-ingest-v1',{body:payload});
    if(result.error||!result.data?.ok)throw new Error(result.error?.message||result.data?.error||'Respuesta no confirmada');
    window.alert('Evento diagnóstico enviado a la nueva base. Referencia: '+eventId+'. Ahora verificaremos su registro en Supabase.');
   }catch(error){window.alert('No se pudo confirmar la respuesta en el navegador ('+String(error.message||error)+'). La solicitud podría haberse guardado correctamente; revisaremos su referencia en Supabase antes de reintentar.')}
   finally{btn.disabled=false;btn.textContent='Probar base independiente'}
  });
  panel.querySelector('#mxAuditQuery').addEventListener('keydown',e=>{if(e.key==='Enter')search()});
  panel.querySelectorAll('select,input[type=date]').forEach(el=>el.addEventListener('change',search));
 }
 const tbody=panel.querySelector('#mxAuditRows');tbody.innerHTML='<tr><td colspan="8">Consultando eventos…</td></tr>';
 try{
  const data=await sb.request('rpc/admin_audit_search',{method:'POST',body:JSON.stringify({
   p_query:auditState.query,p_event_type:auditState.event,p_source:auditState.source,
   p_from:auditState.from?auditState.from+'T00:00:00-03:00':null,
   p_to:auditState.to?new Date(new Date(auditState.to+'T12:00:00-03:00').getTime()+86400000).toISOString().slice(0,10)+'T00:00:00-03:00':null,
   p_page:auditState.page,p_size:auditState.size})});
  if(serial!==auditSerial||!document.getElementById('mxAuditRows'))return;
  const rows=Array.isArray(data?.rows)?data.rows:[];const total=Number(data?.total||0);
  tbody.innerHTML=rows.map(r=>'<tr><td>'+escape(fmt(r.created_at))+'</td><td>'+escape(r.event_type)+'</td><td>'+escape(r.source)+'</td><td>'+escape(r.actor_role)+'</td><td><button type="button" class="mxAuditUser" data-user="'+escape(r.actor_user_id||'')+'" style="border:0;background:none;color:#6d28d9;text-decoration:underline;max-width:145px;overflow-wrap:anywhere">'+escape(r.actor_user_id||'—')+'</button></td><td><small>'+escape(r.curso_id)+'</small></td><td>'+escape(r.target)+'</td><td><small>'+escape(r.reference_id)+'</small></td></tr>').join('')||'<tr><td colspan="8">Sin resultados</td></tr>';
  panel.querySelectorAll('.mxAuditUser').forEach(b=>b.addEventListener('click',()=>{if(!b.dataset.user)return;panel.querySelector('#mxAuditQuery').value=b.dataset.user;panel.querySelector('#mxAuditSearchBtn').click()}));
  panel.querySelector('#mxAuditCount').textContent='Mostrando '+(total?((auditState.page-1)*auditState.size+1)+'–'+Math.min(total,auditState.page*auditState.size):'0')+' de '+total.toLocaleString('es-CL')+' eventos · '+auditState.size+' por página';
  const pages=Math.max(1,Math.ceil(total/auditState.size));
  const pager=panel.querySelector('#mxAuditPager');
  pager.innerHTML='<button type="button" data-page="prev" '+(auditState.page<=1?'disabled':'')+'>‹ Anterior</button><strong>Página '+auditState.page+' de '+pages+'</strong><button type="button" data-page="next" '+(auditState.page>=pages?'disabled':'')+'>Siguiente ›</button>';
  pager.querySelectorAll('[data-page]').forEach(b=>b.addEventListener('click',()=>{auditState.page+=(b.dataset.page==='next'?1:-1);drawAudit()}));
 }catch(error){if(serial===auditSerial){tbody.innerHTML='<tr><td colspan="8">No se pudo consultar la bitácora.</td></tr>';console.warn('[Admin] Audit search',error)}}
}

let timer=null;
function update(){
 clearTimeout(timer);
 timer=setTimeout(()=>{if(document.getElementById('mxFinRows')&&!document.getElementById('mxFinanceRefunds'))drawRefunds();if(document.querySelector('.sideItem[data-tab="auditoria"].active')&&!document.getElementById('mxAuditServer'))drawAudit()},550);
}
document.addEventListener('click',e=>{if(e.target.closest?.('.sideItem[data-tab="finanzas"],.sideItem[data-tab="auditoria"]'))update()},true);
window.addEventListener('cursapp:dataUpdated',update);

const host=document.getElementById('adminApp');if(host){new MutationObserver(()=>{if(document.getElementById('mxFinRows')&&!document.getElementById('mxFinanceRefunds'))update()}).observe(host,{childList:true});}
