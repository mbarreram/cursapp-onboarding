/* ========= BOOT ========= */
document.addEventListener("DOMContentLoaded", () => {
  const user = JSON.parse(localStorage.getItem("cursapp_demo_user"));
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  document.getElementById("whoLine").textContent =
    `${capitalize(user.role)} (Demo) · ${user.role}`;

  document.getElementById("logoutBtn").onclick = () => {
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
  const user = JSON.parse(localStorage.getItem("cursapp_demo_user"));
  renderByRole(user.role, tab);
}

/* ========= VISTAS ========= */

function renderApoderado(tab) {
  document.getElementById("app").innerHTML = `
    <h1>Apoderado</h1>
    <p class="muted">2°B 2026 · Colegio X</p>

    ${kpiCards(20000, 50000, 2)}
    ${chart(20000, 50000)}

    ${tabbar(tab)}
  `;
}

function renderTesorero(tab) {
  document.getElementById("app").innerHTML = `
    <h1>Tesorero</h1>
    <p class="muted">Administración del curso</p>

    ${kpiCards(20000, 56110, 5)}
    ${chart(20000, 56110)}

    ${tabbar(tab)}
  `;
}

function renderPresidente(tab) {
  document.getElementById("app").innerHTML = `
    <h1>Presidente</h1>
    <p class="muted">Administración del curso</p>

    ${kpiCards(20000, 56110, 5)}
    ${chart(20000, 56110)}

    <button class="btn primary full">Crear cobro</button>

    ${tabbar(tab)}
  `;
}

/* ========= COMPONENTES ========= */

function kpiCards(collected, pending, alumnos) {
  return `
    <div class="grid3">
      ${kpiCard("💰", "Total recaudado", formatCLP(collected))}
      ${kpiCard("⏳", "Total pendiente", formatCLP(pending))}
      ${kpiCard("👥", "Alumnos", alumnos)}
    </div>
  `;
}

function kpiCard(icon, label, value) {
  return `
    <div class="card kpiCard">
      <div class="kpiHead">
        <span class="kpiIcon">${icon}</span>
        <span class="kpiLabel">${label}</span>
      </div>
      <div class="kpiValue">${value}</div>
    </div>
  `;
}

function chart(collected, pending) {
  const max = Math.max(collected, pending, 1);
  return `
    <div class="card">
      <div class="kpiLabel">Cobrado vs Pendiente</div>

      <div class="bar">
        <div class="barFill primary" style="width:${(collected / max) * 100}%"></div>
      </div>
      <small>Cobrado $${formatCLP(collected)}</small>

      <div class="bar">
        <div class="barFill gray" style="width:${(pending / max) * 100}%"></div>
      </div>
      <small>Pendiente $${formatCLP(pending)}</small>
    </div>
  `;
}

function tabbar(active) {
  return `
    <nav class="tabbar">
      <button class="tab ${active === "home" ? "active" : ""}" onclick="goTab('home')">
        <span class="ico">🏠</span><span>Inicio</span>
      </button>
      <button class="tab ${active === "payments" ? "active" : ""}" onclick="goTab('payments')">
        <span class="ico">💳</span><span>Pagos</span>
      </button>
      <button class="tab ${active === "withdraws" ? "active" : ""}" onclick="goTab('withdraws')">
        <span class="ico">🏦</span><span>Retiros</span>
      </button>
    </nav>
  `;
}

/* ========= UTILS ========= */

function formatCLP(n) {
  return n.toLocaleString("es-CL");
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
