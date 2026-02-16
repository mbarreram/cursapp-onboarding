/*
  Perfil (Safari-safe)
  - Sin fotos/avatars editables (privacidad)
  - Header/menú y bottom nav consistentes con el resto
  - No usa optional chaining ni sintaxis moderna que rompa Safari iOS
*/

(function () {
  "use strict";

  var _navBound = false;

  // ---------- helpers ----------
  function qs(sel) { return document.querySelector(sel); }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
  function getJSON(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }
  function setJSON(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }
  function fmtDateISO(d) {
    // d can be Date or iso string
    try {
      var dt = (d instanceof Date) ? d : new Date(d);
      if (isNaN(dt.getTime())) return "—";
      var dd = String(dt.getDate()).padStart(2, "0");
      var mm = String(dt.getMonth() + 1).padStart(2, "0");
      var yy = dt.getFullYear();
      return dd + "-" + mm + "-" + yy;
    } catch (e) { return "—"; }
  }
  function titleCase(s) {
    s = String(s || "").trim();
    if (!s) return "";
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  function initials(nameOrEmail) {
    var s = String(nameOrEmail || "").trim();
    if (!s) return "C";
    // if email, take before @
    var beforeAt = s.split("@")[0];
    var parts = beforeAt.replace(/[._-]+/g, " ").split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
    return (parts[0].slice(0, 1) + parts[1].slice(0, 1)).toUpperCase();
  }

  // ---------- session / data ----------
  function getSession() {
    // Prefer v1
    var s1 = getJSON("cursapp_session_v1", null);
    if (s1 && (s1.userId || s1.email)) return s1;
    var s2 = getJSON("cursapp_demo_user", null);
    if (s2 && (s2.userId || s2.email)) return s2;
    return null;
  }

  function getCourse(courseKey) {
    // In demo, course data often stored in cursapp_course_v1
    var c = getJSON("cursapp_course_v1", null);
    if (c && (!courseKey || c.courseKey === courseKey || c.courseKey === (courseKey || ""))) return c;
    // sometimes stored under active key
    var active = localStorage.getItem("cursapp_active_course_v1");
    if (active) {
      var c2 = getJSON("cursapp_course_v1", null);
      if (c2) return c2;
    }
    return c;
  }

  function getEnrollmentByEmailOrUser(courseKey, email, userId) {
    var arr = getJSON("cursapp_enrollments_v1", []);
    if (!Array.isArray(arr)) arr = [];
    for (var i = 0; i < arr.length; i++) {
      var e = arr[i] || {};
      if (courseKey && e.courseKey && e.courseKey !== courseKey) continue;
      if (email && e.email && String(e.email).toLowerCase() === String(email).toLowerCase()) return e;
      // fallback: userId sometimes equals email; compare loosely
      if (userId && e.email && String(e.email).toLowerCase() === String(userId).toLowerCase()) return e;
    }
    return null;
  }

  function getProfiles() {
    var p = getJSON("cursapp_profiles_v1", []);
    return Array.isArray(p) ? p : [];
  }

  // ---------- header wiring ----------
  function paintHeader(session, course) {
    var logo = qs("#hdrLogo") || qs("#avatar");
    var roleTitle = qs("#roleTitle");
    var sub = qs("#perfilSubline");

    var email = (session && session.email) ? session.email : (session ? session.userId : "");
    if (logo) logo.textContent = initials(email);

    if (roleTitle) roleTitle.textContent = "Mi perfil";

    // build subline: "Colegio · Curso · Año · Jornada"
    var school = "";
    var curso = "";
    var jornada = "";
    var anio = "";
    try {
      if (course && course.course) {
        school = course.course.schoolName || course.course.school || course.course.schoolId || "";
        curso = course.course.curso || course.course.course || "";
        jornada = course.course.jornada || "";
        anio = course.course.anio || course.course.year || "";
      }
    } catch (e) {}
    var bits = [];
    if (school) bits.push(school);
    // Some demos store courseKey like "sch-central|2°|B|Mañana|2026"
    if ((!curso || !jornada || !anio) && session && session.courseKey) {
      var ck = String(session.courseKey);
      var parts = ck.split("|");
      // [schoolId, curso, ?, jornada, anio]
      if (!curso && parts.length >= 3) curso = (parts[1] || "") + (parts[2] ? parts[2] : "");
      if (!jornada && parts.length >= 4) jornada = parts[3] || "";
      if (!anio && parts.length >= 5) anio = parts[4] || "";
    }
    if (curso) bits.push(curso);
    if (anio) bits.push(anio);
    if (jornada) bits.push(jornada);
    if (sub) sub.textContent = bits.length ? bits.join(" · ") : "—";
  }

  // ---------- render ----------
  function render() {
    var root = qs("#perfilContent");
    if (!root) return;

    var session = getSession();
    if (!session) {
      root.innerHTML = "<div class='card'><div class='h2'>Mi perfil</div><div class='muted'>No hay sesión activa.</div></div>";
      return;
    }

    // Navegación desde Perfil (una sola vez)
    if (!_navBound) {
      try { bindNavigation(session); } catch (e) {}
      _navBound = true;
    }

    var courseKey = session.courseKey || localStorage.getItem("cursapp_active_course_v1") || "";
    var course = getCourse(courseKey);
    paintHeader(session, course);

    var email = session.email || session.userId || "";
    var enrol = getEnrollmentByEmailOrUser(courseKey, email, session.userId);

    var apoderadoName = (enrol && enrol.apoderadoName) ? enrol.apoderadoName : (session.name || "");
    var alumnoName = (enrol && enrol.alumno) ? enrol.alumno : (session.alumno || "");
    var phone = (enrol && enrol.phone) ? enrol.phone : (session.phone || "");
    var status = (enrol && enrol.status) ? enrol.status : (session.status || "approved");
    var statusLabel = (String(status).toLowerCase() === "approved") ? "Aprobado" : titleCase(status);

    var role = session.currentRole || session.role || session.activeRole || "apoderado";
    role = String(role || "apoderado").toLowerCase();

    // Course details
    var schoolName = "—";
    var curso = "—";
    var jornada = "—";
    var anio = "—";
    var joined = "—";
    try {
      if (course && course.course) {
        schoolName = course.course.schoolName || "—";
        curso = course.course.curso || "—";
        jornada = course.course.jornada || "—";
        anio = course.course.anio || "—";
      }
    } catch (e) {}
    if ((curso === "—" || jornada === "—" || anio === "—") && courseKey) {
      var parts = String(courseKey).split("|");
      if (parts.length >= 3 && curso === "—") curso = (parts[1] || "") + (parts[2] ? parts[2] : "");
      if (parts.length >= 4 && jornada === "—") jornada = parts[3] || "—";
      if (parts.length >= 5 && anio === "—") anio = parts[4] || "—";
    }
    if (enrol && enrol.createdAt) joined = fmtDateISO(enrol.createdAt);

    // Available roles: from session.roles (array)
    var rolesArr = Array.isArray(session.roles) ? session.roles.slice() : [];
    if (!rolesArr.length && session.role) rolesArr = [session.role];
    // Ensure unique
    var uniq = {};
    var rolesClean = [];
    for (var i = 0; i < rolesArr.length; i++) {
      var r = String(rolesArr[i] || "").toLowerCase();
      if (!r) continue;
      if (uniq[r]) continue;
      uniq[r] = 1;
      rolesClean.push(r);
    }
    var rolesHuman = rolesClean.length ? rolesClean.map(titleCase).join(", ") : titleCase(role);

    root.innerHTML = ""
      + "<div class='card'>"
      + "  <div style='display:flex; align-items:flex-start; justify-content:space-between; gap:12px;'>"
      + "    <div>"
      + "      <div class='h2' style='margin-bottom:2px;'>Mi perfil</div>"
      + "      <div class='muted' style='font-size:12px; margin-top:0;'>" + esc(schoolName) + "</div>"
      + "    </div>"
      + "    <div class='pill' style='padding:10px 12px; font-weight:700;'>●&nbsp;Rol activo:&nbsp;" + esc(role) + "</div>"
      + "  </div>"
      // Avatares/fotos removidos por privacidad. El estado se muestra en "Roles y estado".

      + "  <div style='margin-top:14px;'>"
      + "    <div class='h3' style='margin:0 0 4px 0;'>" + esc(apoderadoName || "—") + "</div>"
      + "    <a href='mailto:" + esc(email) + "' class='muted' style='font-size:13px; word-break:break-all; text-decoration:underline; display:inline-block;'>" + esc(email) + "</a>"
      + "  </div>"

      + "  <div style='margin-top:14px;'>"
      + "    <div class='label'>Nombre</div>"
      + "    <input id='pfName' class='input' value='" + esc(apoderadoName) + "' placeholder='Nombre y apellido' />"
      + "  </div>"
      + "  <div style='margin-top:12px;'>"
      + "    <div class='label'>Teléfono</div>"
      + "    <input id='pfPhone' class='input' value='" + esc(phone) + "' placeholder='+56 9 1234 5678' />"
      + "  </div>"
      + "  <div style='margin-top:12px;'>"
      + "    <div class='label'>Alumno/a</div>"
      + "    <input id='pfAlumno' class='input' value='" + esc(alumnoName) + "' placeholder='Nombre del alumno/a' />"
      + "  </div>"
      + "  <div style='display:flex; gap:10px; margin-top:14px; flex-wrap:wrap;'>"
      + "    <button id='pfSave' class='btnPrimary'>Guardar cambios</button>"
      + "    <button id='pfChangeRole' class='btnGhost'>Cambiar rol</button>"
      + "  </div>"
      + "</div>"

      + "<div class='card'>"
      + "  <div class='cardTitle'><span class='icon'>🏫</span><b>Curso actual</b> <span class='pill' style='margin-left:auto;'>" + esc(schoolName) + "</span></div>"
      + "  <div class='kv'>"
      + "    <div class='k'>Curso</div><div class='v'>" + esc(curso) + "</div>"
      + "    <div class='k'>Jornada</div><div class='v'>" + esc(jornada) + "</div>"
      + "    <div class='k'>Año</div><div class='v'>" + esc(anio) + "</div>"
      + "    <div class='k'>Fecha ingreso</div><div class='v'>" + esc(joined) + "</div>"
      + "  </div>"
      + "</div>"

      + "<div class='card'>"
      + "  <div class='cardTitle'><span class='icon'>🎯</span><b>Roles y estado</b> <span class='pill' style='margin-left:auto;'>Rol activo: <b>" + esc(role) + "</b></span></div>"
      + "  <div class='kv'>"
      + "    <div class='k'>Disponibles</div><div class='v'>" + esc(rolesHuman) + "</div>"
      + "    <div class='k'>Estado</div><div class='v'>" + esc(statusLabel) + "</div>"
      + "  </div>"
      + "  <div style='margin-top:12px;'>"
      + "    <button id='pfChangeRole2' class='btnGhost'>Cambiar rol</button>"
      + "  </div>"
      + "</div>"

      + "<div class='card premiumCard'>"
      + "  <div class='h3' style='margin:0;'>Desbloquea Cursapp Premium</div>"
      + "  <div class='muted' style='margin-top:6px;'>Reportes avanzados, recordatorios automáticos, control de rendiciones y soporte prioritario.</div>"
      + "  <div style='margin-top:12px;'>"
      + "    <button class='btnGhost' id='pfPremium'>Ver Premium</button>"
      + "  </div>"
      + "</div>";

    // Wire actions
    var saveBtn = qs("#pfSave");
    if (saveBtn) {
      saveBtn.addEventListener("click", function () {
        var nameVal = (qs("#pfName") && qs("#pfName").value) ? qs("#pfName").value.trim() : "";
        var phoneVal = (qs("#pfPhone") && qs("#pfPhone").value) ? qs("#pfPhone").value.trim() : "";
        var alumnoVal = (qs("#pfAlumno") && qs("#pfAlumno").value) ? qs("#pfAlumno").value.trim() : "";

        // Update enrollment if exists
        var arr = getJSON("cursapp_enrollments_v1", []);
        if (!Array.isArray(arr)) arr = [];
        var updated = false;
        for (var i = 0; i < arr.length; i++) {
          var e = arr[i] || {};
          if (courseKey && e.courseKey && e.courseKey !== courseKey) continue;
          if (e.email && String(e.email).toLowerCase() === String(email).toLowerCase()) {
            e.apoderadoName = nameVal || e.apoderadoName;
            e.phone = phoneVal;
            e.alumno = alumnoVal || e.alumno;
            arr[i] = e;
            updated = true;
            break;
          }
        }
        if (updated) setJSON("cursapp_enrollments_v1", arr);

        // Also keep light fields in session for convenience
        session.name = nameVal || session.name;
        session.phone = phoneVal;
        session.alumno = alumnoVal;
        setJSON("cursapp_session_v1", session);

        alert("Guardado.");
        render();
      });
    }

    function openRolePicker() {
      // Use the same role picker modal from core/menu if exists, else fallback to redirect
      if (typeof window.openRoleModal === "function") {
        window.openRoleModal();
        return;
      }
      alert("Cambia el rol desde el menú (☰).\n\nSi no te aparece, vuelve a Inicio y reintenta.");
    }

    var cr1 = qs("#pfChangeRole");
    if (cr1) cr1.addEventListener("click", openRolePicker);
    var cr2 = qs("#pfChangeRole2");
    if (cr2) cr2.addEventListener("click", openRolePicker);

    var prem = qs("#pfPremium");
    if (prem) prem.addEventListener("click", function () {
      alert("Premium (demo): aquí iría el detalle de planes y activación.");
    });
  }

  // ------------------------------------------------------------
  // Navegación (Perfil -> módulos)
  function bindNavigation(session) {
    var role = String(session.currentRole || session.role || "").toLowerCase();
    var roleToPage = {
      presidente: "presidente.html",
      apoderado: "apoderado.html",
      tesorero: "tesorero.html",
      admin: "admin.html",
      administrador: "admin.html"
    };

    function targetPage() {
      return roleToPage[role] || "presidente.html";
    }

    function mapTab(tab) {
      tab = String(tab || "home");
      // Perfil usa tabs globales; en apoderado ajustamos al tab equivalente
      if (role === "apoderado") {
        if (tab === "campanas") return "payments";
        if (tab === "deudores") return "payments";
      }
      return tab;
    }

    function go(tab) {
      var next = mapTab(tab);
      if (window.CURSAPP && typeof window.CURSAPP.setNextNavTab === "function") {
        window.CURSAPP.setNextNavTab(next);
      }
      location.assign(targetPage());
    }

    // Bottom nav
    qsa(".navItem").forEach(function (btn) {
      btn.addEventListener("click", function () {
        go(btn.getAttribute("data-tab") || "home");
      });
    });
  }

  // ---------- minimal CSS hooks (match presidente.css) ----------
  function injectTinyCSS() {
    // Only what perfil needs, without affecting other pages
    var css = ""
      + ".avatarBig{width:84px;height:84px;border-radius:50%;background:#fff;border:1px solid rgba(0,0,0,.06);display:flex;align-items:center;justify-content:center;font-weight:900;font-size:28px;color:#1f73ff}"
      + ".label{font-size:13px;color:#6b7280;font-weight:700;margin-bottom:6px}"
      + ".input{width:100%;padding:12px 14px;border-radius:14px;border:1px solid rgba(0,0,0,.08);background:#fff;font-size:16px;outline:none}"
      + ".btnPrimary{padding:12px 16px;border-radius:999px;border:0;background:#f6b300;color:#1b1b1b;font-weight:800}"
      + ".btnGhost{padding:12px 16px;border-radius:999px;border:1px solid rgba(0,0,0,.12);background:#fff;color:#111827;font-weight:800}"
      + ".h2{font-size:20px;font-weight:900}"
      + ".h3{font-size:18px;font-weight:900}"
      + ".cardTitle{display:flex;align-items:center;gap:8px;margin-bottom:12px}"
      + ".cardTitle .icon{width:28px;height:28px;display:inline-flex;align-items:center;justify-content:center;border-radius:10px;background:rgba(31,115,255,.08)}"
      + ".kv{display:grid;grid-template-columns:140px 1fr;row-gap:12px;column-gap:10px}"
      + ".k{color:#6b7280;font-weight:800}"
      + ".v{justify-self:end;font-weight:900;color:#111827}"
      + ".premiumCard{background:linear-gradient(135deg,rgba(246,179,0,.10),rgba(31,115,255,.06));border:1px solid rgba(0,0,0,.06)}";
    var style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
  }

  // Boot
  try { injectTinyCSS(); } catch (e) {}
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", render);
  } else {
    render();
  }
})();
