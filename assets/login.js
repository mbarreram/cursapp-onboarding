alert("login.js cargado");

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loginForm");
  const errorEl = document.getElementById("loginError");

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const username = document.getElementById("username").value.trim().toLowerCase();

    const allowed = ["apoderado", "tesorero", "presidente"];
    if (!allowed.includes(username)) {
      errorEl.textContent = "Usuario inválido. Usa: apoderado, tesorero o presidente.";
      errorEl.style.display = "block";
      return;
    }

    const user = {
      name: username[0].toUpperCase() + username.slice(1) + " (Demo)",
      role: username
    };

    localStorage.setItem("cursapp_demo_user", JSON.stringify(user));

    // redirect seguro
    window.location.assign("/dashboard/");
  });
});
