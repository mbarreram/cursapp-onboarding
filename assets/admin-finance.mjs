const sb = window.CURSAPP_SUPABASE;
const app = document.getElementById('adminApp');
const title = document.getElementById('viewTitle');
const sub = document.getElementById('viewSub');

function clp(v){ return '$' + Number(v || 0).toLocaleString('es-CL'); }
function esc(v){ return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function fmtDate(v){ try { return v ? new Date(v).toLocaleString('es-CL',{dateStyle:'short',timeStyle:'short'}) : '—'; } catch(_) { return v || '—'; } }
function low(v){ return String(v || '').toLowerCase(); }

const state = { loaded:false, loading:false, data:{summary:{},rows:[]} };

function injectStyle(){
  if(document.getElementById('mxAdminFinanceStyle')) return;
  const st = document.createElement('style');
  st.id = 'mxAdminFinanceStyle';
  st.textContent = `
  .mxFinKpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-bottom:18px}
  .mxFinCard{background:#fff;border:1px solid rgba(16,24,40,.08);border-radius:18px;padding:16px;box-shadow:0 10px 28px rgba(16,24,40,.04)}
  .mxFinCard span{display:block;color:#667085;font-size:12px;font-weight:850}.mxFinCard strong{display:block;margin-top:8px;font-size:24px;letter-spacing:-.4px}.mxFinCard small{display:block;margin-top:7px;color:#667085;font-weight:750}
  .mxFinFilters{display:grid;grid-template-columns:repeat(6,minmax(140px,1fr));gap:10px;padding:16px;border-bottom:1px solid rgba(16,24,40,.07)}
  .mxFinFilters input,.mxFinFilters select{width:100%;border:1px solid rgba(16,24,40,.1);border-radius:12px;padding:10px 11px;background:#fff;font-weight:750;color:#344054}
  .mxFinActions{display:flex;gap:10px;justify-content:flex-end;padding:0 0 14px;flex-wrap:wrap}
  .mxFinTable td,.mxFinTable th{white-space:nowrap}.mxFinTable td:first-child,.mxFinTable th:first-child{position:sticky;left:0;background:#fff;z-index:1}
  .mxFinCourse{white-space:normal;min-width:190px}.mxFinCourse b{display:block}.mxFinCourse small{display:block;color:#667085;margin-top:3px}
  .mxFinPos{color:#166534;font-weight:900}.mxFinNeg{color:#b42318;font-weight:900}.mxFinPurple{color:#6d28d9;font-weight:900}
  @media(max-width:1200px){.mxFinKpis{grid-template-columns:repeat(2,1fr)}.mxFinFilters{grid-template-columns:repeat(3,1fr)}}
  @media(max-width:700px){.mxFinKpis{grid-template-columns:1fr}.mxFinFilters{grid-template-columns:1fr}.mxFinActions{justify-content:stretch}.mxFinActions button{flex:1}.mxFinCard strong{font-size:21px}}
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

function renderRows(){
  const host = document.getElementById('mxFinRows');
  if(!host) return;
  const rows = filteredRows();
  host.innerHTML = rows.map(r=>`<tr>
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
}

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
    </section>`;
  ['mxFinQ','mxFinStatus','mxFinSettlement','mxFinMethod','mxFinEnv','mxFinFrom','mxFinTo'].forEach(id=>document.getElementById(id)?.addEventListener('input',renderRows));
  document.getElementById('mxFinRefresh')?.addEventListener('click',()=>renderFinance(true));
  document.getElementById('mxFinCsv')?.addEventListener('click',exportCsv);
  renderRows();
}

const originalGo = window.Admin && typeof window.Admin.go === 'function' ? window.Admin.go.bind(window.Admin) : null;
if(window.Admin){ window.Admin.go = function(tab){ if(tab==='finanzas'){ renderFinance(); return; } return originalGo ? originalGo(tab) : undefined; }; }

document.addEventListener('click', ev=>{
  const btn = ev.target?.closest?.('.sideItem[data-tab="finanzas"]');
  if(!btn) return;
  ev.preventDefault(); ev.stopImmediatePropagation(); renderFinance();
}, true);

window.MiCursoXAdminFinance = Object.freeze({render:renderFinance, refresh:()=>renderFinance(true)});
