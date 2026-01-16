/* ========= Cursapp – app.js BASE ESTABLE (gráfico visible iOS) ========= */

document.body.insertAdjacentHTML("afterbegin",
  "<div style='padding:8px 12px;background:#fff3cd;border:1px solid #ffeeba;color:#856404;font-weight:800;'>DEBUG role: " +
  (JSON.parse(localStorage.getItem('cursapp_demo_user')||'{}').role || 'NONE') +
  "</div>"
);
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("logoutBtn");
  if (btn) {
    btn.addEventListener("click", () => {
      localStorage.removeItem("cursapp_demo_user");
      window.location.href = "login.html";
    });
  }
});
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
      <div class="card">
        <div class="kpiLabel">Total recaudado</div>
        <div class="kpi">${formatCLP(collected)}</div>
      </div>
      <div class="card">
        <div class="kpiLabel">Total pendiente</div>
        <div class="kpi">${formatCLP(pending)}</div>
      </div>
      <div class="card">
        <div class="kpiLabel">Tus alumnos</div>
        <div class="kpi">${alumnos.length}</div>
      </div>
    </div>

    <div class="card" style="margin-top:14px;">
      <div class="kpiLabel">Cobrado vs pendiente</div>
      <div id="chart" style="margin-top:12px; min-height:90px;"></div>
    </div>
  `;

  renderChart(collected, pending);
}

/* simple chart – mobile safe */
function renderChart(collected, pending){
  const el = document.getElementById('chart');
  if(!el) return;

  const max = Math.max(collected, pending, 1);
  const barMax = 260;
  const cw = Math.max(10, Math.round((collected/max)*barMax));
  const pw = Math.max(10, Math.round((pending/max)*barMax));

  el.innerHTML = `
    <div style="display:grid;gap:16px;">
      <div>
        <div style="display:flex;justify-content:space-between;font-size:13px;color:#6b7280;margin-bottom:6px;">
          <span>Cobrado</span><strong>${formatCLP(collected)}</strong>
        </div>
        <div style="height:16px;background:#e5e7eb;border-radius:999px;overflow:hidden;">
          <div style="height:16px;width:${cw}px;background:#5b5ce2;border-radius:999px;"></div>
        </div>
      </div>

      <div>
        <div style="display:flex;justify-content:space-between;font-size:13px;color:#6b7280;margin-bottom:6px;">
          <span>Pendiente</span><strong>${formatCLP(pending)}</strong>
        </div>
        <div style="height:16px;background:#e5e7eb;border-radius:999px;overflow:hidden;">
          <div style="height:16px;width:${pw}px;background:#cbd5e1;border-radius:999px;"></div>
        </div>
      </div>
    </div>
  `;
}

/* boot */
document.addEventListener('DOMContentLoaded', renderHome);
