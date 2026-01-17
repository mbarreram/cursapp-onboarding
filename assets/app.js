/* ========= Cursapp · app.js (ESTABLE + INICIO APODERADO + HOME DIRECTIVA) ========= */

const KEY_USER = "cursapp_demo_user";
const KEY_PAYMENTS = "cursapp_payments_v1";
const KEY_RECEIPTS = "cursapp_receipts_v1";

/* ---------- helpers ---------- */
function formatCLP(v){ return '$' + Number(v||0).toLocaleString('es-CL'); }
function formatCLPNoSign(v){ return Number(v||0).toLocaleString("es-CL"); }
function uid(prefix="id"){ return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`; }

function getUser(){ return JSON.parse(localStorage.getItem(KEY_USER) || "null"); }
function isDirectiva(role){ return role === "tesorero" || role === "presidente"; }

function logout(){
  localStorage.removeItem(KEY_USER);
  window.location.href = "login.html";
}

/* ---------- storage ---------- */
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

/* ---------- seed ---------- */
function ensureSeedPayments(){
  const existing = loadPayments();
  if(existing && existing.length) return;

  const seed = [
    { id: uid("pay"), alumno:"Hermano 1", apoderadoRole:"apoderado", concept:"Cuota Marzo", amount:20000, status:"paid" },
    { id: uid("pay"), alumno:"Hermano 1", apoderadoRole:"apoderado", concept:"Cuota Abril", amount:30000, status:"pending" },
    { id: uid("pay"), alumno:"Hermano 2", apoderadoRole:"apoderado", concept:"Cuota Marzo", amount:20000, status:"pending" },

    { id: uid("pay"), alumno:"Ana Soto (Hija)", apoderadoRole:"apoderado_other", concept:"Cuota Abril", amount:12000, status:"pending" },
    { id: uid("pay"), alumno:"Carlos Díaz (Hijo)", apoderadoRole:"apoderado_other", concept:"Cuota Abril", amount:12000, status:"paid" },
    { id: uid("pay"), alumno:"María Pérez (Hija)", apoderadoRole:"apoderado_other", concept:"Cuota Abril", amount:12000, status:"pending" },
  ];

  savePayments(seed);

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

/* ---------- payments summaries ---------- */
function getVisiblePayments(role){
  const payments = loadPayments();
  return isDirectiva(role)
    ? payments
    : payments.filter(p => p.apoderadoRole === "apoderado");
}

function computeSummary(role){
  const visible = getVisiblePayments(role);
  const collected = visible.filter(p=>p.status==="paid").reduce((a,b)=>a+Number(b.amount||0),0);
  const pending = visible.filter(p=>p.status!=="paid").reduce((a,b)=>a+Number(b.amount||0),0);
  const alumnos = new Set(visible.map(p=>p.alumno)).size;
  return { collected, pending, alumnos };
}

function pendingMy(){
  const mine = loadPayments().filter(p => p.apoderadoRole === "apoderado");
  const pending = mine.filter(p => p.status !== "paid");
  const total = pending.reduce((a,b)=>a+Number(b.amount||0),0);
  return { count: pending.length, amount: total };
}

function listMyStudents(){
  const mine = loadPayments().filter(p => p.apoderadoRole === "apoderado");
  return [...new Set(mine.map(p=>p.alumno))];
}

function coursePending(){
  const all = loadPayments();
  const pending = all.filter(p=>p.status!=="paid");
  return {
    count: pending.length,
    amount: pending.reduce((a,b)=>a+Number(b.amount||0),0)
  };
}

/* Top pendientes para directiva (lista) */
function topPendingList(limit=5){
  const pending = loadPayments().filter(p=>p.status!=="paid");
  return pending.slice(0,limit);
}

/* ---------- payments list ---------- */
function renderPaymentsList(role){
  const payments = loadPayments();
  const visible = isDirectiva(role)
    ? payments
    : payments.filter(p => p.apoderadoRole === "apoderado");

  const groups = {};
  visible.forEach(p => {
    groups[p.alumno] = groups[p.alumno] || [];
    groups[p.alumno].push(p);
  });

  const alumnoNames = Object.keys(groups);
  if(!alumnoNames.length){
    return `<div class="card"><div class="muted">Sin pagos.</div></div>`;
  }

  return alumnoNames.map(al => {
    const rows = groups[al].map(p => paymentRow(role, p)).join("");
    return `
      <div class="card" style="margin-top:12px;">
        <div style="font-weight:900; margin-bottom:8px;">${al}</div>
        ${rows}
      </div>
    `;
  }).join("");
}

function paymentRow(role, p){
  const paid = p.status === "paid";
  const tag = paid
    ? `<span class="tag ok">Pagado</span>`
    : `<span class="tag warn">Pendiente</span>`;

  const receipt = getReceiptByPaymentId(p.id);

  let action = `<span class="muted">—</span>`;

  if(isDirectiva(role)){
    if(!paid){
      action = `<button class="btn ghost" onclick="openRecon('${p.id}')">Conciliar</button>`;
    } else if(receipt){
      action = `<button class="btn ghost" onclick="openReceipt('${p.id}')">Comprobante</button>`;
    }
  } else {
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

/* ---------- actions ---------- */
function openPay(paymentId){
  const p = loadPayments().find(x => x.id === paymentId);
  if(!p) return;

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
  <html lang="es"><head>
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
  </head><body>
    <div class="card">
      <h1 style="margin:0 0 6px;">Comprobante</h1>
      <div class="muted">ID: ${r.id}</div>
      <div class="row"><div><div class="k">Alumno</div><div class="v">${r.alumno}</div></div><div><div class="k">Monto</div><div class="v">${formatCLP(r.amount)}</div></div></div>
      <div class="row"><div><div class="k">Concepto</div><div class="v">${r.concept}</div></div><div><div class="k">Método</div><div class="v">${r.method}</div></div></div>
      <div class="row"><div><div class="k">Ref</div><div class="v">${r.ref || "-"}</div></div><div><div class="k">Fecha</div><div class="v">${new Date(r.paidAt).toLocaleString("es-CL")}</div></div></div>
      <div class="row"><div><div class="k">Nota</div><div class="v">${r.note || "-"}</div></div></div>
      <button onclick="window.print()">Imprimir / Guardar PDF</button>
    </div>
  </body></html>`;

  const w = window.open("", "_blank");
  if(!w){ alert("Popup bloqueado"); return; }
  w.document.open(); w.document.write(html); w.document.close();
}

/* ---------- views ---------- */
function renderApoderado(tab){
  if(tab === "home"){
    const { count, amount } = pendingMy();
    const recaudadoCurso = loadPayments().filter(p=>p.status==="paid").reduce((a,b)=>a+Number(b.amount||0),0);
    const students = listMyStudents();

    const body = `
      ${kpiCard("⏳","Cuotas pendientes", `${formatCLPNoSign(amount)} · ${count} cuotas pendientes`)}
      <button class="btn primary" style="width:100%; margin-top:10px;" onclick="goTab('payments')">Ver pagos</button>

      <div style="margin-top:12px;">
        ${kpiCard("💰","Recaudación del curso", formatCLP(recaudadoCurso))}
      </div>

      <div class="card" style="margin-top:12px;">
        <div class="kpiHead">
          <span class="kpiIcon">🎓</span>
          <span class="kpiLabel">Mis estudiantes</span>
        </div>
        ${students.map(n=>`<div style="font-weight:800; padding:10px 0; border-top:1px solid rgba(229,231,235,.6);">${n}</div>`).join("")}
      </div>
    `;

    viewShell("Apoderado","2°B 2026 · Colegio X", body, tab);
    return;
  }

  const body =
    tab==="payments"
      ? `${renderPaymentsList("apoderado")}`
      : `<div class="card"><div class="kpiLabel">Retiros</div><div class="muted">Apoderado: lectura/votación (demo).</div></div>`;

  viewShell("Apoderado","2°B 2026 · Colegio X", body, tab);
}

function renderTesorero(tab){
  if(tab === "home"){
    const sum = computeSummary("tesorero");
    const pend = coursePending();
    const top = topPendingList(4);

    const body = `
      ${kpiCard("⏳","Pagos por conciliar", `${formatCLP(pend.amount)} · ${pend.count} pendientes`)}
      <button class="btn primary" style="width:100%; margin-top:10px;" onclick="goTab('payments')">Ir a conciliación</button>

      <div style="margin-top:12px;">
        ${kpiCard("💰","Recaudación del curso", formatCLP(sum.collected))}
      </div>

      <div class="card" style="margin-top:12px;">
        <div class="kpiHead">
          <span class="kpiIcon">📌</span>
          <span class="kpiLabel">Pendientes recientes</span>
        </div>
        ${top.length ? top.map(p=>`
          <div style="padding:10px 0; border-top:1px solid rgba(229,231,235,.6);">
            <div style="font-weight:800;">${p.alumno} · ${p.concept}</div>
            <div class="muted">${formatCLP(p.amount)}</div>
          </div>
        `).join("") : `<div class="muted" style="margin-top:10px;">Sin pendientes</div>`}
      </div>
    `;

    viewShell("Tesorero","Administración del curso", body, tab);
    return;
  }

  const body =
    tab==="payments"
      ? `${renderPaymentsList("tesorero")}`
      : `<div class="card"><div class="kpiLabel">Retiros</div><div class="muted">Tesorero: gestiona retiros (demo).</div></div>`;

  viewShell("Tesorero","Administración del curso", body, tab);
}

function renderPresidente(tab){
  if(tab === "home"){
    const sum = computeSummary("presidente");
    const pend = coursePending();

    const body = `
      ${kpiCard("⏳","Pendiente del curso", `${formatCLP(pend.amount)} · ${pend.count} pendientes`)}
      <button class="btn primary" style="width:100%; margin-top:10px;">Crear cobro</button>

      <div style="margin-top:12px;">
        ${kpiCard("💰","Recaudación del curso", formatCLP(sum.collected))}
      </div>

      <div class="card" style="margin-top:12px;">
        <div class="kpiHead">
          <span class="kpiIcon">🧭</span>
          <span class="kpiLabel">Acciones</span>
        </div>
        <button class="btn ghost" style="width:100%; margin-top:10px;" onclick="goTab('payments')">Ver pagos del curso</button>
        <button class="btn ghost" style="width:100%; margin-top:10px;" onclick="goTab('withdraws')">Gestionar retiros</button>
      </div>
    `;

    viewShell("Presidente","Administración del curso", body, tab);
    return;
  }

  const body =
    tab==="payments"
      ? `${renderPaymentsList("presidente")}`
      : `<div class="card"><div class="kpiLabel">Retiros</div><div class="muted">Presidente: cierra votación (demo).</div></div>`;

  viewShell("Presidente","Administración del curso", body, tab);
}

/* ---------- router ---------- */
function renderByRole(role, tab){
  if(role === "apoderado") renderApoderado(tab);
  else if(role === "tesorero") renderTesorero(tab);
  else if(role === "presidente") renderPresidente(tab);
  else renderApoderado(tab);
}
function goTab(tab){
  const user = getUser();
  if(!user) return logout();
  renderByRole(user.role, tab);
}

/* ---------- boot ---------- */
document.addEventListener("DOMContentLoaded", () => {
  const user = getUser();
  if(!user){
    window.location.href = "login.html";
    return;
  }
  ensureSeedPayments();
  const whoLine = document.getElementById("whoLine");
  if(whoLine) whoLine.textContent = `${user.name} · ${user.role}`;
  renderByRole(user.role, "home");
});
 
