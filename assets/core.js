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

  // ------------------------------------------------------------
  // Cross-page navigation helper (Perfil -> dashboards)
  // Guardamos un "siguiente tab" por unos segundos para que la
  // página destino abra la sección correcta.
  const NAV_TAB_KEY = "cursapp_nav_tab_v1";
  const NAV_AT_KEY = "cursapp_nav_at_v1";
  const NAV_TTL_MS = 15000;

  function setNextNavTab(tab) {
    try {
      if (!tab) return;
      localStorage.setItem(NAV_TAB_KEY, String(tab));
      localStorage.setItem(NAV_AT_KEY, String(Date.now()));
    } catch (e) {}
  }

  function consumeNextNavTab() {
    try {
      const tab = localStorage.getItem(NAV_TAB_KEY);
      const at = Number(localStorage.getItem(NAV_AT_KEY) || 0);
      // one-shot
      localStorage.removeItem(NAV_TAB_KEY);
      localStorage.removeItem(NAV_AT_KEY);
      if (!tab) return null;
      if (!at || Date.now() - at > NAV_TTL_MS) return null;
      return String(tab);
    } catch (e) {
      return null;
    }
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
  window.CURSAPP.setNextNavTab = setNextNavTab;
  window.CURSAPP.consumeNextNavTab = consumeNextNavTab;

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
