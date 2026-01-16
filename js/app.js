/* ========= Cursapp – app.js BASE ESTABLE ========= */

/* helpers */
function jload(k, d){ try { return JSON.parse(localStorage.getItem(k)) ?? d } catch(e){ return d } }
function jsave(k, v){ localStorage.setItem(k, JSON.stringify(v)); }
function formatCLP(v){ return '$' + Number(v||0).toLocaleString('es-CL'); }

/* demo payments */
function seedPaymentsIfEmpty(){
  let pays = jload('cursapp_payments', []);
  if(pays.length) return pays;

  pays = [
    { alumno:'Hermano 1', concepto:'Cuota Marzo', monto:20000, estado:'pagado' },
    { alumno:'Hermano 1', concepto:'Cuota Abril', monto:30000, estado:'pendiente' },
    { alumno:'Hermano 2', concepto:'Cuota Marzo', monto:20000, estado:'pendiente' }
  ];
  jsave('cursapp_payments', pays);
  return pays;
}

/* render home */
function renderHome(){
  const app = document.getElementById('app');
  if(!app) return;

  const payments = seedPaymentsIfEmpty();

  const collected = payments.filter(p=>p.estado==='pagado').reduce((s,p)=>s+p.monto,0);
  const pending   = payments.filter(p=>p.estado==='pendiente').reduce((s,p)=>s+p.monto,0);
  const alumnos   = [...new Set(payments.map(p=>p.alumno))];

  app.innerHTML = `
    <h1>Apoderado</h1>
    <div class="muted">2°B 2026 · Colegio X</div>

    <div class="grid3">
      <div class="card"><div class="kpiLabel">Total recaudado</div><div class="kpi">${formatCLP(collected)}</div></div>
      <div class="card"><div class="kpiLabel">Total pendiente</div><div class="kpi">${formatCLP(pending)}</div></div>
      <div class="card"><div class="kpiLabel">Tus alumnos</div><div class="kpi">${alumnos.length}</div></div>
    </div>

    <div class="card" style="margin-top:12px;">
      <div class="kpiLabel">Cobrado vs pendiente</div>
      <div id="chart"></div>
    </div>
  `;

  renderChart(collected, pending);
}

/* simple chart */
function renderChart(collected, pending){
  const el = document.getElementById('chart');
  if(!el) return;

  const max = Math.max(collected, pending, 1);
  const cw = Math.round((collected/max)*260);
  const pw = Math.round((pending/max)*260);

  el.innerHTML = `
    <div style="margin-top:8px;">
      <div>Cobrado ${formatCLP(collected)}</div>
      <div style="height:10px;background:#e5e7eb;border-radius:6px;">
        <div style="height:10px;width:${cw}px;background:#5b5ce2;border-radius:6px;"></div>
      </div>
      <div style="margin-top:8px;">Pendiente ${formatCLP(pending)}</div>
      <div style="height:10px;background:#e5e7eb;border-radius:6px;">
        <div style="height:10px;width:${pw}px;background:#cbd5e1;border-radius:6px;"></div>
      </div>
    </div>
  `;
}

/* boot */
document.addEventListener('DOMContentLoaded', renderHome);
