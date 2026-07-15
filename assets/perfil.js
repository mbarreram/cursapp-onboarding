/*
  Cursapp · Perfil Supabase-first
  - usuarios es la fuente oficial de nombre, correo y telefono.
  - miembros_curso define el contexto de rol y alumno seleccionado.
  - preferencias_notificaciones persiste la configuracion del usuario.
  - localStorage se usa solo para sesion/navegacion y nunca como fuente del perfil.
*/
(function () {
  "use strict";

  var state = {
    loading: true,
    error: "",
    session: null,
    identity: null,
    user: null,
    course: null,
    members: [],
    member: null,
    prefs: null
  };
  var navBound = false;

  function qs(selector) { return document.querySelector(selector); }
  function qsa(selector) { return Array.prototype.slice.call(document.querySelectorAll(selector)); }
  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
  function readJSON(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) { return fallback; }
  }
  function writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
  }
  function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || ""));
  }
  function norm(value) {
    try {
      return String(value || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ");
    } catch (_) { return String(value || "").trim().toLowerCase(); }
  }
  function eq(value) { return "eq." + encodeURIComponent(String(value == null ? "" : value)); }
  function fmtDate(value) {
    if (!value) return "—";
    try {
      var date = new Date(value);
      if (isNaN(date.getTime())) return "—";
      return date.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" });
    } catch (_) { return "—"; }
  }
  function titleCase(value) {
    var text = String(value || "").trim();
    return text ? text.charAt(0).toUpperCase() + text.slice(1) : "";
  }
  function initials(value) {
    var text = String(value || "C").trim().split("@")[0].replace(/[._-]+/g, " ");
    var parts = text.split(/\s+/).filter(Boolean);
    if (!parts.length) return "C";
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
  }
  function decodeJwtPayload(token) {
    try {
      var part = String(token || "").split(".")[1] || "";
      part = part.replace(/-/g, "+").replace(/_/g, "/");
      while (part.length % 4) part += "=";
      return JSON.parse(decodeURIComponent(Array.prototype.map.call(atob(part), function (c) {
        return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
      }).join("")));
    } catch (_) { return {}; }
  }

  function getSession() {
    var session = readJSON("cursapp_session_v1", null);
    if (session && (session.userId || session.email)) return session;
    session = readJSON("cursapp_demo_user", null);
    return session && (session.userId || session.email) ? session : null;
  }
  function getAuthIdentity(session) {
    var auth = readJSON("cursapp_supabase_auth_session_v1", null) || readJSON("cursapp_supabase_oauth_v1", null) || {};
    if (auth.currentSession) auth = auth.currentSession;
    var authUser = auth.user || {};
    var payload = decodeJwtPayload(auth.access_token || "");
    var id = authUser.id || payload.sub || (session && isUuid(session.userId) ? session.userId : "");
    var email = authUser.email || payload.email || (session && (session.email || (String(session.userId || "").indexOf("@") >= 0 ? session.userId : ""))) || "";
    return { id: String(id || ""), email: String(email || ""), accessToken: String(auth.access_token || "") };
  }
  function activeCourseKey(session) {
    return String((session && (session.courseKey || session.course_key)) || localStorage.getItem("cursapp_active_course_v1") || "").trim();
  }
  function selectedContext(session) {
    var alumno = readJSON("cursapp_alumno_activo_v1", {}) || {};
    var activeProfile = readJSON("cursapp_active_profile_v1", {}) || {};
    if (typeof activeProfile !== "object") activeProfile = {};
    return {
      memberId: String(alumno.miembroId || alumno.miembro_id || activeProfile.miembroId || activeProfile.miembro_id || (session && session.activeMiembro) || localStorage.getItem("cursapp_active_miembro_id_v1") || "").trim(),
      enrollmentId: String(alumno.enrollmentId || activeProfile.enrollmentId || localStorage.getItem("cursapp_active_enrollment_v1") || "").trim(),
      student: String(alumno.alumno || alumno.nombre || alumno.name || activeProfile.alumno || activeProfile.nombre_alumno || (session && session.alumno) || "").trim()
    };
  }
  async function sb(path, options) {
    if (!window.CURSAPP_SUPABASE || typeof window.CURSAPP_SUPABASE.request !== "function") {
      throw new Error("No se pudo iniciar la conexion con Supabase.");
    }
    var data = await window.CURSAPP_SUPABASE.request(path, options || {});
    return Array.isArray(data) ? data : (data ? [data] : []);
  }
  function selectMember(members, session) {
    if (!members.length) return null;
    var context = selectedContext(session || {});
    var role = norm((session && (session.currentRole || session.role || session.activeRole)) || "");
    var i;
    if (context.memberId) {
      for (i = 0; i < members.length; i++) if (String(members[i].id || "") === context.memberId) return members[i];
    }
    if (context.enrollmentId) {
      for (i = 0; i < members.length; i++) if (String(members[i].id || "") === context.enrollmentId) return members[i];
    }
    if (context.student) {
      for (i = 0; i < members.length; i++) if (norm(members[i].nombre_alumno) === norm(context.student)) return members[i];
    }
    if (role) {
      for (i = 0; i < members.length; i++) if (norm(members[i].rol) === role) return members[i];
    }
    return members[0];
  }
  function defaultPrefs() {
    return { chat: true, mercado: true, cuotas: true, pagos: true, "campañas": true, avisos: true, tickets: true, push: true, email: true, whatsapp: false };
  }

  async function load() {
    state.loading = true;
    state.error = "";
    render();
    try {
      state.session = getSession();
      if (!state.session) throw new Error("No hay una sesion activa.");
      state.identity = getAuthIdentity(state.session);
      if (!isUuid(state.identity.id)) throw new Error("La sesion no contiene una identidad valida de Supabase. Vuelve a iniciar sesion.");

      var users = await sb("usuarios?select=id,email,nombre,telefono,estado&id=" + eq(state.identity.id) + "&limit=1");
      if (!users[0]) throw new Error("No se encontro el perfil autenticado en Supabase.");
      state.user = users[0];

      var courseKey = activeCourseKey(state.session);
      var courses = courseKey ? await sb("cursos?select=*,colegios(*)&course_key=" + eq(courseKey) + "&limit=1") : [];
      state.course = courses[0] || null;

      var memberPath = "miembros_curso?select=*&usuario_id=" + eq(state.identity.id) + "&order=created_at.asc";
      if (state.course && state.course.id) memberPath += "&curso_id=" + eq(state.course.id);
      state.members = await sb(memberPath);
      state.member = selectMember(state.members, state.session);

      var prefs = await sb("preferencias_notificaciones?select=*&usuario_id=" + eq(state.identity.id) + "&limit=1");
      state.prefs = Object.assign(defaultPrefs(), prefs[0] || {});
      state.loading = false;
      render();
    } catch (error) {
      state.loading = false;
      state.error = error && error.message ? error.message : String(error);
      render();
    }
  }

  function courseInfo() {
    var course = state.course || {};
    var school = course.colegios || {};
    var courseName = [course.nivel || "", course.letra || ""].filter(Boolean).join("").trim() || course.nombre || "—";
    return {
      school: school.nombre || "—",
      course: courseName,
      year: course.anio || "—",
      schedule: course.jornada || "—"
    };
  }
  function currentRole() {
    return norm((state.member && state.member.rol) || (state.session && (state.session.currentRole || state.session.role)) || "usuario");
  }
  function statusLabel() {
    var status = norm((state.member && state.member.estado) || (state.user && state.user.estado) || "activo");
    if (["aprobado", "approved", "activo", "active"].indexOf(status) >= 0) return "Aprobado";
    return titleCase(status || "Activo");
  }
  function preferenceRow(key, title, help) {
    var checked = state.prefs && state.prefs[key] !== false ? " checked" : "";
    return "<label class='profilePrefRow'><span><b>" + esc(title) + "</b><small>" + esc(help) + "</small></span><input type='checkbox' data-pref='" + esc(key) + "'" + checked + "></label>";
  }
  function paintHeader() {
    var logo = qs("#hdrLogo") || qs("#avatar");
    var title = qs("#roleTitle");
    var sub = qs("#perfilSubline");
    var info = courseInfo();
    var name = state.user && state.user.nombre ? state.user.nombre : (state.user && state.user.email ? state.user.email : "Cursapp");
    if (logo) logo.textContent = initials(name);
    if (title) title.textContent = "Mi perfil";
    if (sub) sub.textContent = [info.school, info.course].filter(function (x) { return x && x !== "—"; }).join(" · ") || "—";
  }
  function render() {
    var root = qs("#perfilContent");
    if (!root) return;
    if (state.loading) {
      root.innerHTML = "<div class='profileState card'><div class='profileSpinner'></div><b>Cargando perfil desde Supabase…</b></div>";
      return;
    }
    if (state.error) {
      root.innerHTML = "<div class='profileState card profileError'><b>No pudimos cargar tu perfil</b><p>" + esc(state.error) + "</p><button id='pfRetry' class='btnPrimary'>Reintentar</button></div>";
      var retry = qs("#pfRetry");
      if (retry) retry.addEventListener("click", load);
      return;
    }

    paintHeader();
    if (!navBound) {
      bindNavigation(state.session || {});
      navBound = true;
    }

    var user = state.user || {};
    var member = state.member || {};
    var info = courseInfo();
    var role = currentRole();
    var roles = [];
    state.members.forEach(function (item) {
      var value = norm(item.rol);
      if (value && roles.indexOf(value) < 0) roles.push(value);
    });
    var rolesHuman = roles.length ? roles.map(titleCase).join(", ") : titleCase(role);

    root.innerHTML = ""
      + "<section class='card profileCard' data-profile-source='supabase'>"
      + "<div class='profileTitleRow'><div><div class='h2'>Informacion personal</div><div class='muted'>Datos guardados en Supabase</div></div><span class='pill'>Rol activo: <b>" + esc(titleCase(role)) + "</b></span></div>"
      + "<div class='profileIdentity'><div class='profileAvatar'>" + esc(initials(user.nombre || user.email)) + "</div><div><div class='h3'>" + esc(user.nombre || "—") + "</div><a href='mailto:" + esc(user.email || "") + "'>" + esc(user.email || "—") + "</a></div></div>"
      + "<label class='profileField'><span>Nombre completo</span><input id='pfName' class='input' value='" + esc(user.nombre || "") + "' autocomplete='name'></label>"
      + "<label class='profileField'><span>Telefono</span><input id='pfPhone' class='input' value='" + esc(user.telefono || "") + "' autocomplete='tel' placeholder='+56 9 1234 5678'></label>"
      + (member.nombre_alumno ? "<label class='profileField'><span>Alumno/a seleccionado</span><input id='pfAlumno' class='input' value='" + esc(member.nombre_alumno) + "' readonly aria-readonly='true'><small>Este dato pertenece a la inscripcion del curso.</small></label>" : "")
      + "<div class='profileActions'><button id='pfSave' class='btnPrimary'>Guardar cambios</button><button id='pfChangeRole' class='btnGhost'>Cambiar rol</button></div>"
      + "<div id='pfPersonalMessage' class='profileMessage' aria-live='polite'></div>"
      + "</section>"

      + "<section class='card profileCard'><div class='profileTitleRow'><div><div class='h2'>Curso actual</div><div class='muted'>Contexto asociado a tu sesion</div></div><span class='pill'>" + esc(info.school) + "</span></div>"
      + "<div class='profileKv'><span>Curso</span><b>" + esc(info.course) + "</b><span>Jornada</span><b>" + esc(info.schedule) + "</b><span>Año</span><b>" + esc(info.year) + "</b><span>Fecha de ingreso</span><b>" + esc(fmtDate(member.created_at)) + "</b><span>Roles disponibles</span><b>" + esc(rolesHuman) + "</b><span>Estado</span><b>" + esc(statusLabel()) + "</b></div></section>"

      + "<section class='card profileCard'><div class='profileTitleRow'><div><div class='h2'>Notificaciones</div><div class='muted'>Preferencias sincronizadas entre dispositivos</div></div></div>"
      + preferenceRow("pagos", "Pagos", "Confirmaciones y movimientos de pagos")
      + preferenceRow("cuotas", "Cuotas", "Vencimientos y recordatorios")
      + preferenceRow("campañas", "Campañas", "Nuevas campañas y cambios")
      + preferenceRow("avisos", "Avisos del curso", "Comunicaciones de la directiva")
      + preferenceRow("tickets", "Soporte", "Actualizaciones de tus tickets")
      + preferenceRow("push", "Notificaciones push", "Alertas en este dispositivo")
      + preferenceRow("email", "Correo electronico", "Recibir una copia por correo")
      + preferenceRow("whatsapp", "WhatsApp", "Mensajes cuando el canal este habilitado")
      + "<button id='pfPrefsSave' class='btnPrimary profileWideButton'>Guardar preferencias</button><div id='pfPrefsMessage' class='profileMessage' aria-live='polite'></div></section>"

      + "<section class='card profileCard'><div class='profileTitleRow'><div><div class='h2'>Seguridad</div><div class='muted'>La contraseña se actualiza mediante Supabase Auth</div></div></div>"
      + "<button id='pfPasswordOpen' class='btnGhost profileWideButton'>Cambiar contraseña</button>"
      + "<div id='pfPasswordPanel' class='profilePasswordPanel' hidden>"
      + "<label class='profileField'><span>Contraseña actual</span><input id='pfCurrentPassword' class='input' type='password' autocomplete='current-password'></label>"
      + "<label class='profileField'><span>Nueva contraseña</span><input id='pfNewPassword' class='input' type='password' autocomplete='new-password' minlength='8'></label>"
      + "<label class='profileField'><span>Repetir nueva contraseña</span><input id='pfConfirmPassword' class='input' type='password' autocomplete='new-password' minlength='8'></label>"
      + "<div class='profileActions'><button id='pfPasswordSave' class='btnPrimary'>Actualizar contraseña</button><button id='pfPasswordCancel' class='btnGhost'>Cancelar</button></div><div id='pfPasswordMessage' class='profileMessage' aria-live='polite'></div></div></section>";

    bindActions();
  }

  function setMessage(selector, message, isError) {
    var element = qs(selector);
    if (!element) return;
    element.textContent = message || "";
    element.className = "profileMessage" + (isError ? " error" : " success");
  }
  async function savePersonal() {
    var button = qs("#pfSave");
    var name = String((qs("#pfName") && qs("#pfName").value) || "").trim();
    var phone = String((qs("#pfPhone") && qs("#pfPhone").value) || "").trim();
    if (!name) { setMessage("#pfPersonalMessage", "Ingresa tu nombre completo.", true); return; }
    button.disabled = true;
    setMessage("#pfPersonalMessage", "Guardando…", false);
    try {
      var rows = await sb("usuarios?id=" + eq(state.identity.id), { method: "PATCH", body: JSON.stringify({ nombre: name, telefono: phone }) });
      state.user = rows[0] || Object.assign({}, state.user, { nombre: name, telefono: phone });
      state.session.name = state.user.nombre;
      state.session.phone = state.user.telefono || "";
      writeJSON("cursapp_session_v1", state.session);
      render();
      setMessage("#pfPersonalMessage", "Cambios guardados en Supabase.", false);
    } catch (error) {
      setMessage("#pfPersonalMessage", error.message || "No se pudieron guardar los cambios.", true);
    } finally { if (button && document.body.contains(button)) button.disabled = false; }
  }
  async function savePreferences() {
    var button = qs("#pfPrefsSave");
    var body = { usuario_id: state.identity.id, updated_at: new Date().toISOString() };
    qsa("[data-pref]").forEach(function (input) { body[input.getAttribute("data-pref")] = Boolean(input.checked); });
    button.disabled = true;
    setMessage("#pfPrefsMessage", "Guardando…", false);
    try {
      var rows = await sb("preferencias_notificaciones?on_conflict=usuario_id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=representation" }, body: JSON.stringify(body) });
      state.prefs = Object.assign(defaultPrefs(), rows[0] || body);
      setMessage("#pfPrefsMessage", "Preferencias guardadas en Supabase.", false);
    } catch (error) {
      setMessage("#pfPrefsMessage", error.message || "No se pudieron guardar las preferencias.", true);
    } finally { button.disabled = false; }
  }
  async function updatePassword() {
    var currentPassword = String((qs("#pfCurrentPassword") && qs("#pfCurrentPassword").value) || "");
    var newPassword = String((qs("#pfNewPassword") && qs("#pfNewPassword").value) || "");
    var confirmation = String((qs("#pfConfirmPassword") && qs("#pfConfirmPassword").value) || "");
    if (!currentPassword) { setMessage("#pfPasswordMessage", "Ingresa tu contraseña actual.", true); return; }
    if (newPassword.length < 8) { setMessage("#pfPasswordMessage", "La nueva contraseña debe tener al menos 8 caracteres.", true); return; }
    if (newPassword !== confirmation) { setMessage("#pfPasswordMessage", "Las contraseñas nuevas no coinciden.", true); return; }
    var button = qs("#pfPasswordSave");
    button.disabled = true;
    setMessage("#pfPasswordMessage", "Actualizando…", false);
    try {
      var result = null;
      if (window.cursappSupabase && window.cursappSupabase.auth && typeof window.cursappSupabase.auth.updateUser === "function") {
        result = await window.cursappSupabase.auth.updateUser({ password: newPassword, current_password: currentPassword });
        if (result && result.error) throw result.error;
      } else {
        var token = await window.CURSAPP_SUPABASE.getAccessToken();
        var response = await fetch(window.CURSAPP_SUPABASE.url + "/auth/v1/user", { method: "PUT", headers: { apikey: window.CURSAPP_SUPABASE.publishableKey, Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: JSON.stringify({ password: newPassword, current_password: currentPassword }) });
        var text = await response.text();
        var data = null;
        try { data = text ? JSON.parse(text) : null; } catch (_) { data = null; }
        if (!response.ok) throw new Error((data && (data.message || data.error_description || data.error)) || text || "No se pudo actualizar la contraseña.");
      }
      qs("#pfCurrentPassword").value = "";
      qs("#pfNewPassword").value = "";
      qs("#pfConfirmPassword").value = "";
      setMessage("#pfPasswordMessage", "Contraseña actualizada correctamente.", false);
    } catch (error) {
      setMessage("#pfPasswordMessage", error.message || "No se pudo actualizar la contraseña.", true);
    } finally { button.disabled = false; }
  }
  function openRolePicker() {
    if (typeof window.openRoleModal === "function") { window.openRoleModal(); return; }
    alert("Cambia el rol desde el menu principal.");
  }
  function bindActions() {
    var save = qs("#pfSave"); if (save) save.addEventListener("click", savePersonal);
    var prefs = qs("#pfPrefsSave"); if (prefs) prefs.addEventListener("click", savePreferences);
    var changeRole = qs("#pfChangeRole"); if (changeRole) changeRole.addEventListener("click", openRolePicker);
    var openPassword = qs("#pfPasswordOpen"); if (openPassword) openPassword.addEventListener("click", function () { qs("#pfPasswordPanel").hidden = false; openPassword.hidden = true; });
    var cancelPassword = qs("#pfPasswordCancel"); if (cancelPassword) cancelPassword.addEventListener("click", function () { qs("#pfPasswordPanel").hidden = true; qs("#pfPasswordOpen").hidden = false; setMessage("#pfPasswordMessage", "", false); });
    var savePassword = qs("#pfPasswordSave"); if (savePassword) savePassword.addEventListener("click", updatePassword);
  }
  function bindNavigation(session) {
    var role = norm((state.member && state.member.rol) || session.currentRole || session.role || "");
    var rolePages = { presidente: "presidente.html", apoderado: "apoderado.html", tesorero: "tesorero.html", admin: "admin-console/admin.html", administrador: "admin-console/admin.html" };
    function go(tab) {
      var next = tab === "inicio" ? "home" : tab;
      if (role === "apoderado" && (next === "campanas" || next === "deudores")) next = "payments";
      if (window.CURSAPP && typeof window.CURSAPP.setNextNavTab === "function") window.CURSAPP.setNextNavTab(next);
      location.assign(rolePages[role] || "presidente.html");
    }
    qsa(".navItem").forEach(function (button) { button.addEventListener("click", function () { go(button.getAttribute("data-tab") || "inicio"); }); });
  }
  function injectStyles() {
    if (qs("#profileSupabaseStyles")) return;
    var style = document.createElement("style");
    style.id = "profileSupabaseStyles";
    style.textContent = ".profileCard{padding:20px;margin-bottom:16px}.profileTitleRow{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:18px}.h2{font-size:20px;font-weight:900}.h3{font-size:18px;font-weight:900}.profileIdentity{display:flex;align-items:center;gap:14px;padding:14px;border-radius:18px;background:linear-gradient(135deg,rgba(124,58,237,.08),rgba(37,99,235,.05));margin-bottom:16px}.profileIdentity a{font-size:13px;color:#64748b}.profileAvatar{width:54px;height:54px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(135deg,#7c3aed,#4f46e5);color:#fff;font-size:19px;font-weight:900}.profileField{display:block;margin-top:13px}.profileField>span{display:block;font-size:13px;color:#64748b;font-weight:800;margin-bottom:6px}.profileField small{display:block;color:#94a3b8;margin-top:5px}.input{width:100%;padding:12px 14px;border-radius:14px;border:1px solid #e2e8f0;background:#fff;font-size:16px;outline:none;box-sizing:border-box}.input:focus{border-color:#7c3aed;box-shadow:0 0 0 3px rgba(124,58,237,.12)}.input[readonly]{background:#f8fafc;color:#64748b}.profileActions{display:flex;gap:10px;flex-wrap:wrap;margin-top:16px}.btnPrimary,.btnGhost{min-height:44px;padding:11px 16px;border-radius:14px;font-weight:850;cursor:pointer}.btnPrimary{border:0;background:linear-gradient(135deg,#7c3aed,#5b21b6);color:#fff}.btnGhost{border:1px solid #ddd6fe;background:#fff;color:#6d28d9}.btnPrimary:disabled,.btnGhost:disabled{opacity:.55;cursor:wait}.profileKv{display:grid;grid-template-columns:minmax(120px,1fr) minmax(130px,1.2fr);gap:12px}.profileKv span{color:#64748b;font-weight:750}.profileKv b{text-align:right;color:#0f172a}.profilePrefRow{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:13px 0;border-bottom:1px solid #eef2f7}.profilePrefRow span{display:flex;flex-direction:column;gap:3px}.profilePrefRow small{color:#64748b}.profilePrefRow input{width:22px;height:22px;accent-color:#7c3aed}.profileWideButton{width:100%;margin-top:16px}.profilePasswordPanel{margin-top:14px;padding-top:2px}.profileMessage{min-height:20px;margin-top:10px;font-size:13px;font-weight:750}.profileMessage.success{color:#15803d}.profileMessage.error{color:#dc2626}.profileState{text-align:center;padding:36px 20px}.profileState p{color:#64748b}.profileSpinner{width:32px;height:32px;margin:0 auto 12px;border:3px solid #ede9fe;border-top-color:#7c3aed;border-radius:50%;animation:profileSpin .8s linear infinite}@keyframes profileSpin{to{transform:rotate(360deg)}}@media(max-width:600px){.profileTitleRow{flex-direction:column}.profileTitleRow .pill{align-self:flex-start}.profileKv{grid-template-columns:1fr auto}.profileCard{padding:17px}}";
    document.head.appendChild(style);
  }

  try { injectStyles(); } catch (_) {}
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", load);
  else load();
})();
