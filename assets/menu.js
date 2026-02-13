/* assets/menu.js
   Menú único por rol (apoderado / presidente / tesorero)
   FIXES:
   - Ayuda funciona aunque openHelp no exista (modal simple fallback)
   - Logout funciona siempre (limpia storage + redirige)
   - Volver a apoderado/directiva funciona sin depender de email (setea perfil activo + redirige)
   - Toggle robusto en iOS (touchstart + click)
*/

(function () {
  function qs(sel, root) { return (root || document).querySelector(sel); }
  function safeJsonParse(s) { try { return JSON.parse(s); } catch (e) { return null; } }

  // -------- Debug helpers (enable with ?debugMenu=1) --------
  var __qs = null;
  try { __qs = new URLSearchParams(location.search || ""); } catch (_) {}
  var DEBUG_MENU = !!(__qs && (__qs.get("debugMenu") === "1" || __qs.get("debugMenu") === "true"));
  function debugMenuAlert(msg) {
    try {
      if (DEBUG_MENU) alert(String(msg));
    } catch (_) {}
  }

  // -------- Session / profiles helpers --------
  function getSession() {
    try {
      if (window.CURSAPP && typeof window.CURSAPP.getSession === "function") {
        var s = window.CURSAPP.getSession();
        if (s) return s;
      }
    } catch (_) {}

    var raw = null;
    try { raw = localStorage.getItem("cursapp_session_v1"); } catch (_) {}
    var sess = safeJsonParse(raw);
    return sess || {};
  }

  function getRoleFromSession() {
    var s = getSession();
    if (s && s.role) return String(s.role);
    // fallback: active profile
    try {
      var activeId = localStorage.getItem("cursapp_active_profile_v1");
      var profilesRaw = localStorage.getItem("cursapp_profiles_v1");
      var profiles = safeJsonParse(profilesRaw);

      if (activeId && profiles) {
        // profiles puede ser objeto o array
        if (profiles[activeId] && profiles[activeId].role) return String(profiles[activeId].role);
        if (Array.isArray(profiles)) {
          for (var i = 0; i < profiles.length; i++) {
            if (profiles[i] && String(profiles[i].id) === String(activeId) && profiles[i].role) {
              return String(profiles[i].role);
            }
          }
        }
      }
    } catch (_) {}
    return "apoderado";
  }

  function normalizeRole(role) {
    role = (role || "").toLowerCase();
    if (role.indexOf("tesor") >= 0) return "tesorero";
    if (role.indexOf("pres") >= 0 || role.indexOf("direct") >= 0) return "presidente";
    return "apoderado";
  }

  function findProfileIdByRole(targetRole) {
    targetRole = (targetRole || "").toLowerCase();
    try {
      var profilesRaw = localStorage.getItem("cursapp_profiles_v1");
      var profiles = safeJsonParse(profilesRaw);

      if (!profiles) return null;

      // Caso 1: objeto tipo {id: {...}}
      if (!Array.isArray(profiles)) {
        for (var k in profiles) {
          if (!Object.prototype.hasOwnProperty.call(profiles, k)) continue;
          var p = profiles[k];
          var r = (p && p.role) ? String(p.role).toLowerCase() : "";
          if (r.indexOf(targetRole) >= 0) return k;
        }
      }

      // Caso 2: array
      if (Array.isArray(profiles)) {
        for (var i = 0; i < profiles.length; i++) {
          var pp = profiles[i];
          var rr = (pp && pp.role) ? String(pp.role).toLowerCase() : "";
          if (rr.indexOf(targetRole) >= 0) return pp.id != null ? String(pp.id) : null;
        }
      }
    } catch (_) {}
    return null;
  }

  function switchToRole(targetRole) {
    // 1) Preferir setear perfil activo (no depende de email)
    var id = findProfileIdByRole(targetRole);
    if (id) {
      try { localStorage.setItem("cursapp_active_profile_v1", String(id)); } catch (_) {}
    }

    // 2) Ajustar role en sesión si existe
    try {
      var raw = localStorage.getItem("cursapp_session_v1");
      var sess = safeJsonParse(raw) || {};
      sess.role = targetRole;
      localStorage.setItem("cursapp_session_v1", JSON.stringify(sess));
    } catch (_) {}

    // 3) Redirigir a vista correspondiente
    if (targetRole === "apoderado") location.href = "/apoderado.html";
    else if (targetRole === "presidente") location.href = "/presidente.html";
    else if (targetRole === "tesorero") location.href = "/tesorero.html";
  }

  function hasFn(path) {
    try {
      var parts = path.split(".");
      var obj = window;
      for (var i = 0; i < parts.length; i++) {
        obj = obj[parts[i]];
        if (obj == null) return false;
      }
      return typeof obj === "function";
    } catch (_) { return false; }
  }

  // -------- Navigation helpers --------
  function goTab(tab) {
    var btn = document.querySelector('.navItem[data-tab="' + tab + '"]');
    if (btn) btn.click();
  }
  function closeMenu() {
    var dd = qs("#menuDropdown");
    if (dd) dd.style.display = "none";
  }

  // -------- Help fallback (works everywhere) --------
  function openHelpFallback() {
    // Si existe openModal (tu core), úsalo; si no, usa alert.
    var html =
      '<div class="card" style="max-height:70vh;overflow:auto;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">' +
          '<div style="font-weight:800;font-size:18px;">❓ Ayuda</div>' +
          '<button class="btn ghost" type="button" onclick="(function(){var m=document.getElementById(\'modalRoot\'); if(m) m.innerHTML=\'\';})();">Cerrar</button>' +
        '</div>' +
        '<div style="margin-top:10px;line-height:1.45;">' +
          '<b>Pagos pendientes</b><div class="muted">Suma de campañas obligatorias + campañas no obligatorias en las que participas.</div>' +
          '<div style="height:10px;"></div>' +
          '<b>Campaña obligatoria</b><div class="muted">Todos participan. No puedes excluirte.</div>' +
          '<div style="height:10px;"></div>' +
          '<b>Campaña no obligatoria</b><div class="muted">Puedes elegir Participar o No participo. Si eliges No participo, ese cobro se excluye de tu pendiente.</div>' +
          '<div style="height:10px;"></div>' +
          '<b>Vencida vs Pendiente</b><div class="muted">Pendiente incluye todo lo que falta por pagar. Vencida es una cuota que ya pasó su fecha.</div>' +
        '</div>' +
      '</div>';

    if (typeof window.openModal === "function") {
      window.openModal(html);
      return;
    }
    alert("Ayuda: Revisa tus pagos pendientes y campañas. Si tienes un problema, contacta al presidente o tesorero.");
  }

  // -------- Logout robusto --------
  function logout() {
    try {
      // Limpieza de claves típicas (sin asumir exacto)
      var keys = [
        "cursapp_session_v1",
        "cursapp_active_profile_v1"
      ];
      for (var i = 0; i < keys.length; i++) localStorage.removeItem(keys[i]);
    } catch (_) {}

    // Redirigir al login
    location.href = "/index.html";
  }

  // -------- Legacy buttons (compatibilidad con scripts viejos) --------
  function ensureLegacyButtons(container) {
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
    var ico = icon ? (icon + " ") : "";
    return (
      '<button class="btn ghost" type="button" style="width:100%;text-align:left;" onclick="' +
      String(onclickJs || "").replace(/"/g, "&quot;") +
      '">' +
      ico + label +
      "</button>"
    );
  }
  function dividerHTML() {
    return '<div style="height:1px;background:rgba(229,231,235,.9);margin:6px 0;"></div>';
  }

  // -------- Toggle binding --------
  function bindMenuToggle(dd) {
    // Botón del menú (algunos HTML han variado con el tiempo)
    var menuBtn = qs("#menuBtn") || qs('[data-menu-btn]') || qs('.menuBtn') || qs('.menu-btn');
    if (DEBUG_MENU) {
      debugMenuAlert("bindMenuToggle(): menuBtn=" + (!!menuBtn) + " menuDropdown=" + (!!dd) + " path=" + location.pathname);
    }
    if (!menuBtn) return;
    if (menuBtn.__cursappMenuBound) return;
    menuBtn.__cursappMenuBound = true;

    function positionDropdown() {
      try {
        var rect = menuBtn.getBoundingClientRect();
        // Fuerza estilos críticos para evitar quedar "por detrás" del header.
        dd.style.position = "fixed";
        dd.style.top = Math.max(8, rect.bottom + 8) + "px";
        dd.style.right = Math.max(8, window.innerWidth - rect.right) + "px";
        dd.style.left = "auto";
        dd.style.zIndex = "9999";
        dd.style.maxHeight = Math.floor(window.innerHeight * 0.7) + "px";
        dd.style.overflowY = "auto";
      } catch (_) {}
    }

    function toggleMenu(e) {
      try {
        if (e && e.preventDefault) e.preventDefault();
        if (e && e.stopPropagation) e.stopPropagation();
      } catch (_) {}
      var isOpen = dd.style.display === "block";
      if (isOpen) {
        dd.style.display = "none";
        if (DEBUG_MENU) debugMenuAlert("toggleMenu(): cerrar");
      } else {
        positionDropdown();
        dd.style.display = "block";
        if (DEBUG_MENU) {
          debugMenuAlert("toggleMenu(): abrir top=" + dd.style.top + " right=" + dd.style.right + " z=" + dd.style.zIndex);
        }
      }
    }

    menuBtn.addEventListener("touchstart", toggleMenu, { passive: false });
    menuBtn.addEventListener("click", toggleMenu);

    document.addEventListener("touchstart", function (e) {
      if (!dd.contains(e.target) && e.target !== menuBtn) dd.style.display = "none";
    }, { passive: true });

    document.addEventListener("click", function (e) {
      if (!dd.contains(e.target) && e.target !== menuBtn) dd.style.display = "none";
    });
  }

  function renderMenu(role) {
    var dd = qs("#menuDropdown");
    if (!dd) return;

    // Siempre parte cerrado
    dd.style.display = "none";
    dd.innerHTML = "";

    var parts = [];

    // APODERADO
    if (role === "apoderado") {
      // Volver a directiva: preferir switch directo sin depender de email
      parts.push(btnHTML("Volver a directiva", "switchToRole('presidente'); closeMenu();", "🧑‍💼"));

      parts.push(btnHTML("Pagos", "goTab('payments'); closeMenu();", "💳"));
      parts.push(btnHTML("Informes", "goTab('informes'); closeMenu();", "📄"));
      parts.push(btnHTML("Ayuda", "if(window.openHelp){openHelp('general')} else {openHelpFallback()} closeMenu();", "❓"));
      parts.push(btnHTML("Mi perfil", "alert('Mi perfil: próximamente'); closeMenu();", "👤"));

      parts.push(dividerHTML());

      parts.push(btnHTML("Reset total (dev)", "if(window.CURSAPP&&CURSAPP.hardReset){CURSAPP.hardReset()} closeMenu();", "🧨"));
      parts.push(btnHTML("Cerrar sesión", "logout();", "🚪"));
    }

    // PRESIDENTE
    if (role === "presidente") {
      parts.push(btnHTML("Volver a apoderado", "switchToRole('apoderado'); closeMenu();", "👤"));

      parts.push(btnHTML("Apoderados del curso", "location.href='/apoderados.html';", "👥"));
      parts.push(btnHTML("Campañas", "goTab('campanas'); closeMenu();", "📌"));
      parts.push(btnHTML("Deudores", "goTab('deudores'); closeMenu();", "🧾"));
      parts.push(btnHTML("Informes", "goTab('informes'); closeMenu();", "📄"));
      parts.push(btnHTML("Mi perfil", "alert('Mi perfil: próximamente'); closeMenu();", "👤"));
      parts.push(btnHTML("Ayuda", "if(window.openHelp){openHelp('general')} else {openHelpFallback()} closeMenu();", "❓"));

      parts.push(dividerHTML());

      parts.push(btnHTML("Reset total (dev)", "if(window.CURSAPP&&CURSAPP.hardReset){CURSAPP.hardReset()} closeMenu();", "🧨"));
      parts.push(btnHTML("Cerrar sesión", "logout();", "🚪"));
    }

    // TESORERO
    if (role === "tesorero") {
      parts.push(btnHTML("Volver a apoderado", "switchToRole('apoderado'); closeMenu();", "👤"));

      parts.push(btnHTML("Rendiciones", "goTab('rendiciones'); closeMenu();", "🧾"));
      parts.push(btnHTML("Informes", "goTab('informes'); closeMenu();", "📊"));
      parts.push(btnHTML("Mi perfil", "alert('Mi perfil: próximamente'); closeMenu();", "👤"));
      parts.push(btnHTML("Ayuda", "if(window.openHelp){openHelp('general')} else {openHelpFallback()} closeMenu();", "❓"));

      parts.push(dividerHTML());

      parts.push(btnHTML("Reset total (dev)", "if(window.CURSAPP&&CURSAPP.hardReset){CURSAPP.hardReset()} closeMenu();", "🧨"));
      parts.push(btnHTML("Cerrar sesión", "logout();", "🚪"));
    }

    dd.innerHTML = parts.join("");

    // Compatibilidad con scripts antiguos (aunque ya no dependemos de ellos)
    ensureLegacyButtons(dd);

    // Toggle iOS robusto
    bindMenuToggle(dd);

    // Seguridad
    dd.style.display = "none";
  }

  function init() {
    var role = normalizeRole(getRoleFromSession());
    renderMenu(role);
  }

  // Exponer helpers usados en onclick
  window.goTab = goTab;
  window.closeMenu = closeMenu;
  window.logout = logout;
  window.switchToRole = switchToRole;
  window.openHelpFallback = openHelpFallback;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
