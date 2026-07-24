const sb=window.CURSAPP_SUPABASE;
const app=document.getElementById('adminApp');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rpc=(name,body={})=>sb.request(`rpc/${name}`,{method:'POST',body:JSON.stringify(body)});
let enhancing=false;

function ensureStyles(){
  if(document.getElementById('territoryPhase3Styles'))return;
  const s=document.createElement('style');s.id='territoryPhase3Styles';s.textContent=`
  .territoryPhaseSwitch{display:flex;gap:8px;overflow:auto;margin:0 0 14px}.territoryPhaseSwitch button{white-space:nowrap;border:1px solid #ddd6fe;background:#fff;color:#6d28d9;border-radius:999px;padding:10px 14px;font-weight:850}.territoryPhaseSwitch button.active{background:#6d28d9;color:#fff}.schoolVisualCard{display:grid;grid-template-columns:92px minmax(0,1fr);gap:14px;padding:14px;border-radius:20px;background:linear-gradient(135deg,#ecfdf5,#f5f3ff);border:1px solid #bbf7d0;margin:8px 0 14px}.schoolVisual{height:92px;border-radius:18px;background:linear-gradient(145deg,#dcfce7,#ede9fe);display:grid;place-items:center;font-size:46px;overflow:hidden}.schoolVisual img{width:100%;height:100%;object-fit:cover}.schoolVisualCard h3{margin:0 0 4px;font-size:18px}.schoolVisualMeta{font-size:12px;color:#64748b;line-height:1.45}.schoolPotential{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}.schoolPotential div{background:rgba(255,255,255,.8);padding:9px;border-radius:12px}.schoolPotential span{display:block;font-size:10px;color:#64748b;font-weight:750}.schoolPotential b{font-size:17px}.schoolEstimateNote{font-size:10px;color:#64748b;margin-top:6px}.territorySchool{position:relative;padding-left:44px!important}.territorySchool:before{content:'🏫';position:absolute;left:4px;top:13px;width:32px;height:32px;border-radius:10px;background:#ecfdf5;display:grid;place-items:center;font-size:18px}.agentDashboardGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.agentSummaryCard{border:1px solid #e5e7eb;border-radius:18px;padding:14px;background:#fff}.agentSummaryCard h3{margin:0 0 10px}.agentSummaryKpis{display:grid;grid-template-columns:1fr 1fr;gap:7px}.agentSummaryKpis div{background:#f8fafc;border-radius:11px;padding:9px}.agentSummaryKpis span{display:block;font-size:10px;color:#64748b}.agentSummaryKpis b{font-size:17px}.agentSummaryCard button{width:100%;margin-top:10px}.agentEmpty{padding:24px;text-align:center;color:#64748b}@media(max-width:820px){.schoolVisualCard{grid-template-columns:72px minmax(0,1fr)}.schoolVisual{height:72px;font-size:36px}.agentDashboardGrid{grid-template-columns:1fr}.schoolPotential{grid-template-columns:1fr 1fr}}
  `;document.head.appendChild(s);
}

function addModeSwitch(){
  const toolbar=document.querySelector('.territoryToolbar');
  if(!toolbar||document.querySelector('.territoryPhaseSwitch'))return;
  const nav=document.createElement('div');nav.className='territoryPhaseSwitch';nav.innerHTML='<button class="active" data-territory-mode="map">🗺️ Mapa y colegios</button><button data-territory-mode="agents">👤 Resumen por agente</button>';
  toolbar.parentNode.insertBefore(nav,toolbar);
  nav.querySelector('[data-territory-mode="map"]').onclick=()=>location.reload();
  nav.querySelector('[data-territory-mode="agents"]').onclick=renderAgentDashboard;
}

async function enhanceSelectedSchool(){
  if(enhancing)return;
  const active=document.querySelector('.territorySchool.isActive[data-school]');
  const host=document.getElementById('territorySelected');
  if(!active||!host||host.querySelector('.schoolVisualCard'))return;
  enhancing=true;
  try{
    const rows=await rpc('admin_school_detail',{p_colegio_id:active.dataset.school});
    const d=Array.isArray(rows)?rows[0]:null;if(!d)return;
    const visual=d.imagen_referencia_url?`<img src="${esc(d.imagen_referencia_url)}" alt="${esc(d.nombre)}">`:'🏫';
    const card=document.createElement('div');card.className='schoolVisualCard';card.innerHTML=`<div class="schoolVisual">${visual}</div><div><h3>${esc(d.nombre)}</h3><div class="schoolVisualMeta">RBD ${esc(d.rbd||'—')} · ${esc(d.dependencia_nombre||'Dependencia no informada')}<br>${esc(d.direccion||'Dirección no informada')}</div><div class="schoolPotential"><div><span>Matrícula potencial</span><b>≈ ${Number(d.matricula_estimada||0).toLocaleString('es-CL')}</b></div><div><span>Alumnos en Cursapp</span><b>${Number(d.alumnos_cursapp||0).toLocaleString('es-CL')}</b></div><div><span>Cursos activos</span><b>${Number(d.cursos_activos||0)}</b></div><div><span>Agente</span><b>${esc(d.agent_nombre||'Sin asignar')}</b></div></div><div class="schoolEstimateNote">La matrícula potencial es una estimación comercial hasta incorporar la matrícula oficial MINEDUC al catálogo.</div></div>`;
    const back=host.querySelector('.territoryBack');if(back)back.insertAdjacentElement('afterend',card);else host.prepend(card);
    [...host.children].forEach(el=>{if(el!==card&&el!==back&&['H3'].includes(el.tagName))el.style.display='none'});
  }finally{enhancing=false}
}

async function renderAgentDashboard(){
  const toolbar=document.querySelector('.territoryToolbar');const stats=document.getElementById('territoryStats');const legend=document.querySelector('.territoryLegend');const grid=document.querySelector('.territoryGrid');
  document.querySelectorAll('[data-territory-mode]').forEach(b=>b.classList.toggle('active',b.dataset.territoryMode==='agents'));
  if(toolbar)toolbar.style.display='none';if(stats)stats.style.display='none';if(legend)legend.style.display='none';if(!grid)return;
  grid.innerHTML='<section class="panel" style="grid-column:1/-1"><p class="muted" style="font-weight:800">Cargando resumen de agentes…</p></section>';
  try{
    const rows=await rpc('admin_agent_dashboard',{});
    grid.innerHTML=`<section class="panel" style="grid-column:1/-1"><div class="panelHead"><div><h2>Apoyo comercial a agentes</h2><p class="muted">Territorios, colegios, próximas acciones y adopción Cursapp.</p></div></div><div class="agentDashboardGrid">${(rows||[]).map(a=>`<article class="agentSummaryCard"><h3>👤 ${esc(a.agent_nombre)}</h3><div class="agentSummaryKpis"><div><span>Comunas</span><b>${Number(a.comunas_asignadas||0)}</b></div><div><span>Colegios</span><b>${Number(a.colegios_asignados||0)}</b></div><div><span>Contactados</span><b>${Number(a.colegios_contactados||0)}</b></div><div><span>Próximas acciones</span><b>${Number(a.proximas_acciones||0)}</b></div><div><span>Cursos creados</span><b>${Number(a.cursos_creados||0)}</b></div><div><span>Alumnos Cursapp</span><b>${Number(a.alumnos_cursapp||0).toLocaleString('es-CL')}</b></div></div><button class="adminBtn ghost" data-agent-summary="${a.agent_id}">Ver territorio del agente</button></article>`).join('')||'<div class="agentEmpty">Aún no existen agentes activos.</div>'}</div></section>`;
    grid.querySelectorAll('[data-agent-summary]').forEach(btn=>btn.onclick=()=>showAgentTerritory(btn.dataset.agentSummary,rows.find(x=>x.agent_id===btn.dataset.agentSummary)?.agent_nombre));
  }catch(e){grid.innerHTML=`<section class="panel" style="grid-column:1/-1"><h2>No se pudo cargar el resumen</h2><p class="muted">${esc(e.message||e)}</p></section>`}
}

async function showAgentTerritory(agentId,name){
  const grid=document.querySelector('.territoryGrid');if(!grid)return;
  grid.innerHTML=`<section class="panel" style="grid-column:1/-1"><button class="adminBtn ghost" id="agentSummaryBack">← Volver al resumen</button><h2>👤 ${esc(name||'Agente')}</h2><p class="muted">La vista detallada de agenda, colegios asignados y rutas sugeridas se habilitará en el siguiente incremento de la Fase 3.</p></section>`;
  document.getElementById('agentSummaryBack').onclick=renderAgentDashboard;
}

ensureStyles();
const observer=new MutationObserver(()=>{if(!document.getElementById('territoryMap'))return;addModeSwitch();void enhanceSelectedSchool()});
observer.observe(app,{childList:true,subtree:true});
addModeSwitch();