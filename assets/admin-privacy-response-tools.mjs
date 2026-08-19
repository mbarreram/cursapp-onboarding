const sb = window.CURSAPP_SUPABASE;
let currentCaseId = null;

function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function fmt(v){if(!v)return '—';try{return new Date(v).toLocaleString('es-CL',{dateStyle:'medium',timeStyle:'short'});}catch{return String(v)}}
async function rpc(name,body={}){return sb.request(`rpc/${name}`,{method:'POST',body:JSON.stringify(body)});}

const TYPE_LABEL={access:'Acceso a datos',rectification:'Rectificación de datos',suppression:'Supresión de datos',opposition:'Oposición al tratamiento',portability:'Portabilidad de datos',blocking:'Bloqueo de tratamiento',information_request:'Requerimiento de información'};
const STATUS_LABEL={received:'Recibida',identity_validation:'Validación de identidad',in_review:'En análisis',in_execution:'En ejecución',responded:'Respondida',closed:'Cerrada',rejected:'Rechazada',cancelled:'Cancelada'};

function responseText(d){
  const c=d?.case||{}, s=d?.subject||{}, inv=d?.data_inventory||{};
  const name=(s.nombre||'usuario/a').trim();
  const summary=(c.response_summary||'').trim();
  const response=summary || `Hemos revisado tu solicitud de ${String(TYPE_LABEL[c.request_type]||'privacidad').toLowerCase()}. El caso se encuentra actualmente en estado “${STATUS_LABEL[c.status]||c.status||'En revisión'}”.`;
  return [
    `Hola ${name},`,
    '',
    `Te informamos que MiCursoX ha actualizado tu solicitud de privacidad.`,
    '',
    `N° de expediente: ${c.case_number||'—'}`,
    `Tipo de solicitud: ${TYPE_LABEL[c.request_type]||c.request_type||'—'}`,
    `Estado: ${STATUS_LABEL[c.status]||c.status||'—'}`,
    '',
    'Respuesta de MiCursoX',
    response,
    '',
    'Antecedentes considerados',
    `• Perfiles o roles asociados: ${inv.memberships||0}`,
    `• Pagos asociados: ${inv.payments||0}`,
    `• Consentimientos registrados: ${inv.consents||0}`,
    `• Notificaciones registradas: ${inv.notifications||0}`,
    '',
    'Esta respuesta y las acciones realizadas sobre el expediente quedan registradas en la trazabilidad de MiCursoX. Puedes revisar el historial de tu solicitud en Perfil → Consentimientos y privacidad.',
    '',
    'Si necesitas agregar antecedentes, indícanos el número de expediente al contactar soporte.',
    '',
    'MiCursoX · Privacidad y Cumplimiento'
  ].join('\n');
}

function emailSubject(d){const c=d?.case||{};return `MiCursoX · Respuesta solicitud de privacidad ${c.case_number||''}`.trim();}

async function logAction(type,summary,metadata={}){
  if(!currentCaseId)return;
  try{await rpc('admin_privacy_log_action',{p_case_id:currentCaseId,p_event_type:type,p_event_summary:summary,p_metadata:metadata});}catch(e){console.warn('[Privacidad] No se pudo registrar acción:',e);}
}

async function getDetail(){
  if(!currentCaseId) throw new Error('No se pudo identificar el expediente actual.');
  return rpc('admin_privacy_case_detail',{p_case_id:currentCaseId});
}

function printDocument(d){
  const c=d?.case||{}, s=d?.subject||{}, audit=d?.audit||[], cons=d?.consents||[], inv=d?.data_inventory||{};
  const response=(c.response_summary||responseText(d)).trim();
  const win=window.open('','_blank');
  if(!win){alert('Permite ventanas emergentes para generar el documento.');return;}
  const auditRows=audit.map(a=>`<tr><td>${esc(fmt(a.created_at))}</td><td>${esc(a.event_summary||a.event_type)}</td><td>${esc(String(a.event_hash||'').slice(0,16))}…</td></tr>`).join('');
  const consentRows=cons.map(x=>`<tr><td>${esc(x.version||'—')}</td><td>${esc(fmt(x.fecha_aceptacion||x.created_at))}</td><td>${x.terminos_aceptados?'Sí':'No'}</td><td>${x.privacidad_aceptada?'Sí':'No'}</td></tr>`).join('');
  win.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(c.case_number||'Expediente')}</title><style>body{font-family:Arial,sans-serif;color:#172033;margin:38px;line-height:1.5}header{border-bottom:3px solid #6d28d9;padding-bottom:14px;margin-bottom:22px}h1{font-size:24px;margin:0}h2{font-size:17px;margin:24px 0 8px;color:#312e81}p,td,th{font-size:12px}table{width:100%;border-collapse:collapse;margin-top:8px}th,td{border:1px solid #dbe3ec;padding:7px;text-align:left;vertical-align:top}th{background:#f8fafc}.meta{display:grid;grid-template-columns:1fr 1fr;gap:8px 20px}.box{border:1px solid #dbe3ec;border-radius:10px;padding:14px;background:#fff}.reply{border-left:4px solid #6d28d9;background:#faf5ff;padding:15px 16px;border-radius:10px;white-space:pre-wrap;font-size:12px}.muted{color:#64748b}.foot{margin-top:30px;border-top:1px solid #dbe3ec;padding-top:10px;font-size:10px;color:#64748b}@media print{button{display:none}body{margin:18mm}}</style></head><body><header><h1>MiCursoX · Respuesta de privacidad</h1><div class="muted">Expediente ${esc(c.case_number||'—')}</div></header><section class="meta"><div><b>Persona</b><br>${esc(s.nombre||'—')}<br>${esc(s.email||'')}</div><div><b>Tipo de solicitud</b><br>${esc(TYPE_LABEL[c.request_type]||c.request_type||'—')}</div><div><b>Fecha de ingreso</b><br>${esc(fmt(c.created_at))}</div><div><b>Estado</b><br>${esc(STATUS_LABEL[c.status]||c.status||'—')}</div></section><h2>Respuesta formal</h2><div class="reply">${esc(response)}</div><h2>Inventario de información asociado</h2><div class="box">Perfiles/roles: <b>${inv.memberships||0}</b> · Pagos: <b>${inv.payments||0}</b> · Consentimientos: <b>${inv.consents||0}</b> · Notificaciones: <b>${inv.notifications||0}</b> · Solicitudes de privacidad: <b>${inv.privacy_requests||0}</b></div><h2>Consentimientos registrados</h2><table><thead><tr><th>Versión</th><th>Fecha</th><th>Términos</th><th>Privacidad</th></tr></thead><tbody>${consentRows||'<tr><td colspan="4">Sin registros</td></tr>'}</tbody></table><h2>Historial y trazabilidad del expediente</h2><table><thead><tr><th>Fecha</th><th>Evento</th><th>Hash de evidencia</th></tr></thead><tbody>${auditRows||'<tr><td colspan="3">Sin eventos</td></tr>'}</tbody></table><div class="foot">Documento generado desde la trazabilidad de MiCursoX. La bitácora técnica completa permanece registrada en el sistema.</div><script>setTimeout(()=>window.print(),250)<\/script></body></html>`);
  win.document.close();
  logAction('response_document_generated','Documento de respuesta generado para el expediente',{format:'print_pdf'});
}

async function copyText(d){
  const t=responseText(d);
  try{await navigator.clipboard.writeText(t);}catch{const ta=document.createElement('textarea');ta.value=t;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();}
  await logAction('response_text_copied','Texto de respuesta MiCursoX copiado',{channel:'in_app'});
  alert('Texto de respuesta copiado.');
}

async function prepareEmail(d){
  const s=d?.subject||{};
  const to=s.email||'';
  const url=`mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(emailSubject(d))}&body=${encodeURIComponent(responseText(d))}`;
  await logAction('email_response_prepared','Correo de respuesta preparado',{recipient:to||null});
  location.href=url;
}

async function sendInApp(d){
  const initial=responseText(d);
  const msg=prompt('Texto que recibirá el usuario dentro de MiCursoX:',initial);
  if(msg===null)return;
  if(msg.trim().length<5){alert('La respuesta es demasiado breve.');return;}
  if(!confirm('¿Enviar esta respuesta al usuario dentro de MiCursoX? Se agregará al historial y se generará una notificación.'))return;
  try{
    await rpc('admin_privacy_send_in_app_response',{p_case_id:currentCaseId,p_message:msg.trim()});
    alert('Respuesta enviada. El usuario recibirá una notificación y la respuesta quedará en su historial.');
  }catch(e){alert('No se pudo enviar la respuesta: '+(e?.message||e));}
}

function injectTools(){
  const sheet=document.querySelector('.mxPrivSheet');
  if(!sheet||!sheet.querySelector('#mxCaseSave')||sheet.querySelector('[data-mx-response-tools]'))return;
  const actions=sheet.querySelector('.mxPrivActions');
  if(!actions)return;
  const wrap=document.createElement('div');wrap.setAttribute('data-mx-response-tools','1');wrap.style.cssText='display:flex;gap:8px;flex-wrap:wrap;width:100%;margin-top:8px;padding-top:10px;border-top:1px solid #eef2f7';
  wrap.innerHTML='<button class="mxPrivBtn dark" type="button" data-mx-doc>Documento de respuesta</button><button class="mxPrivBtn ghost" type="button" data-mx-copy>Copiar texto MiCursoX</button><button class="mxPrivBtn ghost" type="button" data-mx-email>Preparar correo</button><button class="mxPrivBtn" type="button" data-mx-inapp>Responder por MiCursoX</button>';
  actions.appendChild(wrap);
  wrap.querySelector('[data-mx-doc]').onclick=async()=>{try{printDocument(await getDetail());}catch(e){alert(e?.message||e)}};
  wrap.querySelector('[data-mx-copy]').onclick=async()=>{try{await copyText(await getDetail());}catch(e){alert(e?.message||e)}};
  wrap.querySelector('[data-mx-email]').onclick=async()=>{try{await prepareEmail(await getDetail());}catch(e){alert(e?.message||e)}};
  wrap.querySelector('[data-mx-inapp]').onclick=async()=>{try{await sendInApp(await getDetail());}catch(e){alert(e?.message||e)}};
}

document.addEventListener('click',e=>{
  const b=e.target.closest?.('[data-open]');
  if(b?.dataset?.open) currentCaseId=b.dataset.open;
},true);

new MutationObserver(injectTools).observe(document.documentElement,{childList:true,subtree:true});
injectTools();
