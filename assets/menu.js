/* assets/menu.js
   Menú único por rol (apoderado / presidente / tesorero)
   - Compatible Safari iOS (sin template literals complejos)
   - Mantiene IDs legacy: goOnboarding, resetBtn, logoutBtn
*/

(function () {
  function qs(sel, root) { return (root || document).querySelector(sel); }

  function safeJsonParse(s) {
    try { return JSON.parse(s); } catch (e) { return null; }
  }

  function getRoleFromSession() {
    // 1) CURSAPP.getSession()
    try {
      if (window.CURSAPP && typeof window.CURSAPP.getSession === "function") {
        var s = window.CURSAPP.getSession();
        if (s && s.role) return String(s.role);
      }
    } catch (e) {}

    // 2) localStorage cursapp_session_v1
    try {
      var raw = localStorage.getItem("cursapp_session_v1");
      var sess = safeJsonParse(raw);
      if (sess && sess.role) return String(sess.role);
    } catch (e2) {}

    // 3) active_profile + profiles
    try {
      var activeId = localStorage.getItem("cursapp_active_profile_v1");
      var profilesRaw = localStorage.getItem("cursapp_profiles_v1");
      var profiles = safeJsonParse(profilesRaw);
      if (activeId && profiles && profiles[activeId] && profiles[activeId].role) {
        return String(profiles[activeId].role);
      }
    } catch (e3) {}

    // 4) fallback
    return "apoderado";
  }

  function normalizeRole(role) {
    role = (role || "").toLowerCase();
    if (role.indexOf("tesor") >= 0) return "tesorero";
    if (role.indexOf("pres") >= 0 || role.indexOf("direct") >= 0) return "presidente";
    return "apoderado";
  }

  function goTab(tab) {
    // Cambia tab bottomNav si existe en esta vista
    var btn = document.querySelector('.navItem[data-tab="' + tab + '"]');
    if (btn) btn.click();
  }

  function closeMenu() {
    var dd = qs("#menuDropdown");
    if (dd) dd.style.display = "none";
  }

  function ensureLegacyButtons(container) {
    // Estos IDs son usados por tus JS actuales (apoderado/presidente/tesorero)
    // Los dejamos invisibles pero presentes para no romper nada.
    var legacy = [
      { id: "goOnboarding", text: "Configurar curso", style: "display:none" },
      { id: "resetBtn", text: "Reset datos (demo)", style: "display:none" },
      { id: "logoutBtn", text: "Cerrar sesión", style: "display:none" }
    ];

    for (var i = 0; i < legacy.length; i++) {
      if (!qs("#" + legacy[i].id, container)) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "btn ghost";
        b.id = legacy[i].id;
        b.style.cssText = "width:100%;text-align:left;" + legacy[i].style;
        b.textContent = legacy[i].text;
        container.appendChild(b);
      }
    }
  }

  function btnHTML(label, onclickJs, icon) {
    // HTML simple, sin template literals complejos
    var ico = icon ? (icon + " ") : "";
    return (
      '<button class="btn ghost" type="button" style="width:100%;text-align:left;" onclick="' +
      onclickJs.replace(/"/g, "&quot;") +
      '">' +
      ico +
      label +
      "</button>"
    );
  }

  function dividerHTML() {
    return '<div style="height:1px;background:rgba(229,231,235,.9);margin:6px 0;"></div>';
  }

  function renderMenu(role) {
    var dd = qs("#menuDropdown");
    if (!dd) return;

    // Limpia y repinta
    dd.innerHTML = "";

    // Reglas por rol
    var parts = [];

    // ——— APODERADO ———
    if (role === "apoderado") {
      // Volver a directiva (solo si existe el switch)
      if (window.CURSAPP_SWITCH && typeof window.CURSAPP_SWITCH.toDirectiva === "function") {
        parts.push(btnHTML("Volver a directiva", "CURSAPP_SWITCH.toDirectiva();", "🧑‍💼"));
      }

      parts.push(btnHTML("Pagos", "goTab('payments'); closeMenu();", "💳"));
      parts.push(btnHTML("Informes", "goTab('informes'); closeMenu();", "📄"));
      parts.push(btnHTML("Ayuda", "if(window.openHelp){openHelp('general')} closeMenu();", "❓"));
      parts.push(btnHTML("Mi perfil", "alert('Mi perfil: próximamente'); closeMenu();", "👤"));

      parts.push(dividerHTML());

      // Reset total dev (mantener)
      parts.push(btnHTML("Reset total (dev)", "if(window.CURSAPP&&CURSAPP.hardReset){CURSAPP.hardReset()} closeMenu();", "🧨"));
      parts.push(btnHTML("Cerrar sesión", "var b=document.getElementById('logoutBtn'); if(b){b.click()} closeMenu();", "🚪"));
    }

    // ——— PRESIDENTE ———
    if (role === "presidente") {
      if (window.CURSAPP_SWITCH && typeof window.CURSAPP_SWITCH.toApoderado === "function") {
        parts.push(btnHTML("Volver a apoderado", "CURSAPP_SWITCH.toApoderado();", "👤"));
      }
      parts.push(btnHTML("Apoderados del curso", "location.href='/apoderados.html';", "👥"));
      parts.push(btnHTML("Campañas", "goTab('campanas'); closeMenu();", "📌"));
      parts.push(btnHTML("Deudores", "goTab('deudores'); closeMenu();", "🧾"));
      parts.push(btnHTML("Informes", "goTab('informes'); closeMenu();", "📄"));
      parts.push(btnHTML("Mi perfil", "alert('Mi perfil: próximamente'); closeMenu();", "👤"));
      parts.push(btnHTML("Ayuda", "if(window.openHelp){openHelp('general')} closeMenu();", "❓"));

      parts.push(dividerHTML());

      parts.push(btnHTML("Reset total (dev)", "if(window.CURSAPP&&CURSAPP.hardReset){CURSAPP.hardReset()} closeMenu();", "🧨"));
      parts.push(btnHTML("Cerrar sesión", "var b=document.getElementById('logoutBtn'); if(b){b.click()} closeMenu();", "🚪"));
    }

    // ——— TESORERO ———
    if (role === "tesorero") {
      if (window.CURSAPP_SWITCH && typeof window.CURSAPP_SWITCH.toApoderado === "function") {
        parts.push(btnHTML("Volver a apoderado", "CURSAPP_SWITCH.toApoderado();", "👤"));
      }
      parts.push(btnHTML("Rendiciones", "goTab('rendiciones'); closeMenu();", "🧾"));
      parts.push(btnHTML("Informes", "goTab('informes'); closeMenu();", "📊"));
      parts.push(btnHTML("Mi perfil", "alert('Mi perfil: próximamente'); closeMenu();", "👤"));
      parts.push(btnHTML("Ayuda", "if(window.openHelp){openHelp('general')} closeMenu();", "❓"));

      parts.push(dividerHTML());

      parts.push(btnHTML("Reset total (dev)", "if(window.CURSAPP&&CURSAPP.hardReset){CURSAPP.hardReset()} closeMenu();", "🧨"));
      parts.push(btnHTML("Cerrar sesión", "var b=document.getElementById('logoutBtn'); if(b){b.click()} closeMenu();", "🚪"));
    }

    dd.innerHTML = parts.join("");

    // Mantener compatibilidad con IDs antiguos
    ensureLegacyButtons(dd);

    // Asegurar que el click del menú funcione incluso si los otros scripts fallan
    var menuBtn = qs("#menuBtn");
    if (menuBtn && !menuBtn.__cursappMenuBound) {
      menuBtn.__cursappMenuBound = true;
      menuBtn.addEventListener("click", function () {
        dd.style.display = (dd.style.display === "none" || !dd.style.display) ? "block" : "none";
      });
      document.addEventListener("click", function (e) {
        if (!dd.contains(e.target) && e.target !== menuBtn) dd.style.display = "none";
      });
    }
  }

  function init() {
    var role = normalizeRole(getRoleFromSession());
    renderMenu(role);
  }

  // Exponer helpers usados en onclicks
  window.goTab = goTab;
  window.closeMenu = closeMenu;

  // Inicializar
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
