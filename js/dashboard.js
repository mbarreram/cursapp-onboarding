document.addEventListener("DOMContentLoaded", () => {
  const user = window.CursappAuth.requireAuth();
  if (!user) return;

  renderTopbar(user);

  const root = document.getElementById("dashboard-root");
  if (!root) {
    document.body.insertAdjacentHTML(
      "beforeend",
      "<p style='padding:12px;color:#ef4444'>Error: #dashboard-root no existe.</p>"
    );
    return;
  }

  switch (user.role) {
    case "apoderado":
      root.innerHTML = renderApoderado();
      break;
    case "tesorero":
      root.innerHTML = renderTesorero();
      break;
    case "presidente":
      root.innerHTML = renderPresidente();
      break;
    default:
      root.innerHTML =
        "<div class='card'><h2>Rol no reconocido</h2><p class='muted'>No pudimos cargar tu perfil.</p></div>";
  }
});

function renderTopbar(user) {
  const topbar = document.getElementById("topbar");
  if (!topbar) return;

  const initial = (user.name || "C").trim().charAt(0).toUpperCase();
  const roleLabel = user.role.charAt(0).toUpperCase() + user.role.slice(1);

  topbar.innerHTML = `
    <div class="topbar">
      <div class="user-chip">
        <div class="avatar">${initial}</div>
        <div class="user-meta">
          <div class="name">${escapeHtml(user.name || "Usuario")}</div>
          <div class="role">${escapeHtml(roleLabel)}</div>
        </div>
      </div>
      <button id="logoutBtn" class="btn btn-danger" type="button">Cerrar sesión</button>
    </div>
  `;

  const btn = document.getElementById("logoutBtn");
  if (btn) {
    btn.addEventListener("click", () => {
      window.CursappAuth.clearUser();
      localStorage.removeItem("cursapp_demo_user"); // compatibilidad assets/app.js
      window.location.replace("login.html");
    });
  }
}

function renderApoderado() {
  return `
    <h1>Apoderado</h1>
    <div class="grid">
      <section class="card">
        <h2>Resumen</h2>
        <div class="kpi">
          <div class="pill">$ 25.000 <span class="muted" style="font-weight:600;">pendiente</span></div>
          <div class="pill">$ 40.000 <span class="muted" style="font-weight:600;">pagado</span></div>
          <div class="pill">2 <span class="muted" style="font-weight:600;">próximos cobros</span></div>
        </div>
        <p class="hint" style="margin-top:10px;">(Demo) Aquí van tus cuotas, comprobantes y notificaciones del curso.</p>
      </section>
      <aside class="card">
        <h2>Acciones rápidas</h2>
        <div class="row"><span>Pagar cuota</span><span class="tag">Pronto</span></div>
        <div class="row"><span>Ver comprobantes</span><span class="tag">Pronto</span></div>
        <div class="row"><span>Mensajes del curso</span><span class="tag">Pronto</span></div>
      </aside>
    </div>
  `;
}

function renderTesorero() {
  return `
    <h1>Tesorero</h1>
    <div class="grid">
      <section class="card">
        <h2>Recaudación</h2>
        <div class="kpi">
          <div class="pill">$ 240.000 <span class="muted" style="font-weight:600;">mes</span></div>
          <div class="pill">18 <span class="muted" style="font-weight:600;">pagos</span></div>
          <div class="pill">3 <span class="muted" style="font-weight:600;">pendientes</span></div>
        </div>
        <p class="hint" style="margin-top:10px;">(Demo) Aquí iría el detalle de pagos y conciliación.</p>
      </section>
      <aside class="card">
        <h2>Acciones</h2>
        <div class="row"><span>Crear cobro</span><span class="tag">Pronto</span></div>
        <div class="row"><span>Exportar</span><span class="tag">Pronto</span></div>
        <div class="row"><span>Solicitudes de retiro</span><span class="tag">Pronto</span></div>
      </aside>
    </div>
  `;
}

function renderPresidente() {
  return `
    <h1>Presidente</h1>
    <div class="grid">
      <section class="card">
        <h2>Gestión del curso</h2>
        <ul class="list">
          <li>Crear / editar cobros</li>
          <li>Gestionar roles (presidente, tesorero, apoderado)</li>
          <li>Configuración de cuenta bancaria</li>
        </ul>
        <p class="hint" style="margin-top:10px;">(Demo) Este panel corresponde al presidente del curso (no a un admin de plataforma).</p>
      </section>
      <aside class="card">
        <h2>Estado</h2>
        <div class="row"><span>Usuarios</span><strong>26</strong></div>
        <div class="row"><span>Roles activos</span><strong>3</strong></div>
        <div class="row"><span>Alertas</span><strong>0</strong></div>
      </aside>
    </div>
  `;
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
