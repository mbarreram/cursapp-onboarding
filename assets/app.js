/* ========= Cursapp · app.js (CANÓNICO) ========= */

function formatCLP(v){
  return '$' + Number(v||0).toLocaleString('es-CL');
}

function getUser(){
  return JSON.parse(localStorage.getItem("cursapp_demo_user") || "null");
}

function logout(){
  localStorage.removeItem("cursapp_demo_user");
  window.location.href = "login.html";
}

document.addEventListener("DOMContentLoaded", () => {

  document.body.classList.add(`role-${user.role}`);
  const user = getUser();
  if(!user){
    window.location.href = "login.html";
    return;
  }

  document.getElementById("whoLine").textContent =
    `${user.name} · ${user.role}`;

  // Render inicial
  renderByRole(user.role, "home");
});

function renderByRole(role, tab){
  if(role === "apoderado") renderApoderado(tab);
  else if(role === "tesorero") renderTesorero(tab);
  else if(role === "presidente") renderPresidente(tab);
  else renderApoderado(tab);
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
      <button class="tab ${active==="withdrawals"?"active":""}" onclick="goTab('withdrawals')">
        <span class="ico">🏦</span><span>Retiros</span>
      </button>
    </nav>
  `;
}

function goTab(tab){
  const role = (getUser()?.role || "apoderado");
  renderByRole(role, tab);
}

/* ====== VISTAS POR ROL ====== */

function renderApoderado(tab){
  const collected = 20000, pending = 50000, alumnos = 2;

  const content = tab==="home"
    ? `${kpiCards(collected,pending,alumnos)}${chart(collected,pending)}`
    : tab==="payments"
      ? `<div class="card"><div class="kpiLabel">Pagos</div><div class="muted">Aquí irá el pago por alumno (apoderado).</div></div>`
      : `<div class="card"><div class="kpiLabel">Retiros</div><div class="muted">Apoderado: solo vota / lectura (demo).</div></div>`;

  document.getElementById("app").innerHTML = `
    <h1>Apoderado</h1>
    <p class="muted">2°B 2026 · Colegio X</p>
    ${content}
    ${tabbar(tab)}
  `;
}

function renderTesorero(tab){
  const collected = 20000, pending = 56110, alumnos = 5;

  const content = tab==="home"
    ? `${kpiCards(collected,pending,alumnos)}${chart(collected,pending)}`
    : tab==="payments"
      ? `<div class="card"><div class="kpiLabel">Pagos</div><div class="muted">Tesorero: conciliación manual (demo).</div></div>`
      : `<div class="card"><div class="kpiLabel">Retiros</div><div class="muted">Tesorero: gestiona retiros (demo).</div></div>`;

  document.getElementById("app").innerHTML = `
    <h1>Tesorero</h1>
    <p class="muted">Administración del curso</p>
    ${content}
    ${tabbar(tab)}
  `;
}

function renderPresidente(tab){
  const collected = 20000, pending = 56110, alumnos = 5;

  const content = tab==="home"
    ? `${kpiCards(collected,pending,alumnos)}${chart(collected,pending)}
       <button class="btn primary" style="width:100%;margin-top:12px;">Crear cobro</button>`
    : tab==="payments"
      ? `<div class="card"><div class="kpiLabel">Pagos</div><div class="muted">Presidente: crea cobros / ve estado (demo).</div></div>`
      : `<div class="card"><div class="kpiLabel">Retiros</div><div class="muted">Presidente: cierra votación (demo).</div></div>`;

  document.getElementById("app").innerHTML = `
    <h1>Presidente</h1>
    <p class="muted">Administración del curso</p>
    ${content}
    ${tabbar(tab)}
  `;
}

/* ====== COMPONENTES ====== */

function kpiCards(collected, pending, alumnos){
  return `
    <div class="grid3">
      <div class="card"><div class="kpiLabel">Total recaudado</div><div class="kpi">${formatCLP(collected)}</div></div>
      <div class="card"><div class="kpiLabel">Total pendiente</div><div class="kpi">${formatCLP(pending)}</div></div>
      <div class="card"><div class="kpiLabel">Alumnos</div><div class="kpi">${alumnos}</div></div>
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
