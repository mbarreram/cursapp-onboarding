// MiCursoX · Admin financiero: anulaciones y bitácora verificadas en servidor
const sb=window.CURSAPP_SUPABASE;
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clp=n=>'$'+Number(n||0).toLocaleString('es-CL');
const fmt=d=>d?new Date(d).toLocaleString('es-CL'):'—';
function section(id,title,body){return '<section class="panel" id="'+id+'" style="margin-top:16px"><div class="panelHead"><h2>'+title+'</h2></div>'+body+'</section>';}
async function drawRefunds(){
 const host=document.getElementById('adminApp');if(!host||!document.querySelector('.sideItem[data-tab="finanzas"].active'))return;
 try{
  const rows=await sb.request('rpc/admin_financial_refunds',{method:'POST',body:'{}'});
  if(!document.querySelector('.sideItem[data-tab="finanzas"].active'))return;
  host.querySelector('#mxFinanceRefunds')?.remove();
  host.insertAdjacentHTML('beforeend',section('mxFinanceRefunds','Anulaciones Transbank · libro histórico',
  '<p class="muted">Montos de anulación; no se suman nuevamente a la recaudación ni a los ingresos. Comisión pasarela referencial sujeta a liquidación.</p><div class="tableWrap"><table><thead><tr><th>Fecha</th><th>Estado</th><th>Total anulado</th><th>Cuota</th><th>MiCursoX</th><th>Pasarela</th><th>Motivo</th><th>Referencia</th></tr></thead><tbody>'+
  ((Array.isArray(rows)?rows:[]).map(r=>'<tr><td>'+escape(fmt(r.completed_at||r.requested_at))+'</td><td>'+escape(r.status)+'</td><td>'+clp(r.total_reversed)+'</td><td>'+clp(r.course_reversal)+'</td><td>'+clp(r.micursox_reversal)+'</td><td>'+clp(r.gateway_fee_reference)+'</td><td>'+escape(r.reason)+'</td><td><small>'+escape(r.id)+'</small></td></tr>').join('')||'<tr><td colspan="8">Sin anulaciones registradas</td></tr>')+'</tbody></table></div>'));
 }catch(error){console.warn('[Admin] Refund ledger',error)}
}
async function drawAudit(){
 const host=document.getElementById('adminApp');if(!host||!document.querySelector('.sideItem[data-tab="auditoria"].active'))return;
 try{
  const rows=await sb.request('rpc/admin_audit_recent',{method:'POST',body:JSON.stringify({p_limit:200})});
  if(!document.querySelector('.sideItem[data-tab="auditoria"].active'))return;
  host.querySelector('#mxAuditServer')?.remove();
  host.insertAdjacentHTML('beforeend',section('mxAuditServer','Bitácora verificable · Supabase',
  '<p class="muted">Acciones de interfaz y eventos financieros del backend. No contiene contraseñas, tokens ni contenido de formularios.</p><div class="tableWrap"><table><thead><tr><th>Fecha</th><th>Evento</th><th>Origen</th><th>Rol</th><th>Usuario</th><th>Curso</th><th>Acción</th><th>Referencia</th></tr></thead><tbody>'+
  ((Array.isArray(rows)?rows:[]).map(r=>'<tr><td>'+escape(fmt(r.created_at))+'</td><td>'+escape(r.event_type)+'</td><td>'+escape(r.source)+'</td><td>'+escape(r.actor_role)+'</td><td><small>'+escape(r.actor_user_id)+'</small></td><td><small>'+escape(r.curso_id)+'</small></td><td>'+escape(r.target)+'</td><td><small>'+escape(r.reference_id)+'</small></td></tr>').join('')||'<tr><td colspan="8">Aún no hay eventos nuevos</td></tr>')+'</tbody></table></div>'));
 }catch(error){console.warn('[Admin] Audit',error)}
}
let timer=null;
function update(){
 clearTimeout(timer);
 timer=setTimeout(()=>{if(document.querySelector('.sideItem[data-tab="finanzas"].active'))drawRefunds();if(document.querySelector('.sideItem[data-tab="auditoria"].active'))drawAudit()},550);
}
document.addEventListener('click',e=>{if(e.target.closest?.('.sideItem[data-tab="finanzas"],.sideItem[data-tab="auditoria"]'))update()},true);
window.addEventListener('cursapp:dataUpdated',update);
