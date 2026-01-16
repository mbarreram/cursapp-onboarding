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

  renderByRole(user.role);
});

/* ========= ROUTER ========= */
function renderByRole(role) {
  if (role === "apoderado") renderApoderado();
  else if (role === "tesorero") renderTesorero();
  else if (role === "presidente") renderPresidente();
  else renderApoderado();
}

/* ========= VISTAS ========= */

function renderApoderado() {
  document.getElementById("app").innerHTML = `
    <h1>Apoderado</h1>
    <p class="muted">2°B 2026 · Colegio X</p>

    ${kpiCards(20000, 50000, 2)}
    ${chart(20000, 50000)}

    <button class="btn primary">Ir a pagos</button>
  `;
}

function renderTesorero() {
  document.getElementById("app").innerHTML = `
    <h1>Tesorero</h1>
    <p class="muted">Resumen financiero del curso</p>

    ${kpiCards(20000, 56110, 5)}
    ${chart(20000, 56110)}

    <button class="btn primary">Conciliar pagos</button>
    <button class="btn ghost">Ver retiros</button>
  `;
}

function renderPresidente() {
  document.getElementById("app").innerHTML = `
    <h1>Presidente</h1>
    <p class="muted">Administración del curso</p>

    ${kpiCards(20000, 56110, 5)}
    ${chart(20000, 56110)}

    <button class="btn primary">Crear cobro</button>
    <button class="btn ghost">Gestionar retiros</button>
  `;
}

/* ========= COMPONENTES ========= */

function kpiCards(collected, pending, alumnos) {
  return `
    <div class="grid3">
      <div class="card"><div class="kpiLabel">Total recaudado</div><div class="kpi">$${formatCLP(collected)}</div></div>
      <div class="card"><div class="kpiLabel">Total pendiente</div><div class="kpi">$${formatCLP(pending)}</div></div>
      <div class="card"><div class="kpiLabel">Alumnos</div><div class="kpi">${alumnos}</div></div>
    </div>
  `;
}

function chart(collected, pending) {
  const max = Math.max(collected, pending, 1);
  return `
    <div class="card">
      <div class="kpiLabel">Cobrado vs Pendiente</div>

      <div class="bar">
        <div class="barFill primary" style="width:${(collected/max)*100}%"></div>
      </div>
      <small>Cobrado $${formatCLP(collected)}</small>

      <div class="bar">
        <div class="barFill gray" style="width:${(pending/max)*100}%"></div>
      </div>
      <small>Pendiente $${formatCLP(pending)}</small>
    </div>
  `;
}

/* ========= UTILS ========= */

function formatCLP(n) {
  return n.toLocaleString("es-CL");
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
