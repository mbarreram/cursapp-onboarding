/* ===========================
   Cursapp · core.js (Reset)
   - resetAll(): borra llaves de Cursapp + legacy
   - hardReset(): BORRA TODO localStorage del sitio (DEV) => no más datos fantasma
   - Expone window.CURSAPP.resetAll() y window.CURSAPP.hardReset()
   =========================== */

(function () {
  const LEGACY_KEYS = new Set(["campanas", "cobros", "pagos", "usuarios", "dashboardData"]);

  function goLogin() {
    location.assign("/index.html");
  }

  function resetAll() {
    if (!confirm("⚠️ Reset demo: eliminará los datos de Cursapp en este navegador. ¿Continuar?")) return;

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

  // ✅ Reset TOTAL DEV: borra TODO el storage del sitio (la forma más robusta)
  function hardReset() {
    if (!confirm("🧨 Reset TOTAL (DEV): borrará TODO el almacenamiento local de este sitio. ¿Continuar?")) return;

    localStorage.clear();

    alert("✅ Reset TOTAL aplicado. Volviendo al login.");
    goLogin();
  }

  window.CURSAPP = window.CURSAPP || {};
  window.CURSAPP.resetAll = resetAll;
  window.CURSAPP.hardReset = hardReset;
  window.CURSAPP.goLogin = goLogin;

  function wire() {
    // si existe botón Reset demo
    const resetBtn = document.getElementById("resetMenuItem");
    if (resetBtn) resetBtn.onclick = resetAll;

    // si existe botón Reset total (dev)
    const hardBtn = document.getElementById("hardResetMenuItem");
    if (hardBtn) hardBtn.onclick = hardReset;

    // volver al login (onboarding)
    const backLogin = document.getElementById("backLogin");
    if (backLogin) backLogin.onclick = goLogin;

    // Atajo opcional: Ctrl/Cmd + Shift + R → hard reset
    document.addEventListener("keydown", (e) => {
      const isCmd = e.metaKey && e.shiftKey && (e.key === "R" || e.key === "r");
      const isCtrl = e.ctrlKey && e.shiftKey && (e.key === "R" || e.key === "r");
      if (isCmd || isCtrl) {
        e.preventDefault();
        hardReset();
      }
    });
  }

  document.addEventListener("DOMContentLoaded", wire);
})();
