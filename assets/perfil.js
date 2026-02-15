
/* =========================================================
   Cursapp · perfil.js (Safari-safe)
   - Lee sesión desde: cursapp_session_v1 / cursapp_demo_user
   - Lee curso desde: cursapp_course_v1 / cursapp_active_course_v1
   - Lee perfiles desde: cursapp_profiles_v1
   - Lee enrollments desde: cursapp_enrollments_v1
   - Avatar: guarda solo en keys separadas (no rompe JSON)
   ========================================================= */

(function () {
  // ---------- debug helpers ----------
  function qs() { return (window.location && window.location.search) ? window.location.search : ""; }
  function hasDbg() { return qs().indexOf("dbg=1") !== -1 || qs().indexOf("debug=1") !== -1; }
  function dbgSet(msg) {
    try {
      var b = document.getElementById("debugBanner");
      if (!b) return;
      if (hasDbg()) b.style.display = "block";
      b.textContent = "Perfil Debug: " + msg;
    } catch (e) {}
  }
  function dbgAlert(msg) { try { if (hasDbg()) alert(msg); } catch (e) {} }

  // ---------- safe utils ----------
  function esc(s) {
    if (s === null || s === undefined) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
  function readLS(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function writeLS(key, val) {
    try { localStorage.setItem(key, val); return true; } catch (e) { return false; }
  }
  function parseJSON(raw) {
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }
  function fmtDate(iso) {
    if (!iso) return "—";
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return "—";
      var dd = String(d.getDate()); if (dd.length < 2) dd = "0" + dd;
      var mm = String(d.getMonth() + 1); if (mm.length < 2) mm = "0" + mm;
      var yy = d.getFullYear();
      return dd + "-" + mm + "-" + yy;
    } catch (e) { return "—"; }
  }

  // ---------- data access ----------
  function getSession() {
    // prefer explicit session v1
    var s = parseJSON(readLS("cursapp_session_v1"));
    if (s) return s;

    // some builds used demo_user as session
    s = parseJSON(readLS("cursapp_demo_user"));
    if (s) return s;

    // legacy
    s = parseJSON(readLS("cursapp_session"));
    if (s) return s;

    return null;
  }

  function getActiveRole(session) {
    var r = readLS("cursapp_active_role_v1");
    if (r) return r;
    if (session && session.currentRole) return session.currentRole;
    if (session && session.role) return session.role;
    return "apoderado";
  }

  function getRoles(session) {
    var a = parseJSON(readLS("cursapp_roles_v1"));
    if (a && a.length) return a;
    if (session && session.roles && session.roles.length) return session.roles;
    return ["apoderado"];
  }

  function getCourseKey(session) {
    var ck = readLS("cursapp_active_course_v1");
    if (ck) return ck;
    if (session && session.courseKey) return session.courseKey;
    return null;
  }

  function getCourse(courseKey) {
    var c = parseJSON(readLS("cursapp_course_v1"));
    if (c && (!courseKey || c.courseKey === courseKey)) return c;
    // fallback: sometimes stored per-course
    if (courseKey) {
      var per = parseJSON(readLS("cursapp_" + courseKey + "_course_v1"));
      if (per) return per;
    }
    return c || null;
  }

  function getProfiles() {
    var p = parseJSON(readLS("cursapp_profiles_v1"));
    return (p && p.length) ? p : [];
  }

  function getEnrollments() {
    var e = parseJSON(readLS("cursapp_enrollments_v1"));
    return (e && e.length) ? e : [];
  }

  function getDirectivaByRole() {
    var d = parseJSON(readLS("cursapp_directiva_apoderado_by_role_v1"));
    return d || {};
  }

  // ---------- avatar storage (separate keys) ----------
  function avatarKey(kind, profileId, courseKey) {
    // keep short key
    var k = "cursapp_avatar_" + kind + "_v1";
    if (profileId) k += "_" + profileId;
    if (courseKey) k += "_" + courseKey;
    return k;
  }

  function getAvatar(kind, profileId, courseKey) {
    return readLS(avatarKey(kind, profileId, courseKey)) || "";
  }

  function setAvatar(kind, profileId, courseKey, dataUrl) {
    if (!dataUrl) return false;
    // hard safety: avoid huge values
    if (dataUrl.length > 450000) return false; // ~450KB string
    return writeLS(avatarKey(kind, profileId, courseKey), dataUrl);
  }

  function clearAvatars(profileId, courseKey) {
    try {
      localStorage.removeItem(avatarKey("apoderado", profileId, courseKey));
      localStorage.removeItem(avatarKey("alumno", profileId, courseKey));
    } catch (e) {}
  }

  // compress image to dataURL (jpeg) safely
  function compressToDataURL(file, maxW, maxH, quality, cb) {
    try {
      var reader = new FileReader();
      reader.onload = function () {
        var dataUrl = reader.result;
        // if not image, return original
        if (!dataUrl || String(dataUrl).indexOf("data:image") !== 0) return cb(null);

        var img = new Image();
        img.onload = function () {
          try {
            var w = img.width, h = img.height;
            if (!w || !h) return cb(null);

            var ratio = Math.min(maxW / w, maxH / h, 1);
            var nw = Math.round(w * ratio);
            var nh = Math.round(h * ratio);

            var canvas = document.createElement("canvas");
            canvas.width = nw;
            canvas.height = nh;
            var ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, nw, nh);

            var out = "";
            try { out = canvas.toDataURL("image/jpeg", quality); }
            catch (e) { out = canvas.toDataURL(); }

            cb(out);
          } catch (e2) {
            cb(null);
          }
        };
        img.onerror = function () { cb(null); };
        img.src = dataUrl;
      };
      reader.onerror = function () { cb(null); };
      reader.readAsDataURL(file);
    } catch (e) {
      cb(null);
    }
  }

  // ---------- render ----------
  function render() {
    dbgSet("render()…");

    var root = document.getElementById("perfilContent");
    if (!root) return;

    var session = getSession();
    var courseKey = getCourseKey(session);
    var activeRole = getActiveRole(session);
    var roles = getRoles(session);

    if (!session) {
      root.innerHTML = "<div class='card' style='margin:16px'><div class='cardTitle'>Mi perfil</div><div class='muted'>No hay sesión activa.</div></div>";
      dbgSet("sin sesión");
      return;
    }

    // derive identity
    var profiles = getProfiles();
    var enrollments = getEnrollments();
    var directivaByRole = getDirectivaByRole();

    var email = session.email || session.userId || "";
    var profileId = session.profileId || readLS("cursapp_active_profile_v1") || "";

    // find enrollment (by email + courseKey)
    var enr = null;
    for (var i = 0; i < enrollments.length; i++) {
      var e = enrollments[i];
      if (!e) continue;
      if (courseKey && e.courseKey && e.courseKey !== courseKey) continue;
      if (email && e.email && String(e.email).toLowerCase() === String(email).toLowerCase()) { enr = e; break; }
    }

    // directiva info if role exists
    var dir = (directivaByRole && activeRole && directivaByRole[activeRole]) ? directivaByRole[activeRole] : null;

    var apoderadoName = "";
    var alumnoName = "";
    var phone = "";

    if (dir) {
      apoderadoName = dir.apoderadoName || dir.name || "";
      alumnoName = dir.alumno || "";
    }
    if (!apoderadoName && enr) apoderadoName = enr.apoderadoName || enr.name || "";
    if (!alumnoName && enr) alumnoName = enr.alumno || "";
    if (enr) phone = enr.phone || "";

    // course info
    var course = getCourse(courseKey) || {};
    var courseLabel = "";
    try {
      if (course && course.course && course.course.schoolName) courseLabel = course.course.schoolName;
      else if (course && course.schoolName) courseLabel = course.schoolName;
    } catch (e3) {}
    var curso = "—";
    var jornada = "—";
    var year = "—";
    try {
      if (course && course.course) {
        curso = (course.course.level ? (course.course.level + "°") : "") + (course.course.letter || "");
        if (!curso || curso === "°") curso = "—";
        jornada = course.course.jornada || "—";
        year = course.course.year || "—";
      }
    } catch (e4) {}

    // avatar initials
    function initials(name) {
      var s = String(name || "").trim();
      if (!s) return "—";
      var parts = s.split(/\s+/);
      var a = parts[0] ? parts[0].charAt(0) : "";
      var b = parts.length > 1 ? parts[1].charAt(0) : "";
      return (a + b).toUpperCase();
    }

    // read avatars
    var avApo = getAvatar("apoderado", profileId, courseKey);
    var avAlu = getAvatar("alumno", profileId, courseKey);

    // header subline
    try {
      var sub = document.getElementById("perfilSubline");
      if (sub) {
        var sline = "";
        if (courseLabel) sline = courseLabel;
        if (curso && curso !== "—") sline += (sline ? " · " : "") + curso;
        if (year && year !== "—") sline += (sline ? " " : "") + year;
        if (jornada && jornada !== "—") sline += (sline ? " · " : "") + jornada;
        sub.textContent = sline || "—";
      }
    } catch (e5) {}

    // mini avatar
    try {
      var mini = document.getElementById("perfilMiniAvatar");
      if (mini) mini.textContent = (initials(apoderadoName) || "C").charAt(0);
    } catch (e6) {}

    // Build HTML (premium, no template literals)
    var html = "";

    // ---- IDENTIDAD ----
    html += "<div class='card profileCard' style='margin:16px'>";
    html += "  <div class='profileHead'>";
    html += "    <div>";
    html += "      <div class='profileTitle'>Mi perfil</div>";
    html += "      <div class='profileSub'>" + esc(courseLabel || "—") + "</div>";
    html += "    </div>";
    html += "    <div class='profileBadges'>";
    html += "      <span class='badgePill'><span class='badgeDot'></span> Rol activo: <b>" + esc(activeRole || "—") + "</b></span>";
    html += "    </div>";
    html += "  </div>";

    html += "  <div class='profileGrid'>";

    // avatars
    html += "    <div class='avatarBlock'>";
    html += "      <div class='avatarPair'>";
    html += "        <div class='avatarItem'>";
    html += "          <div class='avatarWrap'>";
    html += "            <div class='avatarCircleXL' id='apoAvatar'>";
    if (avApo) html += "              <img src='" + esc(avApo) + "' alt='Foto apoderado' />";
    else html += "              <span class='avatarInitials'>" + esc(initials(apoderadoName) || "A") + "</span>";
    html += "            </div>";
    html += "            <label class='avatarAction' title='Cambiar foto'>";
    html += "              📷<input id='apoFile' type='file' accept='image/*' style='display:none'/>";
    html += "            </label>";
    html += "          </div>";
    html += "          <div class='avatarMeta'>";
    html += "            <div class='avatarLabel'>Apoderado</div>";
    html += "          </div>";
    html += "        </div>";

    html += "        <div class='avatarItem'>";
    html += "          <div class='avatarWrap'>";
    html += "            <div class='avatarCircleXL' id='aluAvatar'>";
    if (avAlu) html += "              <img src='" + esc(avAlu) + "' alt='Foto alumno' />";
    else html += "              <span class='avatarInitials'>" + esc(initials(alumnoName) || "N") + "</span>";
    html += "            </div>";
    html += "            <label class='avatarAction' title='Cambiar foto'>";
    html += "              📷<input id='aluFile' type='file' accept='image/*' style='display:none'/>";
    html += "            </label>";
    html += "          </div>";
    html += "          <div class='avatarMeta'>";
    html += "            <div class='avatarLabel'>Alumno</div>";
    html += "          </div>";
    html += "        </div>";
    html += "      </div>";
    html += "      <button class='btn subtleBtn' id='btnClearPhotos' type='button'>Restablecer fotos</button>";
    html += "    </div>";

    // info editable
    html += "    <div class='infoBlock'>";
    html += "      <div class='nameRow'>";
    html += "        <div class='nameBig'>" + esc(apoderadoName || "—") + "</div>";
    html += "        <div class='statusPill'>" + esc((enr && enr.status) ? enr.status : "approved") + "</div>";
    html += "      </div>";
    html += "      <div class='emailLine'><a href='mailto:" + esc(email) + "'>" + esc(email) + "</a></div>";

    html += "      <div class='formGrid'>";
    html += "        <div class='field'>";
    html += "          <div class='label'>Nombre</div>";
    html += "          <input id='inpName' class='input' placeholder='Nombre y apellido' value='" + esc(apoderadoName) + "'/>";
    html += "        </div>";
    html += "        <div class='field'>";
    html += "          <div class='label'>Teléfono</div>";
    html += "          <input id='inpPhone' class='input' placeholder='+56 9 1234 5678' value='" + esc(phone) + "'/>";
    html += "        </div>";
    html += "        <div class='field'>";
    html += "          <div class='label'>Alumno/a</div>";
    html += "          <input id='inpAlumno' class='input' placeholder='Nombre del alumno' value='" + esc(alumnoName) + "'/>";
    html += "        </div>";
    html += "      </div>";

    html += "      <div class='actionsRow'>";
    html += "        <button class='btnPrimary' id='btnSave' type='button'>Guardar cambios</button>";
    html += "        <button class='btn' id='btnSwitchRole' type='button'>Cambiar rol</button>";
    html += "      </div>";
    html += "      <div class='muted' id='saveMsg' style='margin-top:10px;display:none'></div>";
    html += "    </div>";

    html += "  </div>";
    html += "</div>";

    // ---- CURSO ACTUAL ----
    html += "<div class='card profileCard' style='margin:16px'>";
    html += "  <div class='cardTitleRow'><div class='cardTitle'>Curso actual</div>";
    html += "    <div class='chip'>" + esc(courseLabel || "—") + "</div>";
    html += "  </div>";
    html += "  <div class='kvList'>";
    html += "    <div class='kvRow'><div class='kvKey'>Curso</div><div class='kvVal'>" + esc(curso) + "</div></div>";
    html += "    <div class='kvRow'><div class='kvKey'>Jornada</div><div class='kvVal'>" + esc(jornada) + "</div></div>";
    html += "    <div class='kvRow'><div class='kvKey'>Año</div><div class='kvVal'>" + esc(year) + "</div></div>";
    html += "    <div class='kvRow'><div class='kvKey'>Fecha ingreso</div><div class='kvVal'>" + esc(fmtDate(enr && enr.createdAt)) + "</div></div>";
    html += "  </div>";
    html += "</div>";

    // ---- ROLES ----
    html += "<div class='card profileCard' style='margin:16px'>";
    html += "  <div class='cardTitleRow'><div class='cardTitle'>Roles</div><div class='chip'>Activo: <b>" + esc(activeRole) + "</b></div></div>";
    html += "  <div class='kvList'>";
    html += "    <div class='kvRow'><div class='kvKey'>Disponibles</div><div class='kvVal'>" + esc(roles.join(", ")) + "</div></div>";
    html += "    <div class='kvRow'><div class='kvKey'>Estado</div><div class='kvVal'>" + esc((enr && enr.status) ? enr.status : "approved") + "</div></div>";
    html += "  </div>";
    html += "</div>";

    // ---- PREMIUM ----
    html += "<div class='card premiumCard' style='margin:16px'>";
    html += "  <div class='premiumRow'>";
    html += "    <div>";
    html += "      <div class='premiumTitle'>Desbloquea Cursapp Premium</div>";
    html += "      <div class='premiumText'>Reportes avanzados, recordatorios automáticos, control de rendiciones y soporte prioritario.</div>";
    html += "    </div>";
    html += "    <button class='btn premiumBtn' type='button' id='btnPremium'>Ver Premium</button>";
    html += "  </div>";
    html += "</div>";
root.innerHTML = html;
    dbgSet("UI pintada");

    // ---------- events ----------
    function showMsg(text) {
      try {
        var m = document.getElementById("saveMsg");
        if (!m) return;
        m.style.display = "block";
        m.textContent = text;
      } catch (e7) {}
    }

    // save changes
    var btnSave = document.getElementById("btnSave");
    if (btnSave) {
      btnSave.onclick = function () {
        try {
          var n = (document.getElementById("inpName") || {}).value || "";
          var p = (document.getElementById("inpPhone") || {}).value || "";
          var a = (document.getElementById("inpAlumno") || {}).value || "";

          // update enrollment
          var changed = false;
          var list = getEnrollments();
          for (var k = 0; k < list.length; k++) {
            var ee = list[k];
            if (!ee) continue;
            if (courseKey && ee.courseKey && ee.courseKey !== courseKey) continue;
            if (email && ee.email && String(ee.email).toLowerCase() === String(email).toLowerCase()) {
              ee.apoderadoName = n;
              ee.phone = p;
              ee.alumno = a;
              changed = true;
            }
          }
          if (changed) {
            writeLS("cursapp_enrollments_v1", JSON.stringify(list));
          }

          // update directiva mapping for current role if exists
          var d = getDirectivaByRole();
          if (d && d[activeRole]) {
            d[activeRole].apoderadoName = n;
            d[activeRole].alumno = a;
            writeLS("cursapp_directiva_apoderado_by_role_v1", JSON.stringify(d));
          }

          showMsg("✅ Cambios guardados.");
          dbgSet("guardado OK");
        } catch (e8) {
          showMsg("❌ No se pudo guardar: " + (e8 && e8.message ? e8.message : String(e8)));
          dbgSet("error guardando");
        }
      };
    }

    // clear photos
    var btnClear = document.getElementById("btnClearPhotos");
    if (btnClear) {
      btnClear.onclick = function () {
        clearAvatars(profileId, courseKey);
        showMsg("✅ Fotos restablecidas (recarga la página).");
        dbgSet("fotos limpiadas");
      };
    }

    // switch role (usa switchRole.js si está)
    var btnSwitch = document.getElementById("btnSwitchRole");
    if (btnSwitch) {
      btnSwitch.onclick = function () {
        try {
          if (window.CURSAPP && typeof window.CURSAPP.openRolePicker === "function") {
            window.CURSAPP.openRolePicker();
            return;
          }
          if (typeof window.openRolePicker === "function") {
            window.openRolePicker();
            return;
          }
          // fallback: ir al dashboard y usar menú
          alert("Puedes cambiar rol desde el menú (≡).");
        } catch (e9) {
          alert("No se pudo abrir selector de rol.");
        }
      };
    }

    
    // premium CTA
    var btnPrem = document.getElementById("btnPremium");
    if (btnPrem) {
      btnPrem.onclick = function () {
        try {
          alert("Cursapp Premium: próximamente. Aquí mostraremos planes y beneficios.");
        } catch (eP) {}
      };
    }

// avatar uploads
    function bindAvatar(inputId, kind) {
      var inp = document.getElementById(inputId);
      if (!inp) return;
      inp.onchange = function (ev) {
        try {
          var f = inp.files && inp.files[0] ? inp.files[0] : null;
          if (!f) return;

          showMsg("Procesando foto…");
          dbgSet("procesando foto " + kind);

          compressToDataURL(f, 320, 320, 0.78, function (dataUrl) {
            if (!dataUrl) {
              showMsg("❌ No se pudo procesar la imagen.");
              return;
            }
            // try save, if too big reduce
            if (dataUrl.length > 450000) {
              compressToDataURL(f, 240, 240, 0.70, function (smaller) {
                if (!smaller || smaller.length > 450000) {
                  showMsg("❌ Imagen muy pesada. Usa una foto más liviana.");
                  return;
                }
                var ok2 = setAvatar(kind, profileId, courseKey, smaller);
                if (!ok2) { showMsg("❌ No se pudo guardar la foto."); return; }
                showMsg("✅ Foto guardada. Recarga la página.");
              });
              return;
            }
            var ok = setAvatar(kind, profileId, courseKey, dataUrl);
            if (!ok) { showMsg("❌ No se pudo guardar la foto."); return; }
            showMsg("✅ Foto guardada. Recarga la página.");
          });
        } catch (e10) {
          showMsg("❌ Error cargando foto.");
        }
      };
    }
    bindAvatar("apoFile", "apoderado");
    bindAvatar("aluFile", "alumno");
  }

  function safeStart() {
    try { dbgSet("DOMContentLoaded"); render(); }
    catch (e) {
      dbgSet("error: " + (e && e.message ? e.message : "unknown"));
      try { if (hasDbg()) alert("ERROR PERFIL: " + (e && (e.stack || e.message) ? (e.stack || e.message) : String(e))); } catch (e2) {}
      try {
        var root = document.getElementById("perfilRoot") || document.body;
        var msg = (e && (e.stack || e.message)) ? (e.stack || e.message) : String(e);
        root.innerHTML = "<div style='max-width:520px;margin:24px auto;padding:16px;border:1px solid rgba(0,0,0,.08);border-radius:16px;background:#fff'>" +
          "<div style='font-weight:800;font-size:16px;margin-bottom:6px'>No se pudo cargar Mi perfil</div>" +
          "<div style='opacity:.75;margin-bottom:10px'>Ocurrió un error en el script del perfil.</div>" +
          "<div style='font-size:12px;white-space:pre-wrap;background:#f7f7f8;border-radius:12px;padding:10px;border:1px solid rgba(0,0,0,.06)'>" + esc(msg) + "</div>" +
          "</div>";
      } catch (e3) {}
    }
  }

  // Start
  try {
    window.addEventListener("error", function (ev) {
      try {
        var m = (ev && ev.message) ? ev.message : "JS error";
        var u = (ev && ev.filename) ? ev.filename : "";
        var ln = (ev && ev.lineno) ? ev.lineno : "";
        var col = (ev && ev.colno) ? ev.colno : "";
        dbgSet("JS ERROR: " + m + " @ " + u + ":" + ln + ":" + col);
        if (hasDbg()) alert("JS ERROR: " + m + " @ " + u + ":" + ln + ":" + col);
      } catch (e) {}
    });
  } catch (e) {}

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", safeStart);
  } else {
    safeStart();
  }
})();
