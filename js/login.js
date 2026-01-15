document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loginForm");
  const errorEl = document.getElementById("loginError");
  const usernameEl = document.getElementById("username");
  const passwordEl = document.getElementById("password");

  // Si ya está logueado, salta directo
  const existing = window.CursappAuth.getUser();
  if (existing && existing.role) {
    window.location.replace("dashboard.html");
    return;
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const username = (usernameEl.value || "").trim();
    const password = (passwordEl.value || "").trim();
    const role = window.CursappAuth.normalizeRole(username);

    const allowed = ["apoderado", "tesorero", "admin"];

    if (!allowed.includes(role)) {
      errorEl.textContent = "Usuario inválido. Usa: apoderado, tesorero o admin.";
      errorEl.style.display = "block";
      return;
    }

    // Demo user
    const user = {
      name: role.charAt(0).toUpperCase() + role.slice(1) + " (Demo)",
      role,
      lastLogin: new Date().toISOString()
    };

    window.CursappAuth.setUser(user);
    window.location.replace("dashboard.html");
  });
});
