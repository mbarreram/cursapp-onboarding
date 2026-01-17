/* ========= Cursapp · app.js (ESTABLE + KPI FORMAL + ÍCONOS) ========= */

function formatCLP(v){
  return '$' + Number(v||0).toLocaleString('es-CL');
}
function capitalize(s){
  return (s||'').charAt(0).toUpperCase() + (s||'').slice(1);
}
function getUser(){
  return JSON.parse(localStorage.getItem("cursapp_demo_user") || "null");
}
function logout(){
  localStorage.removeItem("cursapp_demo_user");
  window.location.href = "login.html";
}

document.addEventListener("DOMContentLoaded", () => {
  const user = getUser();
  if(!user){
    window.location.href = "login.html";
    return;
  }

  const whoLine = document.getElementById("whoLine");
  if(whoLine){
    whoLine.textContent = `${user.name} · ${user.role}`;
  }

  renderByRole(user.role, "home");
});

function renderByRole(role, tab){
  if(role === "apoderado") renderApoderado(tab);
  else if(role === "tesorero") renderTesorero(tab);
  else if(role === "presidente") renderPresidente(tab);
  else renderApoderado(tab);
}

function goTab(tab){
  const role = (getUser()?.role || "apoderado");
  renderByRole(role, tab);
}

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

/* ===== KPI Cards (FORMAL + ÍCONOS) ===== */
function kpiCards(collected, pending, alumnos){
  return `
    <div class="grid3">
      ${kpiCard("💰", "Total recaudado", formatCLP(collected))}
      ${kpiCard("⏳", "Total pendiente", formatCLP(pending))}
      ${kpiCard("👥", "Alumnos", String(alumnos))}
    </div>
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

/* ===== Chart ===== */
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

function renderApoderado(tab){
  const body =
    tab==="home"
      ? `${kpiCards(20000, 50000, 2)}${chart(20000, 50000)}`
      : tab==="payments"
        ? `<div class="card"><div class="kpiLabel">Pagos</div><div class="muted">Aquí irá el flujo de pago apoderado.</div></div>`
        : `<div class="card"><div class="kpiLabel">Retiros</div><div class="muted">Apoderado: lectura/votación (demo).</div></div>`;

  viewShell("Apoderado","2°B 2026 · Colegio X", body, tab);
}

function renderTesorero(tab){
  const body =
    tab==="home"
      ? `${kpiCards(20000, 56110, 5)}${chart(20000, 56110)}`
      : tab==="payments"
        ? `<div class="card"><div class="kpiLabel">Pagos</div><div class="muted">Tesorero: conciliación manual (demo).</div></div>`
        : `<div class="card"><div class="kpiLabel">Retiros</div><div class="muted">Gestión retiros (demo).</div></div>`;

  viewShell("Tesorero","Administración del curso", body, tab);
}

function renderPresidente(tab){
  const body =
    tab==="home"
      ? `${kpiCards(20000, 56110, 5)}${chart(20000, 56110)}
         <button class="btn primary" style="width:100%;margin-top:12px;">Crear cobro</button>`
      : tab==="payments"
        ? `<div class="card"><div class="kpiLabel">Pagos</div><div class="muted">Presidente: crea cobros (demo).</div></div>`
        : `<div class="card"><div class="kpiLabel">Retiros</div><div class="muted">Presidente: cierra votación (demo).</div></div>`;

  viewShell("Presidente","Administración del curso", body, tab);
}
