const sb=window.CURSAPP_SUPABASE;
const app=document.getElementById('adminApp');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rpc=(name,body={})=>sb.request(`rpc/${name}`,{method:'POST',body:JSON.stringify(body)});
let busy=false,lastId='';
function ensureStyles(){if(document.getElementById('officialSchoolDataStyles'))return;const s=document.createElement('style');s.id='officialSchoolDataStyles';s.textContent=`.officialDataBadge{display:inline-flex;padding:5px 9px;border-radius:999px;background:#dcfce7;color:#166534;font-size:10px;font-weight:900;margin-top:6px}.officialDataPending{background:#fef3c7;color:#92400e}.officialPotentialGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:10px}.officialPotentialGrid div{background:rgba(255,255,255,.88);border-radius:12px;padding:9px}.officialPotentialGrid span{display:block;font-size:10px;color:#64748b;font-weight:800}.officialPotentialGrid b{font-size:17px}.officialPenetration{margin-top:8px;font-size:11px;color:#475569}.officialBar{height:7px;background:#e2e8f0;border-radius:999px;overflow:hidden;margin-top:4px}.officialBar i{display:block;height:100%;background:#16a34a;border-radius:inherit}`;document.head.appendChild(s)}
async function enrich(){
  if(busy)return;
  const active=document.querySelector('.territorySchool.isActive[data-school]');
  const host=document.getElementById('territorySelected');
  if(!active||!host)return;
  const id=active.dataset.school;if(!id||id===lastId&&host.querySelector('[data-official-school]'))return;
  busy=true;
  try{
    const rows=await rpc('admin_school_detail',{p_colegio_id:id});const d=Array.isArray(rows)?rows[0]:null;if(!d)return;
    host.querySelectorAll('[data-official-school]').forEach(x=>x.remove());
    const official=Number.isFinite(Number(d.matricula_oficial))&&d.matricula_oficial!==null;
    const enrollment=official?Number(d.matricula_oficial):Number(d.matricula_estimada||0);
    const officialCourses=Number(d.cursos_oficiales||0);
    const cursappStudents=Number(d.alumnos_cursapp||0);
    const cursappCourses=Number(d.cursos_activos||0);
    const families=official?Math.round(enrollment*.78):null;
    const penetration=official&&enrollment>0?Math.min(100,Math.round(cursappStudents/enrollment*100)):0;
    const card=document.createElement('div');card.dataset.officialSchool='1';card.className='schoolVisualCard';
    const visual=d.imagen_referencia_url?`<img src="${esc(d.imagen_referencia_url)}" alt="${esc(d.nombre)}">`:'🏫';
    card.innerHTML=`<div class="schoolVisual">${visual}</div><div><h3>${esc(d.nombre)}</h3><div class="schoolVisualMeta">RBD ${esc(d.rbd||'—')} · ${esc(d.dependencia_nombre||'Dependencia no informada')}<br>${esc(d.direccion||'Dirección no informada')}</div><span class="officialDataBadge ${official?'':'officialDataPending'}">${official?`Dato oficial MINEDUC ${esc(d.matricula_anio||'')}`:'Matrícula oficial pendiente'}</span><div class="officialPotentialGrid"><div><span>${official?'Matrícula oficial':'Matrícula estimada'}</span><b>${enrollment?enrollment.toLocaleString('es-CL'):'—'}</b></div><div><span>Cursos oficiales</span><b>${officialCourses||'—'}</b></div><div><span>Familias potenciales</span><b>${families!=null?families.toLocaleString('es-CL'):'—'}</b></div><div><span>Alumnos Cursapp</span><b>${cursappStudents.toLocaleString('es-CL')}</b></div><div><span>Cursos Cursapp</span><b>${cursappCourses}</b></div><div><span>Agente</span><b>${esc(d.agent_nombre||'Sin asignar')}</b></div></div>${official?`<div class="officialPenetration">Penetración estimada Cursapp: <b>${penetration}%</b><div class="officialBar"><i style="width:${penetration}%"></i></div></div>`:'<div class="schoolEstimateNote">Carga la matrícula oficial para calcular familias potenciales y penetración real.</div>'}</div>`;
    const old=host.querySelector('.schoolVisualCard');if(old)old.replaceWith(card);else{const back=host.querySelector('.territoryBack');back?back.insertAdjacentElement('afterend',card):host.prepend(card)}
    lastId=id;
  }finally{busy=false}
}
ensureStyles();
const observer=new MutationObserver(()=>void enrich());observer.observe(app,{childList:true,subtree:true});
void enrich();