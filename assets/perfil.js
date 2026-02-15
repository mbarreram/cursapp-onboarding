// Perfil (Safari-safe, sin fotos/avatars por privacidad)
(function () {
  function qs(sel, root) { return (root || document).querySelector(sel); }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
  function safeJsonParse(s) { try { return JSON.parse(s); } catch (e) { return null; } }

  function getSession() {
    var s1 = safeJsonParse(localStorage.getItem("cursapp_session_v1"));
    if (s1 && (s1.userId || s1.email)) return s1;
    var s2 = safeJsonParse(localStorage.getItem("cursapp_demo_user"));
    if (s2 && (s2.userId || s2.email)) return s2;
    return null;
  }

  function getCourse() {
    var c = safeJsonParse(localStorage.getItem("cursapp_course_v1"));
    return c || null;
  }

  function getProfiles() {
    var arr = safeJsonParse(localStorage.getItem("cursapp_profiles_v1"));
    return Array.isArray(arr) ? arr : [];
  }

  function resolveEmail(session) {
    if (!session) return "";
    if (session.email && String(session.email).indexOf("@") > -1) return String(session.email);
    if (session.userId && String(session.userId).indexOf("@") > -1) return String(session.userId);

    // Fallback: buscar en cursapp_users_v1 por userId
    var users = safeJsonParse(localStorage.getItem("cursapp_users_v1"));
    if (Array.isArray(users) && session.userId) {
      for (var i = 0; i < users.length; i++) {
        if (users[i] && users[i].userId === session.userId && users[i].email) return String(users[i].email);
      }
    }
    return String(session.userId || "");
  }

  function roleLabel(r) {
    var x = String(r || "").toLowerCase();
    if (x === "presidente") return "Presidente";
    if (x === "tesorero") return "Tesorero";
    if (x === "apoderado") return "Apoderado";
    if (x === "admin") return "Admin";
    return r ? (String(r).charAt(0).toUpperCase() + String(r).slice(1)) : "—";
  }

  function initials(name) {
    var s = String(name || "").trim();
    if (!s) return "C";
    var parts = s.split(/\s+/);
    var a = parts[0] ? parts[0].charAt(0) : "";
    var b = parts.length > 1 ? parts[1].charAt(0) : "";
    return (a + b).toUpperCase();
  }

  function setHeader(course, session) {
    var titleText = qs("#titleText");
    var titleSub = qs("#titleSub");

    if (titleText) titleText.textContent = "Mi perfil";

    // Subtítulo: Colegio · Curso · Año · Jornada (si existe)
    var parts = [];
    if (course && course.course && course.course.schoolName) parts.push(course.course.schoolName);
    if (course && course.course && course.course.level) parts.push(course.course.level);
    if (course && course.course && course.course.year) parts.push(String(course.course.year));
    if (course && course.course && course.course.shift) parts.push(course.course.shift);
    if (titleSub) titleSub.textContent = parts.length ? parts.join(" · ") : "—";
  }

  function render() {
    var host = qs("#perfilContent") || qs("#app");
    if (!host) return;

    var session = getSession();
    var course = getCourse();
    setHeader(course, session);

    if (!session) {
      host.innerHTML = "<div class='card' style='padding:16px'>No hay sesión activa.</div>";
      return;
    }

    var profiles = getProfiles();
    var currentRole = session.currentRole || session.role || localStorage.getItem("cursapp_active_role_v1") || "";
    currentRole = String(currentRole || "").toLowerCase();

    // Datos principales
    var apoderadoName = "";
    var alumnoName = "";
    // Intentamos extraer desde enrolments si existe
    var enrolments = safeJsonParse(localStorage.getItem("cursapp_enrolments_v1"));
    if (Array.isArray(enrolments) && enrolments.length) {
      // buscamos por email si coincide
      var em = resolveEmail(session);
      for (var i = 0; i < enrolments.length; i++) {
        var e = enrolments[i];
        if (!e) continue;
        if (em && e.email === em) {
          apoderadoName = e.apoderadoName || apoderadoName;
          alumnoName = e.alumno || alumnoName;
          break;
        }
      }
    }

    // Fallback: directiva_apoderado_by_role
    if (!apoderadoName || !alumnoName) {
      var byRole = safeJsonParse(localStorage.getItem("cursapp_directiva_apoderado_by_role_v1"));
      if (byRole && currentRole && byRole[currentRole]) {
        apoderadoName = apoderadoName || byRole[currentRole].apoderadoName;
        alumnoName = alumnoName || byRole[currentRole].alumno;
      }
      if (byRole && byRole.presidente) {
        apoderadoName = apoderadoName || byRole.presidente.apoderadoName;
        alumnoName = alumnoName || byRole.presidente.alumno;
      }
    }

    apoderadoName = apoderadoName || "—";
    alumnoName = alumnoName || "—";
    var email = resolveEmail(session);

    // Curso actual
    var level = course && course.course ? (course.course.level || "—") : "—";
    var shift = course && course.course ? (course.course.shift || "—") : "—";
    var year = course && course.course ? (course.course.year || "—") : "—";
    var schoolName = course && course.course ? (course.course.schoolName || "—") : "—";
    var joinDate = (session.createdAt || session.created_at || session.loginAt || "");

    // Estado: por ahora siempre "Aprobado" si existe sesión (MVP)
    var statusLabel = "Aprobado";

    // Roles disponibles (desde sesión.roles o profiles)
    var roles = session.roles;
    if (!Array.isArray(roles) || !roles.length) {
      roles = [];
      for (var p = 0; p < profiles.length; p++) {
        if (profiles[p] && profiles[p].role) roles.push(String(profiles[p].role));
      }
    }
    // normalizar
    var seen = {};
    var rolesUniq = [];
    for (var r = 0; r < roles.length; r++) {
      var rr = String(roles[r] || "").toLowerCase();
      if (!rr || seen[rr]) continue;
      seen[rr] = true;
      rolesUniq.push(rr);
    }

    // Render
    host.innerHTML = "" +
      "<div class='profileWrap'>" +
        "<div class='card'>" +
          "<div class='cardHeader'>" +
            "<div>" +
              "<h2>Mi perfil</h2>" +
              "<div class='muted'>" + esc(schoolName) + "</div>" +
            "</div>" +
            "<span class='pill'>Rol activo: <b>" + esc(currentRole || "—") + "</b></span>" +
          "</div>" +
          "<div class='profileGrid'>" +
            "<div class='avatars'>" +
              "<div class='avatarBlock'>" +
                "<div class='avatarCircle'>" + esc(initials(apoderadoName)) + "</div>" +
                "<div class='avatarLabel'>Apoderado</div>" +
              "</div>" +
              "<div class='avatarBlock'>" +
                "<div class='avatarCircle'>" + esc(initials(alumnoName)) + "</div>" +
                "<div class='avatarLabel'>Alumno</div>" +
              "</div>" +
            "</div>" +
            "<div>" +
              "<p class='bigName'><b>" + esc(apoderadoName) + "</b> <span class='pill ok' style='margin-left:10px'>" + esc(statusLabel) + "</span></p>" +
              (email ? ("<a class='bigEmail' href='mailto:" + esc(email) + "'>" + esc(email) + "</a>") : "") +
              "<div class='formGrid'>" +
                "<div>" +
                  "<label>Nombre</label>" +
                  "<input id='inpNombre' type='text' value='" + esc(apoderadoName) + "'>" +
                "</div>" +
                "<div>" +
                  "<label>Teléfono</label>" +
                  "<input id='inpTelefono' type='tel' placeholder='+56 9 1234 5678' value='">" +
                "</div>" +
                "<div style='grid-column:1 / -1'>" +
                  "<label>Alumno/a</label>" +
                  "<input id='inpAlumno' type='text' value='" + esc(alumnoName) + "'>" +
                "</div>" +
              "</div>" +
              "<div class='actions'>" +
                "<button id='btnGuardarPerfil' class='btnPrimary'>Guardar cambios</button>" +
                "<button id='btnCambiarRol' class='btnGhost'>Cambiar rol</button>" +
              "</div>" +
              "<div id='perfilMsg' class='note'></div>" +
            "</div>" +
          "</div>" +
        "</div>" +

        "<div style='height:12px'></div>" +

        "<div class='card' style='padding:16px 18px'>" +
          "<div class='sectionTitle' style='font-weight:900;font-size:18px;display:flex;align-items:center;gap:10px;margin:0 0 12px'>" +
            "<span class='ico' style='width:26px;height:26px;border-radius:10px;display:inline-flex;align-items:center;justify-content:center;border:1px solid #e6ebf5;background:#f7f9ff'>🏫</span>" +
            "<span>Curso actual</span>" +
          "</div>" +
          "<div style='display:grid;grid-template-columns:1fr 1fr;gap:12px'>" +
            "<div class='muted' style='font-weight:800'>Curso</div><div style='text-align:right;font-weight:900'>" + esc(level) + "</div>" +
            "<div class='muted' style='font-weight:800'>Jornada</div><div style='text-align:right;font-weight:900'>" + esc(shift) + "</div>" +
            "<div class='muted' style='font-weight:800'>Año</div><div style='text-align:right;font-weight:900'>" + esc(year) + "</div>" +
            "<div class='muted' style='font-weight:800'>Fecha ingreso</div><div style='text-align:right;font-weight:900'>" + esc(joinDate ? String(joinDate).slice(0,10) : "—") + "</div>" +
          "</div>" +
        "</div>" +

        "<div style='height:12px'></div>" +

        "<div class='card' style='padding:16px 18px'>" +
          "<div class='sectionTitle' style='font-weight:900;font-size:18px;display:flex;align-items:center;gap:10px;margin:0 0 12px'>" +
            "<span class='ico' style='width:26px;height:26px;border-radius:10px;display:inline-flex;align-items:center;justify-content:center;border:1px solid #e6ebf5;background:#f7f9ff'>🎯</span>" +
            "<span>Roles y estado</span>" +
          "</div>" +
          "<div style='display:grid;grid-template-columns:1fr 1fr;gap:12px'>" +
            "<div class='muted' style='font-weight:800'>Disponibles</div><div style='text-align:right;font-weight:900'>" + esc(rolesUniq.join(", ") || roleLabel(currentRole)) + "</div>" +
            "<div class='muted' style='font-weight:800'>Estado</div><div style='text-align:right;font-weight:900'>" + esc(statusLabel) + "</div>" +
          "</div>" +
        "</div>" +

        "<div class='premiumCard'>" +
          "<div>" +
            "<h3>Desbloquea Cursapp Premium</h3>" +
            "<p>Reportes avanzados, recordatorios automáticos, control de rendiciones y soporte prioritario.</p>" +
          "</div>" +
          "<button id='btnVerPremium' class='miniBtn'>Ver Premium</button>" +
        "</div>" +
      "</div>";

    // Actions
    var msg = qs("#perfilMsg");
    function toast(t) {
      if (msg) msg.textContent = t;
    }

    var btnGuardar = qs("#btnGuardarPerfil");
    if (btnGuardar) {
      btnGuardar.addEventListener("click", function () {
        // MVP: guardamos en enrolments si existe matching email
        var newName = (qs("#inpNombre") || {}).value || "";
        var newTel = (qs("#inpTelefono") || {}).value || "";
        var newAlu = (qs("#inpAlumno") || {}).value || "";

        try {
          var em = resolveEmail(session);
          var arr = safeJsonParse(localStorage.getItem("cursapp_enrolments_v1"));
          if (!Array.isArray(arr)) arr = [];
          var updated = false;
          for (var i = 0; i < arr.length; i++) {
            if (arr[i] && em && arr[i].email === em) {
              arr[i].apoderadoName = newName || arr[i].apoderadoName;
              arr[i].phone = newTel || arr[i].phone;
              arr[i].alumno = newAlu || arr[i].alumno;
              updated = true;
              break;
            }
          }
          if (!updated && em) {
            arr.push({
              enrollmentId: "enr_" + Date.now(),
              courseKey: session.courseKey || (course && course.courseKey) || "",
              apoderadoName: newName,
              alumno: newAlu,
              email: em,
              phone: newTel,
              status: "approved"
            });
          }
          localStorage.setItem("cursapp_enrolments_v1", JSON.stringify(arr));
          toast("✅ Datos guardados.");
        } catch (e) {
          toast("⚠️ No se pudo guardar.");
        }
      });
    }

    var btnCambiarRol = qs("#btnCambiarRol");
    if (btnCambiarRol) {
      btnCambiarRol.addEventListener("click", function () {
        // reutilizamos la lógica del menú: simulamos click en el menú para evitar duplicar reglas
        var dd = qs("#menuDropdown");
        if (dd) dd.classList.add("open");
        toast("Selecciona un rol desde el menú ☰");
      });
    }

    var btnPremium = qs("#btnVerPremium");
    if (btnPremium) {
      btnPremium.addEventListener("click", function () {
        toast("Premium: pronto podrás habilitarlo desde aquí.");
      });
    }
  }

  // Arranque
  try {
    render();
  } catch (e) {
    var host = qs("#perfilContent") || qs("#app");
    if (host) {
      host.innerHTML = "<div class='card' style='padding:16px'>No se pudo cargar Mi perfil.</div>";
    }
  }
})();
