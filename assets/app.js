/* ========= Cursapp · app.js (ESTABLE + PAGOS) =========
  - Un solo dashboard (dashboard.html)
  - Roles: apoderado / tesorero / presidente
  - Tabs: Inicio / Pagos / Retiros
  - Pagos:
      * Apoderado: ve sus alumnos, paga (demo) -> marca pagado + genera comprobante
      * Tesorero/Presidente: ve todo, concilia manual (folio obligatorio) -> marca pagado + comprobante
*/

const KEY_USER = "cursapp_demo_user";
const KEY_PAYMENTS = "cursapp_payments_v1";
const KEY_RECEIPTS = "cursapp_receipts_v1";

function formatCLP(v){ return '$' + Number(v||0).toLocaleString('es-CL'); }
function capitalize(s){ return (s||'').charAt(0).toUpperCase() + (s||'').slice(1); }
function uid(prefix="id"){ return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`; }

function getUser(){ return JSON.parse(localStorage.getItem(KEY_USER) || "null"); }
function setUser(u){ localStorage.setItem(KEY_USER, JSON.stringify(u)); }

function logout(){
  localStorage.removeItem(KEY_USER);
  window.location.href = "login.html";
}

function isDirectiva(role){ return role === "tesorero" || role === "presidente"; }

/* ---------- Storage helpers ---------- */
function loadPayments(){ return JSON.parse(localStorage.getItem(KEY_PAYMENTS) || "[]"); }
function savePayments(p){ localStorage.setItem(KEY_PAYMENTS, JSON.stringify(p)); }

function loadReceipts(){ return JSON.parse(localStorage.getItem(KEY_RECEIPTS) || "[]"); }
function saveReceipts(r){ localStorage.setItem(KEY_RECEIPTS, JSON.stringify(r)); }

function getReceiptByPaymentId(pid){
  return loadReceipts().find(r => r.paymentId === pid) || null;
}

function upsertReceipt(receipt){
  const list = loadReceipts().filter(r => r.paymentId !== receipt.paymentId);
  list.unshift(receipt);
  saveReceipts(list);
}

/* ---------- Seed demo payments (one-time) ---------- */
function ensureSeedPayments(){
  const existing = loadPayments();
  if(existing && existing.length) return;

  const seed = [
    // Apoderado (Demo) tendrá 2 alumnos
    { id: uid("pay"), alumno:"Hermano 1", apoderadoRole:"apoderado", concept:"Cuota Marzo", amount:20000, status:"paid" },
    { id: uid("pay"), alumno:"Hermano 1", apoderadoRole:"apoderado", concept:"Cuota Abril", amount:30000, status:"pending" },
    { id: uid("pay"), alumno:"Hermano 2", apoderadoRole:"apoderado", concept:"Cuota Marzo", amount:20000, status:"pending" },

    // Otros apoderados (para vista directiva)
    { id: uid("pay"), alumno:"Ana Soto (Hija)", apoderadoRole:"apoderado_other", concept:"Cuota Abril", amount:12000, status:"pending" },
    { id: uid("pay"), alumno:"Carlos Díaz (Hijo)", apoderadoRole:"apoderado_other", concept:"Cuota Abril", amount:12000, status:"paid" },
    { id: uid("pay"), alumno:"María Pérez (Hija)", apoderadoRole:"apoderado_other", concept:"Cuota Abril", amount:12000, status:"pending" },
  ];

  savePayments(seed);

  // Seed receipts for paid
  seed.filter(p => p.status === "paid").forEach(p => {
    if(!getReceiptByPaymentId(p.id)){
      upsertReceipt({
        id: uid("rc"),
        paymentId: p.id,
        alumno: p.alumno,
        concept: p.concept,
        amount: p.amount,
        method: "Conciliación inicial (Demo)",
        ref: "SEED",
        note: "Pago seed",
        paidAt: new Date().toISOString()
      });
    }
  });
}

/* ---------- App boot ---------- */
document.addEventListener("DOMContentLoaded", () => {
  const user = getUser();
  if(!user){
    window.location.href = "login.html";
    return;
  }

  ensureSeedPayments();

  const whoLine = document.getElementById("whoLine");
  if(whoLine){
    whoLine.textContent = `${user.name} · ${user.role}`;
  }

  renderByRole(user.role, "home");
});

/* ---------- Router ---------- */
function goTab(tab){
  const user = getUser();
  if(!user) return logout();
  renderByRole(user.role, tab);
}

function renderByRole(role, tab){
  if(role === "apoderado") renderApoderado(tab);
  else if(role === "tesorero") renderTesorero(tab);
  else if(role === "presidente") renderPresidente(tab);
  else renderApoderado(tab);
}

/* ---------- UI components ---------- */
function tabbar(active){
  return `
    <nav class="tabbar">
      <button class="tab ${active==="home"?"active":""}" onclick="goTab('home')">
        <span class="ico">🏠</span><span>Inicio</span>
      </button>
      <button class="tab ${active==="payments"?"active":""}" onclick="goTab('payments')">
        <span class="ico">💳</span><span>Pagos</span>
      </button>
      <button class="tab ${active==="withdraws"?"active":""}" onclick="goTab('withdraws')">
        <span class="ico">🏦</span><span>Retiros</span>
      </button>
    </nav>
  `;
}

function kpiCard(icon, label, value){
  return `
    <div class="card">
      <div class="kpiHead">
        <span class="kpiIcon">${icon}</span>
        <span class="kpiLabel">${label}</span>
      </div>
      <div class="kpi">${value}</div>
    </div>
  `;
}

function kpiCards(collected, pending, alumnos){
  return `
    <div class="grid3">
      ${kpiCard("💰", "Total recaudado", formatCLP(collected))}
      ${kpiCard("⏳", "Total pendiente", formatCLP(pending))}
      ${kpiCard("👥", "Alumnos", String(alumnos))}
    </div>
  `;
}

function chart(collected, pending){
  const max = Math.max(collected, pending, 1);
  const cw = Math.max(10, Math.round((collected/max)*260));
  const pw = Math.max(10, Math.round((pending/max)*260));

  return `
    <div class="card" style="margin-top:12px;">
      <div class="kpiLabel">Cobrado vs Pendiente</div>

      <div style="margin-top:10px;">
        <div class="muted">Cobrado ${formatCLP(collected)}</div>
        <div class="bar"><div class="barFill primary" style="width:${cw}px"></div></div>
      </div>

      <div style="margin-top:10px;">
        <div class="muted">Pendiente ${formatCLP(pending)}</div>
        <div class="bar"><div class="barFill gray" style="width:${pw}px"></div></div>
      </div>
    </div>
  `;
}

function viewShell(title, subtitle, body, tab){
  const app = document.getElementById("app");
  if(!app) return;
  app.innerHTML = `
    <h1>${title}</h1>
    <p class="muted">${subtitle}</p>
    ${body}
    ${tabbar(tab)}
  `;
}

/* ---------- Payments logic ---------- */
function computeSummaryForRole(role){
  const payments = loadPayments();
  const directiva = isDirectiva(role);

  const visible = directiva
    ? payments
    : payments.filter(p => p.apoderadoRole === "apoderado");

  const collected = visible.filter(p=>p.status==="paid").reduce((a,b)=>a+Number(b.amount||0),0);
  const pending = visible.filter(p=>p.status!=="paid").reduce((a,b)=>a+Number(b.amount||0),0);

  const alumnos = new Set(visible.map(p=>p.alumno)).size;
  return { collected, pending, alumnos };
}

function renderPaymentsList(role){
  const directiva = isDirectiva(role);
  const payments = loadPayments();

  const visible = directiva
    ? payments
    : payments.filter(p => p.apoderadoRole === "apoderado");

  // group by alumno (apoderado)
  const groups = {};
  visible.forEach(p => {
    groups[p.alumno] = groups[p.alumno] || [];
    groups[p.alumno].push(p);
  });

  const alumnoNames = Object.keys(groups);

  if(!alumnoNames.length){
    return `<div class="card"><div class="muted">Sin pagos.</div></div>`;
  }

  const sections = alumnoNames.map(al => {
    const rows = groups[al].map(p => paymentRow(role, p)).join("");
    return `
      <div class="card" style="margin-top:12px;">
        <div style="font-weight:900; margin-bottom:8px;">${al}</div>
        ${rows}
      </div>
    `;
  }).join("");

  return sections;
}

function paymentRow(role, p){
  const paid = p.status === "paid";
  const tag = paid
    ? `<span class="tag ok">Pagado</span>`
    : `<span class="tag warn">Pendiente</span>`;

  const receipt = getReceiptByPaymentId(p.id);

  let action = `<span class="muted">—</span>`;

  if(isDirectiva(role)){
    // Directiva: conciliar manual si pendiente, ver comprobante si pagado
    if(!paid){
      action = `<button class="btn ghost" onclick="openRecon('${p.id}')">Conciliar</button>`;
    } else if(receipt){
      action = `<button class="btn ghost" onclick="openReceipt('${p.id}')">Comprobante</button>`;
    }
  } else {
    // Apoderado: pagar si pendiente, ver comprobante si pagado
    if(!paid){
      action = `<button class="btn primary" onclick="openPay('${p.id}')">Pagar</button>`;
    } else if(receipt){
      action = `<button class="btn ghost" onclick="openReceipt('${p.id}')">Comprobante</button>`;
    }
  }

  return `
    <div style="display:flex; justify-content:space-between; gap:12px; padding:10px 0; border-top:1px solid rgba(229,231,235,.6);">
      <div style="min-width:0;">
        <div style="font-weight:800;">${p.concept}</div>
        <div class="muted">${formatCLP(p.amount)}</div>
      </div>
      <div style="display:flex; align-items:center; gap:10px; flex-shrink:0;">
        ${tag}
        ${action}
      </div>
    </div>
  `;
}

/* --- Actions: Pay / Recon / Receipt --- */
function openPay(paymentId){
  const p = loadPayments().find(x => x.id === paymentId);
  if(!p) return;

  // Demo payment: mark paid + create receipt
  p.status = "paid";
  savePayments(loadPayments().map(x => x.id===p.id ? p : x));

  upsertReceipt({
    id: uid("rc"),
    paymentId: p.id,
    alumno: p.alumno,
    concept: p.concept,
    amount: p.amount,
    method: "Webpay (Demo)",
    ref: uid("trx"),
    note: "Pago automático (demo)",
    paidAt: new Date().toISOString()
  });

  alert("Pago aprobado (demo). Comprobante generado.");
  goTab("payments");
}

function openRecon(paymentId){
  const p = loadPayments().find(x => x.id === paymentId);
  if(!p) return;

  const ref = prompt("Ingresa folio / referencia (obligatorio):");
  if(!ref) return;

  p.status = "paid";
  savePayments(loadPayments().map(x => x.id===p.id ? p : x));

  upsertReceipt({
    id: uid("rc"),
    paymentId: p.id,
    alumno: p.alumno,
    concept: p.concept,
    amount: p.amount,
    method: "Conciliación manual",
    ref,
    note: "Conciliación (demo)",
    paidAt: new Date().toISOString()
  });

  alert("Conciliado (demo). Comprobante generado.");
  goTab("payments");
}

function openReceipt(paymentId){
  const r = getReceiptByPaymentId(paymentId);
  if(!r){ alert("No hay comprobante."); return; }

  const html = `
  <html lang="es">
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width,initial-scale=1"/>
    <title>Comprobante</title>
    <style>
      body{font-family:system-ui,-apple-system;background:#f5f7fb;margin:0;padding:16px}
      .card{background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:16px;max-width:560px;margin:0 auto}
      .muted{color:#64748b;font-size:13px}
      .row{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:10px}
      .k{color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:.04em;font-weight:800}
      .v{font-weight:900}
      button{border:none;padding:10px 12px;border-radius:12px;background:#5b5ce2;color:#fff;font-weight:800;width:100%;margin-top:14px}
    </style>
  </head>
  <body>
    <div class="card">
      <h1 style="margin:0 0 6px;">Comprobante</h1>
      <div class="muted">ID: ${r.id}</div>

      <div class="row"><div><div class="k">Alumno</div><div class="v">${r.alumno}</div></div><div><div class="k">Monto</div><div class="v">${formatCLP(r.amount)}</div></div></div>
      <div class="row"><div><div class="k">Concepto</div><div class="v">${r.concept}</div></div><div><div class="k">Método</div><div class="v">${r.method}</div></div></div>
      <div class="row"><div><div class="k">Ref</div><div class="v">${r.ref || "-"}</div></div><div><div class="k">Fecha</div><div class="v">${new Date(r.paidAt).toLocaleString("es-CL")}</div></div></div>
      <div class="row"><div><div class="k">Nota</div><div class="v">${r.note || "-"}</div></div></div>

      <button onclick="window.print()">Imprimir / Guardar PDF</button>
    </div>
  </body>
  </html>
  `;

  const w = window.open("", "_blank");
  if(!w){ alert("Popup bloqueado"); return; }
  w.document.open(); w.document.write(html); w.document.close();
}

/* ---------- Views ---------- */
function renderApoderado(tab){
  const {collected,pending,alumnos} = computeSummaryForRole("apoderado");

  const body =
    tab==="home"
      ? `${kpiCards(collected,pending,alumnos)}${chart(collected,pending)}`
      : tab==="payments"
        ? `${renderPaymentsList("apoderado")}`
        : `<div class="card"><div class="kpiLabel">Retiros</div><div class="muted">Apoderado: lectura/votación (demo).</div></div>`;

  viewShell("Apoderado","2°B 2026 · Colegio X", body, tab);
}

function renderTesorero(tab){
  const {collected,pending,alumnos} = computeSummaryForRole("tesorero");

  const body =
    tab==="home"
      ? `${kpiCards(collected,pending,alumnos)}${chart(collected,pending)}`
      : tab==="payments"
        ? `${renderPaymentsList("tesorero")}`
        : `<div class="card"><div class="kpiLabel">Retiros</div><div class="muted">Tesorero: gestiona retiros (demo).</div></div>`;

  viewShell("Tesorero","Administración del curso", body, tab);
}

function renderPresidente(tab){
  const {collected,pending,alumnos} = computeSummaryForRole("presidente");

  const body =
    tab==="home"
      ? `${kpiCards(collected,pending,alumnos)}${chart(collected,pending)}
         <button class="btn primary" style="width:100%;margin-top:12px;">Crear cobro</button>`
      : tab==="payments"
        ? `${renderPaymentsList("presidente")}`
        : `<div class="card"><div class="kpiLabel">Retiros</div><div class="muted">Presidente: cierra votación (demo).</div></div>`;

  viewShell("Presidente","Administración del curso", body, tab);
}
