
// PERFIL.JS - SAFARI SAFE VERSION

(function () {
  function esc(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getSession() {
    try {
      var raw = localStorage.getItem("cursapp_session") ||
                localStorage.getItem("cursapp_session_v1");
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function render() {
    var root = document.getElementById("perfil-root");
    if (!root) return;

    var session = getSession();
    if (!session || !session.user) {
      root.innerHTML = "<p style='padding:20px'>No hay sesión activa.</p>";
      return;
    }

    var user = session.user;
    var course = session.course || {};

    root.innerHTML = ""
      + "<div style='padding:20px'>"
      + "<h2>" + esc(user.name || "Sin nombre") + "</h2>"
      + "<p>" + esc(user.email || "") + "</p>"
      + "<hr/>"
      + "<p><strong>Curso:</strong> " + esc(course.name || "-") + "</p>"
      + "<p><strong>Rol:</strong> " + esc(session.currentRole || "-") + "</p>"
      + "</div>";
  }

  document.addEventListener("DOMContentLoaded", function () {
    try {
      render();
    } catch (e) {
      alert("ERROR PERFIL: " + e.message);
    }
  });
})();
