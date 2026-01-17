/* ========= BOOT ========= */
document.addEventListener("DOMContentLoaded", () => {
  const user = JSON.parse(localStorage.getItem("cursapp_demo_user"));
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  // Tema visual por rol (si lo usas en CSS)
  document.body.classList.add(`role-${user.role}`);

  const who = document.getElementById("whoLine");
  if (who) who.textContent = `${user.name} · ${user.role}`;

  // Logout robusto
  window.logout = () => {
    localStorage.removeItem("cursapp_demo_user");
    window.location.href = "login.html";
  };

  renderByRole(user.role, "home");
});

/* ========= ROUTER ========= */
function renderByRole(role, tab) {
  if (role === "apoderado") renderApoderado(tab);
  else if (role === "tesorero") renderTesorero(tab);
  else if (role === "presidente") renderPresidente(tab);
  else renderApoderado(tab);
}

function goTab(tab) {
  const user = JSON.parse(localStorage.getItem("cursapp_demo_user") || "{}");
  renderByRole(user.role || "apoderado", tab);
}

/* ========= VISTAS ========= */

function renderApoderado(tab) {
  const content =
    tab === "home"
      ? `${kpiCards(20000, 50000, 2)}${chart(20000, 50000)}`
      : tab === "payments"
      ? `<div class="card"><div class="kpiLabel">Pagos</div><div class="muted">Aquí irá la vista de pagos del apoderado (pasarela + comprobante).</div></div>`
      : `<div class="card"><div class="kpiLabel">Retiros</div><div class="muted">Apoderado: solo votación/lectura (demo).</div></div>`;

  document.getElementById("app").innerHTML = `
    <h1>Apoderado</h1>
    <p class="muted">2°B 2026 · Colegio X</p>
    ${content}
    ${tabbar(tab)}
  `;
}

function renderTesorero(tab) {
  const content =
    tab === "home"
      ? `${kpiCards(20000, 56110, 5)}${chart(20000, 56110)}`
      : tab === "payments"
      ? `<div class="card"><div class="kpiLabel">Pagos</div><div class="muted">Tesorero: conciliación manual / reportes (demo).</div></div>`
      : `<div class="card"><div class="kpiLabel">Retiros</div><div class="muted">Tesorero: gestiona retiros (demo).</div></div>`;

  document.getElementById("app").innerHTML = `
    <h1>Tesorero</h1>
    <p class="muted">Administración del curso</p>
    ${content}
    ${tabbar(tab)}
  `;
}

function renderPresidente(tab) {
  const content =
    tab === "home"
      ? `${kpiCards(20000, 56110, 5)}${chart(20000, 56110)}
         <button class="btn primary" style="width:100%;margin-top:12px;">Crear cobro</button>`
      : tab === "payments"
      ? `<div class="card"><div class="kpiLabel">Pagos</div><div class="muted">Presidente: crea cobros / ve estado (demo).</div></div>`
      : `<div class="card"><div class="kpiLabel">Retiros</div><div class="muted">Presidente: cierra votación (demo).</div></div>`;

  document.getElementById("app").innerHTML = `
    <h1>Presidente</h1>
    <p class="muted">Administración del curso</p>
    ${content}
    ${tabbar(tab)}
  `;
}

/* ========= COMPONENTES ========= */

function tabbar(active) {
  return `
    <nav class="tabbar">
      <button class="tab ${active === "home" ? "active" : ""}" onclick="goTab('home')">
        <span class="ico">🏠</span><span>Inicio</span>
      </button>
      <button class="tab ${active === "payments" ? "active" : ""}" onclick="goTab('payments')">
        <span class="ico">💳</span><span>Pagos</span>
      </button>
      <button class="tab ${active === "withdrawals" ? "active" : ""}" onclick="goTab('withdrawals')">
        <span class="ico">🏦</span><span>Retiros</span>
      </button>
    </nav>
  `;
}

function kpiCards(collected, pending, alumnos) {
  return `
    <div class="grid3">
      <div class="card">
        <div class="kpiLabel">Total recaudado</div>
        <div class="kpi">$${formatCLP(collected)}</div>
      </div>
      <div class="card">
        <div class="kpiLabel">Total pendiente</div>
        <div class="kpi">$${formatCLP(pending)}</div>
      </div>
      <div class="card">
        <div class="kpiLabel">Alumnos</div>
        <div class="kpi">${alumnos}</div>
      </div>
    </div>
  `;
}

function chart(collected, pending) {
  const max = Math.max(collected, pending, 1);
  const cw = Math.max(10, Math.round((collected / max) * 260));
  const pw = Math.max(10, Math.round((pending / max) * 260));

  return `
    <div class="card" style="margin-top:12px;">
      <div class="kpiLabel">Cobrado vs Pendiente</div>

      <div style="margin-top:10px;">
        <div class="muted">Cobrado $${formatCLP(collected)}</div>
        <div class="bar"><div class="barFill primary" style="width:${cw}px"></div></div>
      </div>

      <div style="margin-top:10px;">
        <div class="muted">Pendiente $${formatCLP(pending)}</div>
        <div class="bar"><div class="barFill gray" style="width:${pw}px"></div></div>
      </div>
    </div>
  `;
}

/* ========= UTILS ========= */
function formatCLP(n) {
  return Number(n || 0).toLocaleString("es-CL");
}
