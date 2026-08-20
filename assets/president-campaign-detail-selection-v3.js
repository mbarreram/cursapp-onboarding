(function(){
'use strict';
if(window.__MICURSOX_PRES_CAMPAIGN_DETAIL_SELECTION_V3__)return;
window.__MICURSOX_PRES_CAMPAIGN_DETAIL_SELECTION_V3__=true;
const sb=window.CURSAPP_SUPABASE;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clp=v=>new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(Number(v||0));
const norm=v=>String(v||'').toLowerCase().replace(/\s+/g,' ').trim();
const date=v=>{if(!v)return'—';const d=new Date(String(v).slice(0,10)+'T12:00:00');return isNaN(d)?'—':d.toLocaleDateString('es-CL',{day:'2-digit',month:'short',year:'numeric'})};
function closestCampaignCard(btn){let el=btn;for(let i=0;i<7&&el;i++,el=el.parentElement){const t=norm(el.textContent);if(t.includes('ver detalle')&&(t.includes('recaudado')||t.includes('pendiente')||t.includes('mensual')||t.includes('obligator')))return el;}return btn.closest('.card,article,section,div');}
async function req(path){if(!sb?.request)throw new Error('No se pudo cargar la campaña');return sb.request(path);}
async function resolveCampaign(card){const txt=norm(card?.textContent);let rows=await req('campanas?select=*&order=created_at.desc').catch(()=>[]);if(!Array.isArray(rows))rows=[];
  let id='';for(const el of [card,...(card?.querySelectorAll?.('[data-id],[data-campaign-id],[data-campana-id]')||[])]){id=String(el?.dataset?.id||el?.dataset?.campaignId||el?.dataset?.campanaId||'').trim();if(id)break;}
  if(id){const byId=rows.find(r=>String(r.id)===id);if(byId)return byId;}
  const matches=rows.filter(r=>txt.includes(norm(r.titulo))).sort((a,b)=>String(b.titulo||'').length-String(a.titulo||'').length);
  if(matches[0])return matches[0];
  const headings=[...(card?.querySelectorAll?.('h1,h2,h3,h4,strong,b')||[])].map(x=>norm(x.textContent)).filter(Boolean);
  for(const h of headings){const exact=rows.find(r=>norm(r.titulo)===h);if(exact)return exact;}
  return null;
}
function daysLeft(v){if(!v)return null;const end=new Date(String(v).slice(0,10)+'T23:59:59');return Math.ceil((end-Date.now())/86400000)}
function css(){if(document.getElementById('mxCampSelV3Css'))return;const s=document.createElement('style');s.id='mxCampSelV3Css';s.textContent=`
.mxCampV3Overlay{position:fixed;inset:0;z-index:160000;background:rgba(15,23,42,.58);display:flex;align-items:flex-end;justify-content:center;padding:10px}.mxCampV3Sheet{width:min(760px,100%);max-height:92dvh;overflow:auto;background:#f8fafc;border-radius:28px 28px 18px 18px;padding:18px;box-sizing:border-box}.mxCampV3Head{display:flex;justify-content:space-between;gap:12px}.mxCampV3Head h2{margin:0;font-size:25px;color:#0f172a}.mxCampV3Head p{margin:5px 0 0;color:#64748b;font-weight:750}.mxCampV3Close{border:1px solid #e2e8f0;background:#fff;color:#6d28d9;border-radius:16px;padding:10px 14px;font-weight:900}.mxCampV3Meta{display:flex;gap:8px;flex-wrap:wrap;margin:15px 0}.mxCampV3Label{display:inline-flex;align-items:center;padding:6px 9px;border-radius:8px;font-size:12px;font-weight:800;color:#64748b;background:#eef2f7;pointer-events:none}.mxCampV3Label.state{color:#15803d;background:#f0fdf4}.mxCampV3Label.voluntary{color:#7c3aed;background:#faf5ff}.mxCampV3Grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.mxCampV3Card{background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:14px}.mxCampV3Card small{display:block;color:#64748b;font-weight:800}.mxCampV3Card b{display:block;font-size:21px;color:#0f172a;margin-top:5px}.mxCampV3Card em{display:block;color:#7c3aed;font-style:normal;font-size:11px;font-weight:850;margin-top:5px}.mxCampV3Wide{grid-column:1/-1}.mxCampV3Info{margin-top:12px;background:#fff7ed;border:1px solid #fed7aa;border-radius:18px;padding:13px;color:#9a3412;font-size:12px;line-height:1.45;font-weight:750}.mxCampV3Participation{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}.mxCampV3Participation .yes{background:#f0fdf4;border-color:#bbf7d0}.mxCampV3Participation .no{background:#fef2f2;border-color:#fecaca}.mxCampV3Section{margin-top:12px}.mxCampV3Section h3{margin:0 0 9px;color:#0f172a;font-size:16px}.mxCampV3Progress{height:10px;background:#e2e8f0;border-radius:999px;overflow:hidden;margin-top:9px}.mxCampV3Progress i{display:block;height:100%;background:#6d28d9;border-radius:inherit}.mxCampV3Dates{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.mxCampV3Dates .mxCampV3Card b{font-size:14px}.mxCampV3Lines{display:grid;gap:7px}.mxCampV3Line{display:grid;grid-template-columns:38px minmax(0,1fr) auto;gap:9px;align-items:center;background:#fff;border:1px solid #e2e8f0;border-radius:15px;padding:10px}.mxCampV3Line>span{width:38px;height:38px;border-radius:12px;background:#f1f5f9;display:grid;place-items:center}.mxCampV3Line b,.mxCampV3Line small{display:block}.mxCampV3Line small{color:#64748b;margin-top:2px;font-size:11px}.mxCampV3Line strong{font-size:12px;color:#475569;white-space:nowrap}.mxCampV3Actions{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:14px}.mxCampV3Actions button{border:1px solid #ddd6fe;background:#fff;color:#6d28d9;border-radius:15px;padding:12px;font-weight:900}.mxCampV3Actions .primary{background:linear-gradient(135deg,#7c3aed,#5b21b6);color:#fff;border:0}.mxCampV3Stats{display:none;margin-top:12px}.mxCampV3Stats.open{display:block}.mxCampV3Empty{color:#64748b;font-weight:750;padding:8px 0}.mxCampV3More{margin:12px 0 2px;text-align:center;color:#7c3aed;font-size:11px;font-weight:850}@media(max-width:520px){.mxCampV3Sheet{padding:15px}.mxCampV3Grid,.mxCampV3Participation{grid-template-columns:1fr 1fr}.mxCampV3Dates{grid-template-columns:1fr 1fr}.mxCampV3Dates .wide{grid-column:1/-1}}
`;document.head.appendChild(s);}
async function openCampaign(c){
 css();document.querySelector('.mxCampV3Overlay')?.remove();
 const courseId=String(c.curso_id||'');
 const [pays,courseRows,memberRows]=await Promise.all([
   req(`pagos?select=*&campana_id=eq.${c.id}&order=created_at.desc`).catch(()=>[]),
   courseId?req(`cursos?select=id,total_alumnos&id=eq.${courseId}&limit=1`).catch(()=>[]):Promise.resolve([]),
   courseId?req(`miembros_curso?select=id,nombre_alumno,nombre_apoderado,email&curso_id=eq.${courseId}`).catch(()=>[]):Promise.resolve([])
 ]);
 const rows=Array.isArray(pays)?pays:[];
 const members=Array.isArray(memberRows)?memberRows:[];
 const memberMap=new Map(members.map(m=>[String(m.id),m]));
 const totalCourse=Math.max(0,Number(courseRows?.[0]?.total_alumnos||0));
 const registeredIds=new Set(members.map(m=>String(m.id||'')).filter(Boolean));
 const registered=registeredIds.size || new Set(rows.map(p=>String(p.miembro_id||'')).filter(Boolean)).size;
 const amount=Number(c.monto||0);
 const months=norm(c.tipo)==='monthly'?Math.max(1,Number(c.meses||1)):1;
 const voluntary=c.obligatoria===false;
 const excludedStates=['opted_out','no_participa','no participa','anulado','cancelled'];
 const acceptedIds=new Set(rows.filter(p=>!excludedStates.includes(norm(p.estado))).map(p=>String(p.miembro_id||'')).filter(Boolean));
 const outIds=new Set(rows.filter(p=>['opted_out','no_participa','no participa'].includes(norm(p.estado))).map(p=>String(p.miembro_id||'')).filter(Boolean));
 const participants=voluntary?acceptedIds.size:totalCourse;
 const paid=rows.filter(p=>['pagado','paid','conciliado'].includes(norm(p.estado)));
 const paidIds=new Set(paid.map(p=>String(p.miembro_id||'')).filter(Boolean));
 const collected=paid.reduce((s,p)=>s+Number(p.monto_pagado??p.monto??0),0);
 const projected=participants*amount*months;
 const pending=Math.max(0,projected-collected);
 const pct=projected?Math.min(100,Math.round(collected/projected*100)):0;
 const acceptanceRate=totalCourse?Math.round(acceptedIds.size/totalCourse*100):0;
 const remain=daysLeft(c.fecha_vencimiento);
 const pendingRows=rows.filter(p=>!['pagado','paid','conciliado','opted_out','no_participa','no participa','anulado','cancelled'].includes(norm(p.estado))).slice(0,5);
 const timeline=[{icon:'🟢',title:'Campaña creada',detail:date(c.created_at),at:c.created_at},...paid.slice(0,8).map(p=>{const m=memberMap.get(String(p.miembro_id||''))||{};return{icon:'💰',title:m.nombre_alumno||m.nombre_apoderado||'Pago recibido',detail:clp(p.monto_pagado??p.monto),at:p.paid_at||p.created_at}})].sort((a,b)=>Date.parse(b.at||0)-Date.parse(a.at||0)).slice(0,6);
 const ov=document.createElement('div');ov.className='mxCampV3Overlay';
 ov.innerHTML=`<section class="mxCampV3Sheet"><div class="mxCampV3Head"><div><h2>${esc(c.titulo||'Campaña')}</h2><p>Resumen ejecutivo de campaña</p></div><button class="mxCampV3Close">Cerrar</button></div>
 <div class="mxCampV3Meta"><span class="mxCampV3Label state">${esc(c.estado||'Activa')}</span><span class="mxCampV3Label">${norm(c.tipo)==='monthly'?'Mensual':'Pago único'}</span><span class="mxCampV3Label voluntary">${voluntary?'Voluntaria':'Obligatoria'}</span></div>
 <div class="mxCampV3Grid"><article class="mxCampV3Card"><small>Valor por alumno</small><b>${clp(amount)}</b><em>${months>1?months+' cuotas':'Cuota única'}</em></article><article class="mxCampV3Card"><small>Registrados</small><b>${registered}</b><em>Apoderados/alumnos registrados</em></article><article class="mxCampV3Card"><small>${voluntary?'Participación confirmada':'Participantes'}</small><b>${participants}</b><em>${voluntary?'Aceptaron participar':'Total de alumnos del curso'}</em></article><article class="mxCampV3Card"><small>Total del curso</small><b>${totalCourse}</b><em>${voluntary?'Referencia del curso':'Base de la proyección'}</em></article><article class="mxCampV3Card mxCampV3Wide"><small>Recaudación proyectada</small><b>${clp(projected)}</b><em>${participants} × ${clp(amount)}${months>1?' × '+months:''}</em></article></div>
 ${voluntary?`<div class="mxCampV3Info">Esta campaña es voluntaria. La proyección se calcula solo con quienes tienen participación confirmada. Los demás alumnos del curso no se incorporan al monto por cobrar hasta que acepten participar.</div><div class="mxCampV3Participation"><article class="mxCampV3Card yes"><small>✅ Aceptaron</small><b>${acceptedIds.size}</b><em>${acceptanceRate}% del curso</em></article><article class="mxCampV3Card no"><small>🚫 No participan</small><b>${outIds.size}</b><em>No se incluyen en la proyección</em></article></div>`:`<div class="mxCampV3Info" style="background:#eff6ff;border-color:#bfdbfe;color:#1d4ed8">Esta campaña es obligatoria. La proyección considera a <b>todos los alumnos del curso (${totalCourse})</b>, aunque todavía no estén registrados en MiCursoX.</div>`}
 <article class="mxCampV3Card mxCampV3Section"><small>Estado de recaudación</small><b>${clp(collected)} recaudado</b><div class="mxCampV3Progress"><i style="width:${pct}%"></i></div><small>${clp(pending)} pendiente · ${pct}% del objetivo</small></article>
 <section class="mxCampV3Section"><h3>Fechas</h3><div class="mxCampV3Dates"><article class="mxCampV3Card"><small>Inicio</small><b>${date(c.fecha_inicio||c.created_at)}</b></article><article class="mxCampV3Card"><small>Vencimiento</small><b>${date(c.fecha_vencimiento)}</b></article><article class="mxCampV3Card wide"><small>Estado del plazo</small><b>${remain==null?'Sin vencimiento':remain<0?`Venció hace ${Math.abs(remain)} día(s)`:remain===0?'Vence hoy':`Restan ${remain} día(s)`}</b></article></div></section>
 <section class="mxCampV3Section mxCampV3Card"><h3>Próximos pendientes</h3><div class="mxCampV3Lines">${pendingRows.length?pendingRows.map(p=>{const m=memberMap.get(String(p.miembro_id||''))||{};return`<div class="mxCampV3Line"><span>👤</span><div><b>${esc(m.nombre_alumno||'Alumno pendiente')}</b><small>${esc(m.nombre_apoderado||m.email||'Apoderado')}</small></div><strong>${clp(p.monto||amount)}</strong></div>`}).join(''):'<div class="mxCampV3Empty">No hay cobros pendientes registrados.</div>'}</div></section>
 <section class="mxCampV3Section mxCampV3Card"><h3>Actividad reciente</h3><div class="mxCampV3Lines">${timeline.map(x=>`<div class="mxCampV3Line"><span>${x.icon}</span><div><b>${esc(x.title)}</b><small>${esc(x.detail)}</small></div><strong>${date(x.at)}</strong></div>`).join('')}</div></section>
 <section class="mxCampV3Stats" data-stats><div class="mxCampV3Grid"><article class="mxCampV3Card"><small>Pagaron</small><b>${paidIds.size}</b></article><article class="mxCampV3Card"><small>Pendientes</small><b>${Math.max(0,participants-paidIds.size)}</b></article><article class="mxCampV3Card"><small>Registrados</small><b>${registered}</b></article><article class="mxCampV3Card"><small>${voluntary?'Aceptación':'Cobertura'}</small><b>${voluntary?acceptanceRate+'%':(totalCourse?Math.round(registered/totalCourse*100):0)+'%'}</b></article></div></section>
 <div class="mxCampV3More">Desliza para revisar todo el detalle de la campaña</div>
 <div class="mxCampV3Actions"><button data-edit>✏️ Editar</button><button data-debt>👥 Ver deudores</button><button data-stats-btn>📊 Estadísticas</button><button class="primary" data-remind>📣 Enviar recordatorio</button></div></section>`;
 ov.addEventListener('click',e=>{if(e.target===ov||e.target.closest('.mxCampV3Close'))ov.remove();else if(e.target.closest('[data-stats-btn]')){const p=ov.querySelector('[data-stats]');p?.classList.toggle('open');if(p?.classList.contains('open'))p.scrollIntoView({behavior:'smooth',block:'center'});}else if(e.target.closest('[data-debt]')){ov.remove();window.go?.('deudores');}else if(e.target.closest('[data-edit]')){ov.remove();const root=document.getElementById('modalRoot');const edit=[...(root?.querySelectorAll('button')||[])].find(b=>/editar/i.test(b.textContent||''));edit?.click();}else if(e.target.closest('[data-remind]')){ov.remove();if(typeof window.openAvisosConfigSafe==='function')window.openAvisosConfigSafe();else alert('Abre Avisos para enviar un recordatorio a los pendientes.');}});
 document.body.appendChild(ov);
}
document.addEventListener('click',async e=>{const btn=e.target.closest('button,a');if(!btn||!/ver detalle/i.test(norm(btn.textContent)))return;const card=closestCampaignCard(btn);if(!card)return;e.preventDefault();e.stopImmediatePropagation();try{const c=await resolveCampaign(card);if(!c)throw new Error();await openCampaign(c);}catch(_){alert('No pudimos abrir esta campaña. Intenta nuevamente.');}},true);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',css,{once:true});else css();
})();