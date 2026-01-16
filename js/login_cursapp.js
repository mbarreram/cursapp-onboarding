document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loginForm");
  const errorEl = document.getElementById("loginError");
  const usernameEl = document.getElementById("username");
  const passwordEl = document.getElementById("password");

  // Si ya está logueado, redirige según rol
  const existing = window.CursappAuth.getUser();
  if (existing && existing.role) {
    redirectByRole(existing.role);
    return;
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const username = (usernameEl.value || "").trim();
    const role = window.CursappAuth.normalizeRole(username);

    const allowed = ["apoderado", "tesorero", "presidente"];
    if (!allowed.includes(role)) {
      errorEl.textContent = "Usuario inválido. Usa: apoderado, tesorero o presidente.";
      errorEl.style.display = "block";
      return;
    }

    const user = {
      name: role.charAt(0).toUpperCase() + role.slice(1) + " (Demo)",
      role,
      lastLogin: new Date().toISOString()
    };

    // Auth nuevo
    window.CursappAuth.setUser(user);

    // Compatibilidad dashboards v3
    localStorage.setItem("cursapp_demo_user", JSON.stringify({
      name: user.name,
      role: user.role
    }));

    redirectByRole(role);
  });

  function redirectByRole(role) {
    if (role === "presidente") {
      window.location.replace("dashboard-presidente-v3.html");
    } else if (role === "tesorero") {
      window.location.replace("dashboard-tesorero-v3.html");
    } else {
      window.location.replace("dashboard-apoderado-v3.html");
    }
  }
});
