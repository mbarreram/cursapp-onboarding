/* ===========================
   Cursapp · core.js (Reset)
   - Reset demo (cursapp* + legado)
   - Reset total dev (borra TODO lo relacionado a Cursapp aunque tenga nombres antiguos)
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

  // ✅ Reset TOTAL DEV: elimina todo lo que huela a Cursapp, incluso claves antiguas
  function hardReset() {
    if (!confirm("🧨 Reset TOTAL (DEV): borrará TODO lo relacionado a Cursapp (incluye datos antiguos). ¿Continuar?")) return;

    const toDelete = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;

      const ks = k.toLowerCase();

      // reglas amplias: cursapp* o legacy o nombres antiguos comunes
      if (
        ks.startsWith("cursapp") ||
        LEGACY_KEYS.has(k) ||
        ks.includes("camp") ||       // campañas/campanas
        ks.includes("cobro") ||
        ks.includes("pago") ||
        ks.includes("recibo") ||
        ks.includes("receipt") ||
        ks.includes("tesor") ||
        ks.includes("presid") ||
        ks.includes("apoder") ||
        ks.includes("onb") ||
        ks.includes("curso") ||
        ks.includes("report") ||
        ks.includes("informe") ||
        ks.includes("expense") ||
        ks.includes("gasto") ||
        ks.includes("rendicion") ||
        ks.includes("task")
      ) {
        toDelete.push(k);
      }
    }

    // eliminar duplicados
    Array.from(new Set(toDelete)).forEach((k) => localStorage.removeItem(k));

    alert("✅ Reset TOTAL aplicado. Se recargará el sitio.");
    location.assign("/index.html");
  }

  window.CURSAPP = window.CURSAPP || {};
  window.CURSAPP.resetAll = resetAll;
  window.CURSAPP.hardReset = hardReset;
  window.CURSAPP.goLogin = goLogin;

  function wire() {
    const resetBtn = document.getElementById("resetMenuItem");
    if (resetBtn) resetBtn.onclick = resetAll;

    const backLogin = document.getElementById("backLogin");
    if (backLogin) backLogin.onclick = goLogin;

    // Atajo opcional: Ctrl/Cmd + Shift + R → hard reset (no refresh)
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
