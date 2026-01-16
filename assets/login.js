document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loginForm");
  const errorEl = document.getElementById("loginError");

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const username = (document.getElementById("username").value || "").trim().toLowerCase();
    const password = (document.getElementById("password").value || "").trim();

    const allowed = ["apoderado", "tesorero", "presidente"];

    if (!allowed.includes(username)) {
      errorEl.textContent = "Usuario inválido. Usa: apoderado, tesorero o presidente.";
      errorEl.style.display = "block";
      return;
    }

    // Guarda el usuario/rol correcto (clave para que app.js respete el rol)
    const user = {
      name: username.charAt(0).toUpperCase() + username.slice(1) + " (Demo)",
      role: username
    };

    localStorage.setItem("cursapp_demo_user", JSON.stringify(user));

    // Redirección por rol (dashboards v3)
    // Redirección única (dashboard central)
window.location.href = "dashboard.html";
  });
});
