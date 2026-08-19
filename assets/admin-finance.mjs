const sb = window.CURSAPP_SUPABASE;
const app = document.getElementById('adminApp');
const title = document.getElementById('viewTitle');
const sub = document.getElementById('viewSub');

function clp(v){ return '$' + Number(v || 0).toLocaleString('es-CL'); }
function esc(v){ return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function fmtDate(v){ try { return v ? new Date(v).toLocaleString('es-CL',{dateStyle:'short',timeStyle:'short'}) : '—'; } catch(_) { return v || '—'; } }
function low(v){ return String(v || '').toLowerCase(); }
function n(v){ const x = Number(v || 0); return Number.isFinite(x) ? x : 0; }

const PAGE_SIZE = 20;
const METRICS = {
  gross:{label:'Volumen cobrado',field:'monto_total_cobrado',money:true},
  micursox:{label:'Ganancia MiCursoX',field:'comision_micursox',money:true},
  transbank:{label:'Comisiones Transbank',field:'comision_transbank',money:true},
  course:{label:'Fondos de cursos',field:'monto_curso',money:true},
  payments:{label:'Cantidad de pagos',field:null,money:false}
};
const state = { loaded:false, loading:false, data:{summary:{},rows:[]}, page:1, granularity:'day', metric:'gross' };

function injectStyle(){
  if(document.getElementById('mxAdminFinanceStyle')) return;
  const st = document.createElement('style');
  st.id = 'mxAdminFinanceStyle';
  st.textContent = `
  .mxFinKpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-bottom:18px}
  .mxFinCard{background:#fff;border:1px solid rgba(16,24,40,.08);border-radius:18px;padding:16px;box-shadow:0 10px 28px rgba(16,24,40,.04)}
  .mxFinCard span{display:block;color:#667085;font-size:12px;font-weight:850}.mxFinCard strong{display:block;margin-top:8px;font-size:24px;letter-spacing:-.4px}.mxFinCard small{display:block;margin-top:7px;color:#667085;font-weight:750}
  .mxFinFilters{display:grid;grid-template-columns:repeat(6,minmax(140px,1fr));gap:10px;padding:16px;border-bottom:1px solid rgba(16,24,40,.07)}
  .mxFinFilters input,.mxFinFilters select,.mxFinChartTools select{width:100%;border:1px solid rgba(16,24,40,.1);border-radius:12px;padding:10px 11px;background:#fff;font-weight:750;color:#344054}
  .mxFinActions{display:flex;gap:10px;justify-content:flex-end;padding:0 0 14px;flex-wrap:wrap}
  .mxFinTable td,.mxFinTable th{white-space:nowrap}.mxFinTable td:first-child,.mxFinTable th:first-child{position:sticky;left:0;background:#fff;z-index:1}
  .mxFinCourse{white-space:normal;min-width:190px}.mxFinCourse b{display:block}.mxFinCourse small{display:block;color:#667085;margin-top:3px}
  .mxFinPos{color:#166534;font-weight:900}.mxFinNeg{color:#b42318;font-weight:900}.mxFinPurple{color:#6d28d9;font-weight:900}
  .mxFinChartPanel{margin-bottom:18px}.mxFinChartHead{display:flex;gap:16px;justify-content:space-between;align-items:flex-start;padding:18px 20px;border-bottom:1px solid rgba(16,24,40,.07)}
  .mxFinChartHead h2{margin:0;font-size:18px}.mxFinChartHead p{margin:5px 0 0}.mxFinChartTools{display:flex;gap:10px;align-items:center;flex-wrap:wrap;justify-content:flex-end}.mxFinChartTools select{min-width:190px}
  .mxFinSeg{display:inline-flex;padding:4px;background:#f2f4f7;border-radius:12px;gap:3px}.mxFinSeg button{border:0;background:transparent;padding:8px 11px;border-radius:9px;font-weight:900;color:#667085}.mxFinSeg button.active{background:#fff;color:#6d28d9;box-shadow:0 3px 10px rgba(16,24,40,.08)}
  .mxFinChartWrap{padding:20px;overflow-x:auto}.mxFinChart{height:260px;min-width:620px;display:flex;gap:12px;align-items:flex-end;border-left:1px solid #eaecf0;border-bottom:1px solid #eaecf0;padding:18px 12px 0;position:relative}
  .mxFinBarCol{flex:1;min-width:48px;height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:7px}.mxFinBarValue{font-size:11px;font-weight:900;color:#475467;min-height:16px}.mxFinBar{width:min(38px,72%);min-height:3px;border-radius:9px 9px 3px 3px;background:linear-gradient(180deg,#8b5cf6,#6d28d9);box-shadow:0 6px 15px rgba(109,40,217,.14)}.mxFinBarLabel{font-size:11px;font-weight:800;color:#667085;text-align:center;white-space:nowrap}
  .mxFinChartEmpty{width:100%;align-self:center;text-align:center;color:#667085;font-weight:800}.mxFinChartFoot{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:0 20px 18px;color:#667085;font-size:12px;font-weight:800}
  .mxFinPager{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;border-top:1px solid rgba(16,24,40,.07);flex-wrap:wrap}.mxFinPagerInfo{font-size:12px;color:#667085;font-weight:850}.mxFinPagerBtns{display:flex;gap:6px;align-items:center;flex-wrap:wrap}.mxFinPageBtn{border:1px solid rgba(16,24,40,.1);background:#fff;color:#475467;min-width:36px;height:36px;border-radius:10px;font-weight:900}.mxFinPageBtn.active{background:#6d28d9;color:#fff;border-color:#6d28d9}.mxFinPageBtn:disabled{opacity:.4;cursor:default}
  @media(max-width:1200px){.mxFinKpis{grid-template-columns:repeat(2,1fr)}.mxFinFilters{grid-template-columns:repeat(3,1fr)}}
  @media(max-width:700px){.mxFinKpis{grid-template-columns:1fr}.mxFinFilters{grid-template-columns:1fr}.mxFinActions{justify-content:stretch}.mxFinActions button{flex:1}.mxFinCard strong{font-size:21px}.mxFinChartHead{display:block}.mxFinChartTools{justify-content:flex-start;margin-top:12px}.mxFinChartTools select{min-width:100%}.mxFinPager{align-items:stretch}.mxFinPagerBtns{justify-content:center}.mxFinPagerInfo{text-align:center;width:100%}}
  `;
  document.head.appendChild(st);
}

async function loadData(force=false){
  if(state.loading || (state.loaded && !force)) return state.data;
  state.loading = true;
  try{
    const data = await sb.request('rpc/admin_finance_overview', {method:'POST', body:'{}'});
    state.data = data && typeof data === 'object' ? data : {summary:{},rows:[]};
    state.loaded = true;
    state.page = 1;
    return state.data;
  } finally { state.loading = false; }
}

function filteredRows(){
  const rows = Array.isArray(state.data.rows) ? state.data.rows : [];
  const q = low(document.getElementById('mxFinQ')?.value).trim();
  const status = low(document.getElementById('mxFinStatus')?.value);
  const settlement = low(document.getElementById('mxFinSettlement')?.value);
  const env = low(document.getElementById('mxFinEnv')?.value);
  const method = low(document.getElementById('mxFinMethod')?.value);
  const from = document.getElementById('mxFinFrom')?.value || '';
  const to = document.getElementById('mxFinTo')?.value || '';
  return rows.filter(r=>{
    const hay = [r.colegio,r.curso,r.concepto,r.buy_order,r.authorization_code,r.course_key].map(low).join(' ');
    if(q && !hay.includes(q)) return false;
    if(status && low(r.estado) !== status && low(r.transbank_status) !== status) return false;
    if(settlement && low(r.liquidacion_estado) !== settlement) return false;
    if(env && low(r.environment) !== env) return false;
    if(method && low(r.metodo_pago || r.canal_recaudacion) !== method) return false;
    const d = String(r.fecha || '').slice(0,10);
    if(from && d && d < from) return false;
    if(to && d && d > to) return false;
    return true;
  });
}

function dayStart(v){ const d = new Date(v); return Number.isNaN(d.getTime()) ? null : new Date(d.getFullYear(),d.getMonth(),d.getDate()); }
function bucketInfo(v, granularity){
  const base = dayStart(v); if(!base) return null;
  let d = new Date(base);
  if(granularity === 'week'){
    const weekday = (d.getDay()+6)%7;
    d.setDate(d.getDate()-weekday);
  } else if(granularity === 'month') d = new Date(d.getFullYear(),d.getMonth(),1);
  const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  let label = d.toLocaleDateString('es-CL',{day:'2-digit',month:'2-digit'});
  if(granularity === 'week') label = 'Sem ' + d.toLocaleDateString('es-CL',{day:'2-digit',month:'short'}).replace('.','');
  if(granularity === 'month') label = d.toLocaleDateString('es-CL',{month:'short',year:'numeric'}).replace('.','');
  return {key,label,date:d};
}

function chartBuckets(){
  const metric = METRICS[state.metric] || METRICS.gross;
  const map = new Map();
  filteredRows().forEach(r=>{
    const b = bucketInfo(r.fecha,state.granularity); if(!b) return;
    if(!map.has(b.key)) map.set(b.key,{...b,value:0,count:0});
    const item = map.get(b.key);
    item.count += 1;
    item.value += metric.field ? n(r[metric.field]) : 1;
  });
  return Array.from(map.values()).sort((a,b)=>a.date-b.date);
}

function renderChart(){
  const host = document.getElementById('mxFinChart');
  if(!host) return;
  const metric = METRICS[state.metric] || METRICS.gross;
  const buckets = chartBuckets();
  const max = Math.max(0,...buckets.map(x=>x.value));
  const total = buckets.reduce((a,x)=>a+x.value,0);
  host.innerHTML = buckets.length ? buckets.map(x=>{
    const pct = max > 0 ? Math.max(2,Math.round((x.value/max)*82)) : 2;
    const display = metric.money ? clp(x.value) : Number(x.value).toLocaleString('es-CL');
    return `<div class="mxFinBarCol" title="${esc(x.label)} · ${esc(metric.label)}: ${esc(display)}"><div class="mxFinBarValue">${esc(display)}</div><div class="mxFinBar" style="height:${pct}%"></div><div class="mxFinBarLabel">${esc(x.label)}</div></div>`;
  }).join('') : `<div class="mxFinChartEmpty">No hay datos para los filtros seleccionados.</div>`;
  const totalEl = document.getElementById('mxFinChartTotal');
  const bucketsEl = document.getElementById('mxFinChartBuckets');
  if(totalEl) totalEl.textContent = `Total mostrado: ${metric.money ? clp(total) : Number(total).toLocaleString('es-CL')}`;
  if(bucketsEl) bucketsEl.textContent = `${buckets.length} período(s)`;
}

function pageNumbers(current,total){
  if(total <= 7) return Array.from({length:total},(_,i)=>i+1);
  const set = new Set([1,total,current-1,current,current+1].filter(x=>x>=1&&x<=total));
  return Array.from(set).sort((a,b)=>a-b);
}

function renderRows(){
  const host = document.getElementById('mxFinRows');
  if(!host) return;
  const rows = filteredRows();
  const totalPages = Math.max(1,Math.ceil(rows.length/PAGE_SIZE));
  if(state.page > totalPages) state.page = totalPages;
  const start = (state.page-1)*PAGE_SIZE;
  const pageRows = rows.slice(start,start+PAGE_SIZE);
  host.innerHTML = pageRows.map(r=>`<tr>
    <td>${fmtDate(r.fecha)}</td>
    <td class="mxFinCourse"><b>${esc(r.colegio || '—')}</b><small>${esc([r.curso,r.jornada,r.anio].filter(Boolean).join(' · '))}</small></td>
    <td>${esc(r.concepto || 'Pago')}</td>
    <td>${esc(r.metodo_pago || r.canal_recaudacion || '—')}</td>
    <td>${esc(r.environment || '—')}</td>
    <td>${esc(r.transbank_status || r.estado || '—')}</td>
    <td>${esc(r.liquidacion_estado || '—')}</td>
    <td>${clp(r.monto_curso)}</td>
    <td class="mxFinNeg">${clp(r.comision_transbank)}</td>
    <td class="mxFinPurple">${clp(r.comision_micursox)}</td>
    <td class="mxFinPos">${clp(r.monto_total_cobrado)}</td>
    <td>${esc(r.authorization_code || '—')}</td>
  </tr>`).join('') || `<tr><td colspan="12" style="text-align:center;padding:28px;color:#667085">No hay movimientos para los filtros seleccionados.</td></tr>`;
  const count = document.getElementById('mxFinCount');
  if(count) count.textContent = `${rows.length} movimiento(s)`;
  const pager = document.getElementById('mxFinPager');
  if(pager){
    const shownFrom = rows.length ? start+1 : 0;
    const shownTo = Math.min(start+PAGE_SIZE,rows.length);
    const nums = pageNumbers(state.page,totalPages);
    let numHtml = '';
    let prev = 0;
    nums.forEach(num=>{
      if(prev && num-prev>1) numHtml += `<span style="padding:0 4px;color:#98a2b3">…</span>`;
      numHtml += `<button class="mxFinPageBtn ${num===state.page?'active':''}" data-page="${num}">${num}</button>`;
      prev = num;
    });
    pager.innerHTML = `<div class="mxFinPagerInfo">Mostrando ${shownFrom}-${shownTo} de ${rows.length} · 20 por página</div><div class="mxFinPagerBtns"><button class="mxFinPageBtn" data-page="${state.page-1}" ${state.page<=1?'disabled':''}>‹</button>${numHtml}<button class="mxFinPageBtn" data-page="${state.page+1}" ${state.page>=totalPages?'disabled':''}>›</button></div>`;
    pager.querySelectorAll('[data-page]').forEach(btn=>btn.addEventListener('click',()=>{
      if(btn.disabled) return;
      state.page = Math.min(totalPages,Math.max(1,Number(btn.dataset.page)||1));
      renderRows();
      document.querySelector('.mxFinTable')?.scrollIntoView({behavior:'smooth',block:'start'});
    }));
  }
}

function renderAll(){ renderChart(); renderRows(); }

function exportCsv(){
  const rows = filteredRows();
  const header = ['Fecha','Colegio','Curso','Concepto','Método','Ambiente','Estado TBK','Liquidación','Monto curso','Comisión Transbank','Ingreso MiCursoX','Total cobrado','Autorización'];
  const vals = rows.map(r=>[r.fecha,r.colegio,[r.curso,r.jornada,r.anio].filter(Boolean).join(' '),r.concepto,r.metodo_pago||r.canal_recaudacion,r.environment,r.transbank_status||r.estado,r.liquidacion_estado,r.monto_curso,r.comision_transbank,r.comision_micursox,r.monto_total_cobrado,r.authorization_code]);
  const csv = [header,...vals].map(row=>row.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(';')).join('\n');
  const blob = new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `micursox-finanzas-${new Date().toISOString().slice(0,10)}.csv`; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}

async function renderFinance(force=false){
  injectStyle();
  if(title) title.textContent = 'Finanzas / Contabilidad';
  if(sub) sub.textContent = 'Pagos, comisiones, ingresos MiCursoX y liquidación por curso';
  document.querySelectorAll('.sideItem').forEach(b=>b.classList.toggle('active', b.dataset.tab==='finanzas'));
  document.body.classList.remove('sideOpen');
  app.innerHTML = `<section class="panel"><p class="muted" style="padding:18px;font-weight:800">Cargando información financiera desde Supabase…</p></section>`;
  try { await loadData(force); } catch(e){ app.innerHTML = `<section class="panel"><div class="panelHead"><h2>No se pudo cargar Finanzas</h2></div><p class="muted" style="padding:18px">${esc(e?.message || String(e))}</p></section>`; return; }
  const s = state.data.summary || {};
  app.innerHTML = `
    <div class="mxFinActions"><button class="adminBtn ghost" id="mxFinRefresh">Actualizar</button><button class="adminBtn" id="mxFinCsv">Exportar CSV</button></div>
    <section class="mxFinKpis">
      <article class="mxFinCard"><span>Volumen cobrado</span><strong>${clp(s.gross_collected)}</strong><small>${Number(s.payments_count||0)} pagos confirmados</small></article>
      <article class="mxFinCard"><span>Ingreso MiCursoX</span><strong>${clp(s.micursox_income)}</strong><small>Comisión acumulada</small></article>
      <article class="mxFinCard"><span>Costo Transbank</span><strong>${clp(s.transbank_fees)}</strong><small>Comisiones pagadas</small></article>
      <article class="mxFinCard"><span>Fondos de cursos</span><strong>${clp(s.course_amount)}</strong><small>Monto base destinado a cursos</small></article>
      <article class="mxFinCard"><span>En liquidación</span><strong>${clp(s.pending_settlement)}</strong><small>Aún no disponible para retiro</small></article>
      <article class="mxFinCard"><span>Liquidado a cursos</span><strong>${clp(s.settled_course_amount)}</strong><small>Disponible según reglas de retiro</small></article>
      <article class="mxFinCard"><span>Retiros pagados</span><strong>${clp(s.withdrawals_paid)}</strong><small>Depósitos ya procesados</small></article>
    </section>
    <section class="panel mxFinChartPanel">
      <div class="mxFinChartHead"><div><h2>Evolución financiera</h2><p class="muted">Misma información de las cards, agrupada por período.</p></div><div class="mxFinChartTools"><select id="mxFinMetric"><option value="gross">Volumen cobrado</option><option value="micursox">Ganancia MiCursoX</option><option value="transbank">Comisiones Transbank</option><option value="course">Fondos de cursos</option><option value="payments">Cantidad de pagos</option></select><div class="mxFinSeg" id="mxFinGranularity"><button data-granularity="day">Días</button><button data-granularity="week">Semanas</button><button data-granularity="month">Meses</button></div></div></div>
      <div class="mxFinChartWrap"><div class="mxFinChart" id="mxFinChart"></div></div>
      <div class="mxFinChartFoot"><span id="mxFinChartTotal"></span><span id="mxFinChartBuckets"></span></div>
    </section>
    <section class="panel">
      <div class="panelHead"><div><h2>Detalle financiero</h2><p class="muted" id="mxFinCount" style="margin:5px 0 0"></p></div></div>
      <div class="mxFinFilters">
        <input id="mxFinQ" placeholder="Colegio, curso, concepto…">
        <select id="mxFinStatus"><option value="">Todos los estados</option><option value="approved">Approved</option><option value="paid">Pagado</option><option value="pending">Pendiente</option><option value="rejected">Rechazado</option></select>
        <select id="mxFinSettlement"><option value="">Toda liquidación</option><option value="confirmado">Confirmado</option><option value="liquidado">Liquidado</option><option value="pendiente">Pendiente</option></select>
        <select id="mxFinMethod"><option value="">Todos los métodos</option><option value="transbank">Transbank</option><option value="transferencia">Transferencia</option><option value="efectivo">Efectivo</option></select>
        <select id="mxFinEnv"><option value="">Todos los ambientes</option><option value="integration">Integration</option><option value="production">Production</option></select>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><input id="mxFinFrom" type="date" title="Desde"><input id="mxFinTo" type="date" title="Hasta"></div>
      </div>
      <div class="tableWrap"><table class="mxFinTable"><thead><tr><th>Fecha</th><th>Colegio / curso</th><th>Concepto</th><th>Método</th><th>Ambiente</th><th>Estado</th><th>Liquidación</th><th>Monto curso</th><th>Transbank</th><th>MiCursoX</th><th>Total cobrado</th><th>Aut.</th></tr></thead><tbody id="mxFinRows"></tbody></table></div>
      <div id="mxFinPager" class="mxFinPager"></div>
    </section>`;
  const metricSelect = document.getElementById('mxFinMetric');
  if(metricSelect){ metricSelect.value = state.metric; metricSelect.addEventListener('change',()=>{ state.metric = metricSelect.value; renderChart(); }); }
  document.querySelectorAll('#mxFinGranularity [data-granularity]').forEach(btn=>{
    btn.classList.toggle('active',btn.dataset.granularity===state.granularity);
    btn.addEventListener('click',()=>{
      state.granularity = btn.dataset.granularity;
      document.querySelectorAll('#mxFinGranularity [data-granularity]').forEach(x=>x.classList.toggle('active',x.dataset.granularity===state.granularity));
      renderChart();
    });
  });
  ['mxFinQ','mxFinStatus','mxFinSettlement','mxFinMethod','mxFinEnv','mxFinFrom','mxFinTo'].forEach(id=>document.getElementById(id)?.addEventListener('input',()=>{ state.page=1; renderAll(); }));
  document.getElementById('mxFinRefresh')?.addEventListener('click',()=>renderFinance(true));
  document.getElementById('mxFinCsv')?.addEventListener('click',exportCsv);
  renderAll();
}

const originalGo = window.Admin && typeof window.Admin.go === 'function' ? window.Admin.go.bind(window.Admin) : null;
if(window.Admin){ window.Admin.go = function(tab){ if(tab==='finanzas'){ renderFinance(); return; } return originalGo ? originalGo(tab) : undefined; }; }

document.addEventListener('click', ev=>{
  const btn = ev.target?.closest?.('.sideItem[data-tab="finanzas"]');
  if(!btn) return;
  ev.preventDefault(); ev.stopImmediatePropagation(); renderFinance();
}, true);

window.MiCursoXAdminFinance = Object.freeze({render:renderFinance, refresh:()=>renderFinance(true)});
