/* ===========================
   Cursapp · core.js (Reset demo)
   - Reset total (cursapp* + legado)
   - Funciona sin tocar app.js
   - Expone window.CURSAPP.resetAll()
   =========================== */

(function () {
  const LEGACY_KEYS = new Set(["campanas", "cobros", "pagos", "usuarios", "dashboardData"]);

  function goLogin() {
    location.assign("/index.html");
  }

  function resetAll() {
    if (!confirm("⚠️ Reset demo: esto eliminará TODOS los datos de Cursapp en este navegador. ¿Continuar?")) return;

    const toDelete = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (k.startsWith("cursapp") || LEGACY_KEYS.has(k)) toDelete.push(k);
    }
    toDelete.forEach((k) => localStorage.removeItem(k));

    alert("✅ Demo reseteada. Volviendo al login.");
    goLogin();
  }

  // expone API global
  window.CURSAPP = window.CURSAPP || {};
  window.CURSAPP.resetAll = resetAll;
  window.CURSAPP.goLogin = goLogin;

  // conecta botones si existen
  function wire() {
    const resetBtn = document.getElementById("resetMenuItem");
    if (resetBtn) resetBtn.onclick = resetAll;

    const backLogin = document.getElementById("backLogin");
    if (backLogin) backLogin.onclick = goLogin;

    // Atajo opcional: Ctrl/Cmd + Shift + R (no es el refresh del navegador)
    document.addEventListener("keydown", (e) => {
      const isCmd = e.metaKey && e.shiftKey && (e.key === "R" || e.key === "r");
      const isCtrl = e.ctrlKey && e.shiftKey && (e.key === "R" || e.key === "r");
      if (isCmd || isCtrl) {
        e.preventDefault();
        resetAll();
      }
    });
  }

  document.addEventListener("DOMContentLoaded", wire);
})();
