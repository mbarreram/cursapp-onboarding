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

  
  // --- permissions / roles (self-contained) ---
  function getDirectivaByRole() {
    var raw = null;
    try { raw = localStorage.getItem("cursapp_directiva_apoderado_by_role_v1"); } catch (_) {}
    return safeJsonParse(raw) || {};
  }

  function normRole(r) {
    return String(r || "").toLowerCase().trim();
  }
  function getRolesAvailable() {
    var raw = null;
    try { raw = localStorage.getItem("cursapp_roles_v1"); } catch (_) {}
    var v = safeJsonParse(raw);
    if (!Array.isArray(v)) return [];
    return v.map(function (r) { return normRole(r); });
  }


  function nodeHasRole(node, role) {
    if (!node || typeof node !== "object") return false;
    var r = normRole(role);
    var v1 = normRole(node.role);
    var v2 = normRole(node.directivaRole);
    var v3 = normRole(node.directiva_role);
    return v1 === r || v2 === r || v3 === r;
  }

  function anyNodeHasRole(obj, role) {
    if (!obj) return false;
    if (Array.isArray(obj)) return obj.some(function (n) { return nodeHasRole(n, role) || anyNodeHasRole(n, role); });
    if (typeof obj === "object") {
      if (nodeHasRole(obj, role)) return true;
      return Object.keys(obj).some(function (k) { return anyNodeHasRole(obj[k], role); });
    }
    return false;
  }

  function emailMatches(node, email) {
    if (!email) return false;
    var e = String(email).toLowerCase().trim();
    if (!node) return false;
    if (typeof node === "string") return String(node).toLowerCase().trim() === e;
    if (typeof node !== "object") return false;
    var ne = node.email || node.mail || node.userEmail;
    if (ne && String(ne).toLowerCase().trim() === e) return true;
    return Object.keys(node).some(function (k) { return emailMatches(node[k], email); });
  }

  function hasRoleInDirectivaByRole(map, role, email) {
    if (!map || typeof map !== "object") return false;
    var r = normRole(role);
    // Try direct key
    var keys = Object.keys(map);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (normRole(k) === r) {
        return emailMatches(map[k], email);
      }
    }
    // Fallback: deep scan looking for role name in path
    return emailMatches(map[r], email);
  }

  function hasDirectivaPermission() {
    var sess = getSession();
    var email = sess.email || sess.userEmail || sess.username || sess.userId;
    var byRole = getDirectivaByRole();
    var profiles = getProfiles();
    return hasRoleInDirectivaByRole(byRole, "presidente", email) || anyNodeHasRole(profiles, "presidente");
  }

  function hasTesoreroPermission() {
    var sess = getSession();
    var email = sess.email || sess.userEmail || sess.username || sess.userId;
    var byRole = getDirectivaByRole();
    var profiles = getProfiles();
    return hasRoleInDirectivaByRole(byRole, "tesorero", email) || anyNodeHasRole(profiles, "tesorero");
  }

function getRoleFromSession() {
  // Prioridad: active role explícito -> session.activeRole -> session.role -> active profile.role
  try {
    var ar = localStorage.getItem("cursapp_active_role_v1");
    if (ar) return String(ar);
  } catch(_) {}

  var s = getSession();
  if (s && (s.activeRole || s.active_role)) return String(s.activeRole || s.active_role);
  if (s && s.role) return String(s.role);

  // fallback: active profile
  try {
    var activeId = localStorage.getItem("cursapp_active_profile_v1");
    var profilesRaw = localStorage.getItem("cursapp_profiles_v1");
    var profiles = safeJsonParse(profilesRaw);
    var all = Array.isArray(profiles) ? profiles : (profiles ? Object.values(profiles) : []);
    var p = all.find(function(x){
      return String(x.profileId || x.id || "") === String(activeId || "");
    });
    if (p && p.role) return String(p.role);
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
  targetRole = normalizeRole(String(targetRole || "apoderado"));

  // 0) Validación segura (si existe)
  try{
    if(window.CURSAPP && typeof window.CURSAPP.switchRoleSafe === "function"){
      // Si no es válido, switchRoleSafe muestra alert
      var ok = window.CURSAPP.switchRoleSafe(targetRole);
      if(!ok) return;
    }
  }catch(_){ }

  // 0) Guardar rol activo explícito
  try { localStorage.setItem("cursapp_active_role_v1", targetRole); } catch(_) {}

  // 1) Preferir setear perfil activo (no depende de email)
  var id = findProfileIdByRole(targetRole);
  if (id) {
    try { localStorage.setItem("cursapp_active_profile_v1", String(id)); } catch (_) {}
  }

  // 2) Ajustar role en sesión si existe (mantener compatibilidad)
  try {
    var raw = localStorage.getItem("cursapp_session_v1");
    var sess = safeJsonParse(raw) || {};
    sess.role = targetRole;
    sess.currentRole = targetRole;
    sess.activeRole = targetRole;
    if(Array.isArray(sess.roles) && sess.roles.indexOf(targetRole) === -1) sess.roles.push(targetRole);
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
  function normalizeNavTabForRole(tab, role) {
    var t = String(tab || "").toLowerCase().trim();
    role = normalizeRole(role || getRoleFromSession());

    if (t === "informe" || t === "reportes" || t === "reporte") t = "informes";
    if (t === "campaña" || t === "campana" || t === "campaign" || t === "campaigns" || t === "cobros") t = "campanas";
    if (t === "pago" || t === "pagos" || t === "payments" || t === "cuotas") t = "payments";

    if (role === "presidente") {
      if (t === "payments" || t === "pagos" || t === "cobros") return "campanas";
      if (t === "campana") return "campanas";
      return t;
    }

    if (role === "tesorero") {
      if (t === "payments" || t === "pagos" || t === "conciliaciones") return "conciliacion";
      if (t === "campanas" || t === "campana" || t === "campaigns") return "rendiciones";
      return t;
    }

    // Apoderado: campañas/cuotas terminan en Pagos
    if (t === "campanas" || t === "campana" || t === "campaigns") return "payments";
    return t;
  }

  function goTab(tab) {
    var s = getSession() || {};
    var role = normalizeRole(s.currentRole || s.role || s.activeRole || getRoleFromSession());
    var normalized = normalizeNavTabForRole(tab, role);
    var btn = document.querySelector('.navItem[data-tab="' + normalized + '"]');

    // Primero usa la navegación oficial de la pantalla
    if (btn) {
      btn.click();
      return true;
    }

    // Si no existe botón visible, llama al router global del rol
    try {
      if (typeof window.go === "function") {
        window.go(normalized);
        return true;
      }
    } catch (_) {}

    // Fallback cross-page desde perfil u otras vistas
    var page = (role === 'tesorero') ? 'tesorero.html' : (role === 'presidente' ? 'presidente.html' : 'apoderado.html');
    try {
      if (window.CURSAPP && typeof window.CURSAPP.setNextNavTab === "function") {
        window.CURSAPP.setNextNavTab(normalized);
      }
    } catch (_) {}

    if (!new RegExp(page + "$").test(location.pathname)) {
      location.href = "/" + page + "#" + normalized;
      return true;
    }

    return false;
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
  var menuBtn = qs("#menuBtn");
  if (!menuBtn || menuBtn.__cursappMenuBound) return;
  menuBtn.__cursappMenuBound = true;

  // Forzar dropdown flotante sobre cualquier header (iOS/Safari)
  dd.style.position = "fixed";
  dd.style.zIndex = "99999";
  dd.style.display = "none";

  function placeDropdown() {
    try {
      var r = menuBtn.getBoundingClientRect();
      var top = Math.round(r.bottom + 8);
      var right = Math.round(window.innerWidth - r.right);
      dd.style.top = top + "px";
      dd.style.right = right + "px";
      dd.style.left = "auto";
      dd.style.maxHeight = "70vh";
      dd.style.overflowY = "auto";
    } catch(_) {}
  }

  function toggleMenu(e) {
    try {
      if (e && e.preventDefault) e.preventDefault();
      if (e && e.stopPropagation) e.stopPropagation();
    } catch (_) {}

    var isOpen = dd.style.display === "block";
    if (isOpen) {
      dd.style.display = "none";
      return;
    }
    placeDropdown();
    dd.style.display = "block";
  }

  // Evitar conflicto con handlers antiguos
  try { menuBtn.onclick = null; } catch(_) {}

  menuBtn.addEventListener("touchstart", toggleMenu, { passive: false });
  menuBtn.addEventListener("click", toggleMenu);

  window.addEventListener("resize", function(){ if (dd.style.display==="block") placeDropdown(); });

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
      // Cambiar a rol directiva (si el usuario tiene ese rol)
      var av = getRolesAvailable();
      if (!av || !av.length) {
        var ses0 = getSession() || {};
        var em0 = normEmail(ses0.email || ses0.userEmail || "");
        var dm0 = getDirectivaByRole();
        av = [];
        if (hasRoleInDirectivaByRole(dm0, "tesorero", em0)) av.push("tesorero");
        if (hasRoleInDirectivaByRole(dm0, "presidente", em0)) av.push("presidente");
      }
      if (av.indexOf("tesorero") >= 0) {
        parts.push(btnHTML("Ir a tesorero", "switchToRole(\"tesorero\"); closeMenu();", "💰"));
      } else if (av.indexOf("presidente") >= 0) {
        parts.push(btnHTML("Ir a presidente", "switchToRole(\"presidente\"); closeMenu();", "🧑‍💼"));
      }

      parts.push(btnHTML("Pagos", "goTab('payments'); closeMenu();", "💳"));
      parts.push(btnHTML("Informes", "goTab('informes'); closeMenu();", "📄"));
      parts.push(btnHTML("Ayuda", "if(window.openHelp){openHelp('general')} else {openHelpFallback()} closeMenu();", "❓"));
      parts.push(btnHTML("Mi perfil", "location.href='/perfil.html';", "👤"));

      parts.push(dividerHTML());

      parts.push(btnHTML("Reset total (dev)", "if(window.CURSAPP&&CURSAPP.hardReset){CURSAPP.hardReset()} closeMenu();", "🧨"));
      parts.push(btnHTML("Cerrar sesión", "logout();", "🚪"));
    }

    // PRESIDENTE
    if (role === "presidente") {
      parts.push(btnHTML("Ir a apoderado", "switchToRole('apoderado'); closeMenu();", "👤"));

      parts.push(btnHTML("Apoderados del curso", "location.href='/apoderados.html';", "👥"));
      parts.push(btnHTML("Campañas", "goTab('campanas'); closeMenu();", "📌"));
      parts.push(btnHTML("Deudores", "goTab('deudores'); closeMenu();", "🧾"));
      parts.push(btnHTML("Informes", "goTab('informes'); closeMenu();", "📄"));
      parts.push(btnHTML("Mi perfil", "location.href='/perfil.html';", "👤"));
      parts.push(btnHTML("Ayuda", "if(window.openHelp){openHelp('general')} else {openHelpFallback()} closeMenu();", "❓"));

      parts.push(dividerHTML());

      parts.push(btnHTML("Reset total (dev)", "if(window.CURSAPP&&CURSAPP.hardReset){CURSAPP.hardReset()} closeMenu();", "🧨"));
      parts.push(btnHTML("Cerrar sesión", "logout();", "🚪"));
    }

    // TESORERO
    if (role === "tesorero") {
      parts.push(btnHTML("Ir a apoderado", "switchToRole('apoderado'); closeMenu();", "👤"));

      parts.push(btnHTML("Rendiciones", "goTab('rendiciones'); closeMenu();", "🧾"));
      parts.push(btnHTML("Informes", "goTab('informes'); closeMenu();", "📊"));
      parts.push(btnHTML("Mi perfil", "location.href='/perfil.html';", "👤"));
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
    var s = getSession() || {};
    var role = normalizeRole(s.currentRole || s.role || getRoleFromSession());
    renderMenu(role);
  }

  // Exponer helpers usados en onclick
  window.goTab = goTab;
  window.normalizeNavTabForRole = normalizeNavTabForRole;
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
