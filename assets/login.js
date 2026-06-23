/* =========================================================
   Cursapp · Login (rewrite: perfil activo + multi-rol)
   Objetivos:
   - Un usuario puede tener múltiples perfiles (apoderado / presidente / tesorero) por curso.
   - La sesión SIEMPRE se amarra a un profileId (perfil activo).
   - Selector de curso si hay múltiples courseKey.
   - Selector de rol si en el mismo courseKey existen varios roles.
   - Apoderado requiere enrollment approved (por curso), EXCEPTO si el usuario también es presidente en ese curso (auto).
   - Mantiene accesos demo: presidente/tesorero con pass demo.
   ========================================================= */

const esc = (s) =>
  String(s ?? "").replace(/[&<>'"]/g, (c) =>
    ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" }[c])
  );

(function () {

  // --- mostrar errores runtime en UI (evita "no hace nada") ---
  window.addEventListener("error", (ev) => {
    try {
      const msg = ev && ev.message ? ev.message : "Error inesperado";
      const box = document.getElementById("loginError");
      if (box) {
        box.style.display = "block";
        box.textContent = "Error JS: " + msg;
      }
    } catch (_) {}
  });

  const form = document.getElementById("loginForm");
  const username = document.getElementById("username");
  const password = document.getElementById("password");
  const loginError = document.getElementById("loginError");

  // Keys
  const KEY_USERS = "cursapp_users_v1";
  const KEY_PROFILES = "cursapp_profiles_v1";
  const KEY_ACTIVE_COURSE = "cursapp_active_course_v1";
  const KEY_ACTIVE_PROFILE = "cursapp_active_profile_v1";
  const KEY_ENROLL = "cursapp_enrollments_v1";
  const KEY_SESSION = "cursapp_session_v1";
  const KEY_DEMO_USER = "cursapp_demo_user";
  const KEY_ACTIVE_ENROLL = "cursapp_active_enrollment_v1";
  const KEY_REF_AGENTS = "cursapp_ref_agents_v1";
  const KEY_AGENT_SESSION = "cursapp_agent_session_v1";

  const KEY_ROLES_AVAILABLE = "cursapp_roles_v1";
  const KEY_ACTIVE_ROLE = "cursapp_active_role_v1";
  const KEY_DIRECTIVA_BY_ROLE = "cursapp_directiva_apoderado_by_role_v1";
  // ===== storage helpers =====

  // --- DEBUG LOGIN (alerts) ---
  const LOGIN_JS_VERSION = "420-debug-alumno";
  const DEBUG_LOGIN = (() => {
    try {
      const qs = new URLSearchParams(window.location.search || "");
      if (qs.get("debug") === "1") { try{ localStorage.setItem("cursapp_debug_presidente","1"); }catch(e){} return true; }
      const v = localStorage.getItem("cursapp_debug_login");
      return v === "1" || v === "true";
    } catch (e) {
      return false;
    }
  })();

  function dbgAlert(title, data) {
    if (!DEBUG_LOGIN) return;
    try {
      const body = (typeof data === "string") ? data : JSON.stringify(data, null, 2);
      alert(`[Cursapp Login DEBUG v${LOGIN_JS_VERSION}] ${title}\n\n${body}`);
    } catch (e) {
      alert(`[Cursapp Login DEBUG v${LOGIN_JS_VERSION}] ${title}`);
    }
  }


    if (DEBUG_LOGIN) { try { alert(`[Cursapp Login DEBUG] login.js cargado (v${LOGIN_JS_VERSION})`); } catch(e){} }

function loadJSON(k, def) {
    try {
      const v = localStorage.getItem(k);
      if (v == null) return def;
      return JSON.parse(v);
    } catch (e) {
      return def;
    }
  }
  function saveJSON(k, v) { localStorage.setItem(k, JSON.stringify(v)); }

  // ===== roles helpers (directiva by role) =====
  function _normEmail(e){ return String(e||"").trim().toLowerCase(); }

  function hasRoleInDirectiva(userEmail, courseKey, roleName){
    try{
      const email = _normEmail(userEmail);
      const role = String(roleName||"").toLowerCase();
      const d = loadJSON(KEY_DIRECTIVA_BY_ROLE, null);
      if(!d) return false;

      // Recorrer estructura buscando coincidencia por rol + email (+ courseKey si existe)
      const stack = [{node:d, path:[]}];
      while(stack.length){
        const cur = stack.pop();
        const node = cur.node;
        const path = cur.path;

        if(node && typeof node === "object"){
          // si el objeto tiene email
          const nodeEmail = _normEmail(node.email || node.userId || node.userEmail);
          const nodeCourse = String(node.courseKey || node.course || node.ck || "");
          const pathStr = path.join(".").toLowerCase();

          if(nodeEmail && nodeEmail === email){
            // si hay courseKey en nodo, debe calzar
            if(nodeCourse && courseKey && nodeCourse !== courseKey){
              // no match por curso
            } else {
              // match por rol: en path o en key 'role'
              const nodeRole = String(node.role || node.directivaRole || "").toLowerCase();
              if(nodeRole.includes(role) || pathStr.includes(role)) return true;
            }
          }

          if(Array.isArray(node)){
            for(let i=0;i<node.length;i++) stack.push({node:node[i], path: path.concat(String(i))});
          } else {
            for(const k in node){
              if(!Object.prototype.hasOwnProperty.call(node,k)) continue;
              stack.push({node: node[k], path: path.concat(k)});
            }
          }
        }
      }
      return false;
    }catch(e){
      return false;
    }
  }

  function showErr(msg) {
    if (loginError) {
      loginError.style.display = "block";
      loginError.textContent = msg;
    } else {
      alert(msg);
    }
  }
  function clearErr() {
    if (loginError) {
      loginError.style.display = "none";
      loginError.textContent = "";
    }
  }

  // demo hash used in onboarding
  function hashDemo(str) {
    let h = 5381;
    const s = String(str || "");
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h) + s.charCodeAt(i);
    return "h_" + (h >>> 0).toString(16);
  }


  function ensureDemoAgent(){
    const agents = loadJSON(KEY_REF_AGENTS, []);
    const demo = {
      id:"ag_demo_cursapp",
      name:"Agente Demo Cursapp",
      email:"agente@cursapp.cl",
      passwordHashDemo:hashDemo("123456"),
      code:"MAU2026",
      status:"active",
      createdAt:new Date().toISOString()
    };
    const exists = agents.find(a => String(a.email||"").toLowerCase() === "agente@cursapp.cl");
    if(!exists){
      agents.unshift(demo);
      saveJSON(KEY_REF_AGENTS, agents);
      return demo;
    }
    exists.passwordHashDemo = exists.passwordHashDemo || hashDemo("123456");
    exists.code = exists.code || "MAU2026";
    exists.status = exists.status || "active";
    saveJSON(KEY_REF_AGENTS, agents);
    return exists;
  }

  function setActiveCourseKey(k) {
    // v11 Supabase-first: se guarda por compatibilidad, pero la sesión es la fuente oficial.
    try { localStorage.removeItem(KEY_ACTIVE_COURSE); } catch(e) {}
    localStorage.setItem(KEY_ACTIVE_COURSE, String(k || ""));
  }
  function setActiveProfileId(id) { localStorage.setItem(KEY_ACTIVE_PROFILE, String(id || "")); }

  function setSession(session) {
    // session = { userId, profileId, role, courseKey, email? }
    // Guardamos también email (duplicado) para que menu.js y otras vistas
    // puedan detectar permisos de directiva (ej: tesorero) de forma confiable.
    const s = Object.assign({}, session);
    if (!s.email) s.email = s.userId || "";
    saveJSON(KEY_SESSION, s);
  }

  // Back-compat banner (some pages still read this)
  function setBanner(obj) { saveJSON(KEY_DEMO_USER, obj); }

  function buildCourseLabel(p) {
    const c = p.course || {};
    return `${c.schoolName || "Colegio"} · ${c.level || ""}${c.letter || ""} ${c.year || ""} · ${c.jornada || ""}`;
  }

  function profileIdOf(userEmail, p) {
    return String(p?.profileId || p?.id || (userEmail + "||" + (p?.courseKey || "") + "||" + (p?.role || "")));
  }

  // ===== enrollment helpers (FIX: sin loadEnrollments + llaves bien) =====
  function enrollments() { return loadJSON(KEY_ENROLL, []); }

  function findEnrollment(email, courseKey) {
    const e = String(email || "").trim().toLowerCase();
    const ck = String(courseKey || "");
    const list = enrollments()
      .filter(x =>
        String(x.email || "").trim().toLowerCase() === e &&
        String(x.courseKey || "") === ck
      )
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    return list[0] || null;
  }

  function findEnrollments(email, courseKey) {
    const e = String(email || "").trim().toLowerCase();
    const ck = String(courseKey || "");
    return enrollments().filter(x =>
      String(x.email || "").trim().toLowerCase() === e &&
      String(x.courseKey || "") === ck
    );
  }

  // ✅ regla: si es presidente en ese curso, el apoderado es auto-aprobado
  function canAutoApproveApoderado(rolesInCourse) {
    return rolesInCourse.includes("presidente");
  }

  function requireApproved(email, courseKey, rolesInCourse, profile) {
    // Supabase: si el miembro viene de BD y está aprobado/activo, no dependemos del enrollment local.
    try {
      if (profile && profile.fromSupabase) {
        const st = String(profile.status || "aprobado").toLowerCase();
        if (st === "pendiente" || st === "pending") {
          showErr("Tu solicitud está pendiente de aprobación por la directiva.");
          return false;
        }
        return true;
      }
    } catch(e) {}

    // bypass si es auto-aprobado por rol presidente
    if (canAutoApproveApoderado(rolesInCourse)) return true;

    const enr = findEnrollment(email, courseKey);
    if (!enr) {
      showErr("No existe una solicitud para este curso. Completa onboarding como apoderado para enviar tu solicitud.");
      return false;
    }
    if (enr.status !== "approved") {
      showErr("Tu solicitud está pendiente de aprobación por la directiva.");
      return false;
    }
    return true;
  }

  // ===== routing by role =====
  function go(role, userEmail, courseKey, profile) {
    const pid = profile ? profileIdOf(userEmail, profile) : "";
    try { if(window.CURSAPP && typeof window.CURSAPP.clearOperationalCache === "function") window.CURSAPP.clearOperationalCache(); } catch(e) {}
    setActiveCourseKey(courseKey || "");
    setActiveProfileId(pid || "");
        dbgAlert("Session BEFORE save", {
      email: userEmail,
      courseKey,
      role,
      profileId: pid,
      activeCourse_before: localStorage.getItem(KEY_ACTIVE_COURSE),
      course_v1: loadJSON("cursapp_course_v1", null),
      courses_v1: loadJSON("cursapp_courses_v1", [])
    });

    // Roles disponibles detectados en este login (y fallback seguro)
    let rolesAvail = [];
    try { rolesAvail = loadJSON(KEY_ROLES_AVAILABLE, []); } catch(e) { rolesAvail = []; }
    if (!Array.isArray(rolesAvail)) rolesAvail = [];
    rolesAvail = Array.from(new Set(rolesAvail.map(r => String(r || "").toLowerCase().trim()).filter(Boolean)));
    if (!rolesAvail.includes(String(role || "").toLowerCase().trim())) rolesAvail.push(String(role || "").toLowerCase().trim());

    setSession({
      userId: userEmail,
      email: userEmail,
      courseKey: courseKey || "",
      profileId: pid || "",

      // 🔒 Nuevo: roles y rol activo (mantiene compat con "role")
      roles: rolesAvail,
      currentRole: String(role || "apoderado").toLowerCase().trim(),
      role: String(role || "apoderado").toLowerCase().trim()
    });
    try { localStorage.setItem(KEY_ACTIVE_ROLE, role); } catch(e) {}

    dbgAlert("Session AFTER save", {
      activeCourse_after: localStorage.getItem(KEY_ACTIVE_COURSE),
      activeProfile_after: localStorage.getItem(KEY_ACTIVE_PROFILE),
      session_after: loadJSON(KEY_SESSION, null)
    });

    if (role === "apoderado" && profile) {
      const ap = profile.apoderado || {};
      setBanner({
        name: (ap.name || "Apoderado") + " (Demo)",
        role: "apoderado",
        alumno: ap.alumno || "Alumno",
        email: userEmail
      });
    } else {
      setBanner({
        name: (role === "presidente" ? "Presidente" : role === "tesorero" ? "Tesorero" : "Usuario") + " (Demo)",
        role,
        email: userEmail
      });
    }

    window.location.href = role + ".html";
  }

  // ===== UI: chooser (curso/rol/alumno) =====
  function renderChooser(title, subtitle, items, onPick) {
    // Fintech overlay chooser (roles / alumno)
    const old = document.getElementById("cursappPickerOverlay");
    if (old) old.remove();

    const wrap = document.createElement("div");
    wrap.id = "cursappPickerOverlay";
    wrap.className = "cpOverlay";

    wrap.innerHTML = `
      <div class="cpPanel" role="dialog" aria-modal="true">
        <div class="cpHandle" aria-hidden="true"></div>
        <div class="cpPanel__head">
          <div class="cpHeadIcon" aria-hidden="true">${items.some(x=>x.role) ? "👥" : "🎒"}</div>
          <div class="cpHeadText">
            <div class="cpTitle">${esc(title)}</div>
            <div class="cpSub">${esc(subtitle || "")}</div>
          </div>
          <button type="button" class="cpClose" aria-label="Cerrar" data-close>✕</button>
        </div>

        <div class="cpList">
          ${items.map((it,i)=>`
            <button type="button" class="cpItem cpItem--${esc(it.role||"default")}" data-pk="${i}" data-role="${esc(it.role||"")}" >
              <div class="cpItem__icon">${esc((it.icon||"").toString().slice(0,3) || "•")}</div>
              <div class="cpItem__body">
                <div class="cpItem__label">${esc(it.label || it.name || ("Opción " + (i+1)))}</div>
                ${it.meta ? `<div class="cpItem__pill">${esc(it.meta)}</div>` : ``}
                ${it.desc ? `<div class="cpItem__desc">${esc(it.desc)}</div>` : ``}
              </div>
              <div class="cpItem__chev">›</div>
            </button>
          `).join("")}
        </div>

        <button type="button" class="cpCancel" data-close>Cancelar</button>
      </div>
    `;

    // Close handlers
    wrap.addEventListener("click", (e) => {
      if (e.target === wrap || (e.target && e.target.matches("[data-close]"))) wrap.remove();
    });

    document.body.appendChild(wrap);

    wrap.querySelectorAll("button[data-pk]").forEach(btn => {
      btn.onclick = () => {
        const idx = Number(btn.getAttribute("data-pk"));
        const picked = items[idx] || items[0];
        // Apply accent based on role (if provided)
        try{
          const r = String(picked.role||"").toLowerCase().trim();
          const accent = (r === "tesorero") ? "#16a34a" : (r === "presidente") ? "#f59e0b" : "#2563eb";
          document.documentElement.style.setProperty("--role-accent", accent);
        }catch(e){}
        onPick(picked);
      };
    });
  }

  function chooseRoleForCourse(userEmail, courseKey, profilesForCourse) {
    // profilesForCourse: [{role, profile}]
    const roleOrder = { presidente: 1, tesorero: 2, apoderado: 3 };
    const byRole = {};
    profilesForCourse.forEach(p => { byRole[p.role] = p.profile; });

    // ⚠️ Caso tesorero: normalmente el perfil sigue siendo "apoderado" pero
    // el permiso se guarda en cursapp_directiva_apoderado_by_role_v1.
    const directivaByRole = loadJSON(KEY_DIRECTIVA_BY_ROLE, {});
    const hasTesorero = hasRoleInDirectiva(userEmail, courseKey, "tesorero");
    const hasPresidente = hasRoleInDirectiva(userEmail, courseKey, "presidente");

    const roles = Array.from(new Set([
      ...Object.keys(byRole),
      ...(hasTesorero ? ["tesorero"] : []),
      ...(hasPresidente ? ["presidente"] : [])
    ])).sort((a,b)=>(roleOrder[a]||99)-(roleOrder[b]||99));

    dbgAlert("Roles detectados", { userEmail, courseKey, roles, byRole, directivaByRole });


    // Si agregamos rol virtual sin profile explícito, reutilizamos el profile apoderado
    if (hasTesorero && !byRole.tesorero) byRole.tesorero = byRole.apoderado || null;
    if (hasPresidente && !byRole.presidente) byRole.presidente = byRole.apoderado || null;
    try { saveJSON(KEY_ROLES_AVAILABLE, roles); } catch(e) {}

    function normAlumnoName(v){
      return String(v || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ");
    }

    function apoderadoProfilesForCourse(){
      let all = [];
      try { all = loadJSON(KEY_PROFILES, []); } catch(e) { all = []; }
      if(!Array.isArray(all)) all = [];
      const emailNorm = String(userEmail || "").trim().toLowerCase();
      const rows = all.filter(p =>
        String(p?.courseKey || "") === String(courseKey || "") &&
        String(p?.role || "").toLowerCase().trim() === "apoderado" &&
        (!p?.apoderado?.email || String(p.apoderado.email || "").trim().toLowerCase() === emailNorm)
      );
      const explicit = profilesForCourse
        .filter(x => String(x?.role || "").toLowerCase().trim() === "apoderado" && x.profile)
        .map(x => x.profile);
      const byId = new Map();
      [...rows, ...explicit].forEach(pr => {
        const k = String(pr?.profileId || pr?.id || pr?.supabase?.miembro_id || Math.random());
        if(pr && !byId.has(k)) byId.set(k, pr);
      });
      return Array.from(byId.values());
    }

    function profileForEnrollment(enr, fallback){
      const targetAlumno = normAlumnoName(enr?.alumno || "");
      const all = apoderadoProfilesForCourse();
      const byAlumno = all.find(p => normAlumnoName(p?.apoderado?.alumno || "") === targetAlumno);
      if(byAlumno) return byAlumno;
      const enrId = String(enr?.enrollmentId || "");
      const byId = all.find(p => enrId && enrId.includes(String(p?.supabase?.miembro_id || p?.profileId || "__NO__")));
      return byId || fallback || all[0] || null;
    }

    function setAlumnoContext(row){
      try {
        const u = JSON.parse(localStorage.getItem(KEY_DEMO_USER) || "{}");
        u.apoderado = u.apoderado || {};
        u.apoderado.alumno = row.alumno || "";
        u.apoderado.email = userEmail;
        localStorage.setItem(KEY_DEMO_USER, JSON.stringify(u));
        localStorage.setItem(KEY_ACTIVE_ENROLL, row.enrollmentId || "");

        const profileId = String(row?.profile?.profileId || row?.profile?.id || "").trim();
        const miembroId = String(row?.profile?.supabase?.miembro_id || "").trim();

        if(profileId){
          localStorage.setItem(KEY_ACTIVE_PROFILE, profileId);
          localStorage.setItem("cursapp_active_member_profile_v1", profileId);
        }
        if(miembroId) localStorage.setItem("cursapp_active_miembro_id_v1", miembroId);

        const alumnoActivo = {
          nombre: row.alumno || "",
          alumno: row.alumno || "",
          email: userEmail,
          courseKey: courseKey || "",
          profileId,
          miembroId,
          enrollmentId: row.enrollmentId || ""
        };
        localStorage.setItem("cursapp_alumno_activo_v1", JSON.stringify(alumnoActivo));

        // Persistir también el perfil elegido en profiles.
        // El bug venía de que el selector sabía cuál alumno era, pero apoderado.js
        // no encontraba ese profileId en la caché y caía al último perfil del curso.
        if(row && row.profile){
          const profiles = loadJSON(KEY_PROFILES, []);
          const list = Array.isArray(profiles) ? profiles.slice() : [];
          const selected = Object.assign({}, row.profile);
          selected.profileId = profileId || selected.profileId || selected.id || ("sel_" + Date.now());
          selected.id = selected.profileId;
          selected.role = "apoderado";
          selected.courseKey = courseKey || selected.courseKey || "";
          selected.apoderado = Object.assign({}, selected.apoderado || {}, {
            alumno: row.alumno || selected?.apoderado?.alumno || "",
            email: userEmail
          });
          selected.supabase = Object.assign({}, selected.supabase || {});
          if(miembroId) selected.supabase.miembro_id = miembroId;
          const idx = list.findIndex(p =>
            String(p?.profileId || p?.id || "") === String(selected.profileId || "") ||
            (miembroId && String(p?.supabase?.miembro_id || "") === miembroId)
          );
          if(idx >= 0) list[idx] = Object.assign({}, list[idx], selected);
          else list.unshift(selected);
          localStorage.setItem(KEY_PROFILES, JSON.stringify(list));
        }
      } catch (e) {}
    }

    function buildAlumnoRows(fallbackProfile){
      const rows = [];
      const seen = new Set();
      const push = (row) => {
        const k = normAlumnoName(row.alumno || "") || String(row.enrollmentId || row.profile?.profileId || rows.length);
        if(seen.has(k)) return;
        seen.add(k);
        rows.push(row);
      };

      apoderadoProfilesForCourse().forEach(pr => {
        const alumno = pr?.apoderado?.alumno || "";
        if(!alumno) return;
        const st = String(pr?.status || "aprobado").toLowerCase();
        push({
          alumno,
          status: (st === "pendiente" || st === "pending") ? "pending" : "approved",
          profile: pr,
          enrollmentId: pr?.supabase?.miembro_id ? ("sb_enr_" + pr.supabase.miembro_id) : (pr?.profileId || "")
        });
      });

      (findEnrollments(userEmail, courseKey) || []).forEach(enr => {
        push({
          alumno: enr.alumno || "Alumno/a",
          status: enr.status || "pending",
          profile: profileForEnrollment(enr, fallbackProfile),
          enrollmentId: enr.enrollmentId || ""
        });
      });
      return rows;
    }

    function enterApoderado(it){
      const fallbackProfile = it?.profile || byRole.apoderado || null;
      const alumnoRows = buildAlumnoRows(fallbackProfile);

      if(alumnoRows.length > 1){
        const items = alumnoRows.map(row => ({
          label: row.alumno || "Alumno/a",
          meta: row.status === "approved" ? "Aprobado" : "Pendiente",
          desc: "Selecciona este alumno para ver sus pagos, avisos y movimientos.",
          icon: "🎒",
          row
        }));
        renderChooser("Elegir alumno/a", "Selecciona con qué hijo/a deseas ingresar", items, (pick) => {
          const row = pick.row;
          if(!row || row.status !== "approved"){
            showErr(row ? "La solicitud de este alumno está pendiente de aprobación." : "Solicitud inválida.");
            return;
          }
          setAlumnoContext(row);
          go("apoderado", userEmail, courseKey, row.profile || fallbackProfile);
        });
        return;
      }

      if(alumnoRows.length === 1){
        const row = alumnoRows[0];
        if(row.status !== "approved"){
          showErr("Tu solicitud está pendiente de aprobación por la directiva.");
          return;
        }
        setAlumnoContext(row);
        go("apoderado", userEmail, courseKey, row.profile || fallbackProfile);
        return;
      }

      // Sin alumnos explícitos: solo permitir bypass si la directiva tiene perfil apoderado virtual.
      if (canAutoApproveApoderado(roles)) {
        try {
          const ap = (fallbackProfile && fallbackProfile.apoderado) ? fallbackProfile.apoderado : {};
          const u = JSON.parse(localStorage.getItem(KEY_DEMO_USER) || "{}");
          u.apoderado = u.apoderado || {};
          u.apoderado.alumno = ap.alumno || u.apoderado.alumno || "Alumno";
          u.apoderado.email = userEmail;
          localStorage.setItem(KEY_DEMO_USER, JSON.stringify(u));
          localStorage.setItem(KEY_ACTIVE_ENROLL, "");
        } catch (e) {}
        go("apoderado", userEmail, courseKey, fallbackProfile);
        return;
      }

      if (!requireApproved(userEmail, courseKey, roles, fallbackProfile)) return;
      go("apoderado", userEmail, courseKey, fallbackProfile);
    }

    if (roles.length === 1) {
      const role = roles[0];
      if (role === "apoderado") enterApoderado({ role, profile: byRole[role] });
      else go(role, userEmail, courseKey, byRole[role]);
      return;
    }

    const roleItems = roles.map(r => {
  if (r === "apoderado") {
    const n = buildAlumnoRows(byRole[r]).length;
    return {
      label: "Apoderado",
      meta: n > 1 ? (n + " alumnos") : "Gestión de apoderados",
      desc: n > 1 ? "Elige este rol y luego selecciona el hijo/a." : "Ingresa para ver avisos, pagos y movimientos de tu curso.",
      icon: "👥",
      role: r,
      profile: byRole[r]
    };
  }

  if (r === "presidente") {
    return {
      label: "Presidente",
      meta: "Gestión del curso y campañas",
      desc: "Administra el curso, campañas, pagos y rendiciones.",
      icon: "🎓",
      role: r,
      profile: byRole[r]
    };
  }

  if (r === "tesorero") {
    return {
      label: "Tesorero",
      meta: "Gestión de pagos y rendiciones",
      desc: "Controla ingresos, conciliación, comprobantes y gastos.",
      icon: "💳",
      role: r,
      profile: byRole[r]
    };
  }

  return {
    label: r,
    meta: "",
    icon: "•",
    role: r,
    profile: byRole[r]
  };
});

    renderChooser("Elegir rol", "Selecciona cómo deseas ingresar", roleItems, (it) => {
      if (it.role === "apoderado") {
        enterApoderado(it);
        return;
      }

      go(it.role, userEmail, courseKey, it.profile);
    });
  }

  function resolveAndEnter(userEmail, allProfiles) {
  const profiles = Array.isArray(allProfiles) ? allProfiles.filter(p=>p && p.courseKey) : [];
  const courseKeys = Array.from(new Set(profiles.map(p => p.courseKey).filter(Boolean)));

  function buildRoleListForCourse(ck){
    const profilesForCourse = profiles.filter(p => (p.courseKey || "") === ck);
    const roleOrder = { presidente: 1, tesorero: 2, apoderado: 3 };
    const roleList = [];
    const seen = new Set();
    profilesForCourse.forEach(p => {
      const r = String(p.role || "apoderado").toLowerCase().trim();
      if (r && !seen.has(r)) { roleList.push({ role: r, profile: p }); seen.add(r); }
    });

    const hasTes = hasRoleInDirectiva(userEmail, ck, "tesorero");
    const hasPres = hasRoleInDirectiva(userEmail, ck, "presidente");
    if (hasPres && !seen.has("presidente")) { roleList.push({ role: "presidente", profile: profilesForCourse[0] || {} }); seen.add("presidente"); }
    if (hasTes && !seen.has("tesorero")) { roleList.push({ role: "tesorero", profile: profilesForCourse[0] || {} }); seen.add("tesorero"); }

    // No inventar apoderado si el usuario solo tiene rol directiva.
    // Solo asegurar apoderado si hay algún perfil o enrollment apoderado.
    const hasExplicitApoderado = profilesForCourse.some(p => String(p.role||"").toLowerCase()==="apoderado");
    const hasApprovedEnrollment = findEnrollments(userEmail, ck).length > 0;
    if (!seen.has("apoderado") && (hasExplicitApoderado || hasApprovedEnrollment)) {
      roleList.push({ role: "apoderado", profile: profilesForCourse[0] || {} });
      seen.add("apoderado");
    }

    return roleList.sort((a,b)=>(roleOrder[a.role]||99)-(roleOrder[b.role]||99));
  }

  function enterCourse(ck){
    const roleList = buildRoleListForCourse(ck);
    try { saveJSON(KEY_ROLES_AVAILABLE, roleList.map(x => x.role)); } catch(e) {}
    chooseRoleForCourse(userEmail, ck, roleList);
  }

  if(!courseKeys.length){ showErr("No hay cursos asociados a este usuario."); return; }

  if(courseKeys.length > 1){
    const items = courseKeys.map((ck, i)=>{
      const p = profiles.find(x=>x.courseKey===ck) || {};
      const c = p.course || {};
      return {
        label: `${c.schoolName || "Curso"} · ${c.level || ""}${c.letter || ""} ${c.year || ""}`.replace(/\s+/g," ").trim(),
        meta: c.jornada || "Seleccionar",
        desc: `${buildRoleListForCourse(ck).map(x=>x.role).join(" / ")}`,
        icon: "🎓",
        courseKey: ck
      };
    });
    renderChooser("Elegir curso", "Selecciona el curso con el que quieres entrar", items, (it)=> enterCourse(it.courseKey));
    return;
  }

  enterCourse(courseKeys[0]);
}



  /* =========================================================
     Cursapp · Login Supabase Fase 1B
     - Permite iniciar sesión desde otro navegador.
     - Supabase es fuente para usuarios/roles/curso.
     - localStorage queda como caché de sesión para pantallas actuales.
     ========================================================= */
  const SUPA_LOGIN_URL = "https://ngxistgymgdkoaiulfbq.supabase.co";
  const SUPA_LOGIN_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5neGlzdGd5bWdka29haXVsZmJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2OTg1NDQsImV4cCI6MjA5NjI3NDU0NH0.1r-aLijYEWvUifKcLjlClnA8-oYw11lgThY0swg_xbg";

  async function supaFetch(path, opts){
    const res = await fetch(SUPA_LOGIN_URL + "/rest/v1/" + path, Object.assign({
      headers: {
        "apikey": SUPA_LOGIN_KEY,
        "Authorization": "Bearer " + SUPA_LOGIN_KEY,
        "Content-Type": "application/json"
      }
    }, opts || {}));
    const txt = await res.text();
    let data = null;
    try { data = txt ? JSON.parse(txt) : null; } catch(e){ data = txt; }
    if(!res.ok){
      const msg = (data && (data.message || data.error || data.hint)) || txt || ("HTTP " + res.status);
      throw new Error(msg);
    }
    return data;
  }

  function supaQ(v){ return encodeURIComponent(String(v == null ? "" : v)); }

  async function supaAuthSignInPassword(email, passwordPlain){
    const res = await fetch(SUPA_LOGIN_URL + "/auth/v1/token?grant_type=password", {
      method: "POST",
      headers: {
        "apikey": SUPA_LOGIN_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email: String(email || "").trim().toLowerCase(),
        password: String(passwordPlain || "")
      })
    });
    const txt = await res.text();
    let data = null;
    try { data = txt ? JSON.parse(txt) : null; } catch(e){ data = txt; }
    if(!res.ok){
      const raw = (data && (data.msg || data.message || data.error_description || data.error)) || txt || "Credenciales inválidas.";
      const msg = /invalid login|invalid credentials|email not confirmed|not found|bad_jwt|signup/i.test(String(raw))
        ? "Correo o contraseña incorrectos."
        : String(raw);
      throw new Error(msg);
    }
    if(!data || !data.user || !data.access_token){
      throw new Error("No se pudo iniciar sesión con Supabase Auth.");
    }
    try{
      localStorage.setItem("cursapp_supabase_auth_session_v1", JSON.stringify({
        access_token:data.access_token,
        refresh_token:data.refresh_token || "",
        expires_at:data.expires_at || null,
        user:data.user
      }));
    }catch(e){}
    return data;
  }

  async function findSupabaseUserByEmail(email){
    const rows = await supaFetch("usuarios?email=eq." + supaQ(email) + "&select=*&limit=1");
    return Array.isArray(rows) ? (rows[0] || null) : null;
  }

  async function findSupabaseMembersByUser(user){
    if(!user || !user.id) return [];
    const rows = await supaFetch("miembros_curso?usuario_id=eq." + supaQ(user.id) + "&select=*");
    return Array.isArray(rows) ? rows : [];
  }

  async function findSupabaseCoursesByIds(ids){
    const clean = Array.from(new Set((ids || []).map(x=>String(x||"").trim()).filter(Boolean)));
    if(!clean.length) return {};
    const rows = await supaFetch("cursos?id=in.(" + clean.map(supaQ).join(",") + ")&select=*");
    const map = {};
    (Array.isArray(rows) ? rows : []).forEach(r=>{ if(r && r.id) map[String(r.id)] = r; });
    return map;
  }

  function courseFromSupabaseRow(row){
    row = row || {};
    const nivel = String(row.nivel || "");
    const letra = String(row.letra || "");
    const anio = String(row.anio || "");
    const suffix = ` · ${nivel}${letra} ${anio}`.trim();
    let schoolName = String(row.school_name || row.colegio_nombre || row.nombre || "Colegio").trim();
    // En Supabase cursos.nombre suele venir como "Colegio · IV°B 2026".
    // Para evitar duplicar curso/año en la cabecera, dejamos solo el colegio.
    if(schoolName && nivel && letra){
      schoolName = schoolName.replace(new RegExp("\\s*·\\s*" + nivel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + letra.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*" + anio.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*$"), "").trim();
    }
    return {
      schoolName: schoolName || "Colegio",
      level: nivel,
      letter: letra,
      year: row.anio || "",
      jornada: row.jornada || ""
    };
  }

  function cacheSupabaseLoginLocally(user, members, coursesById){
    const email = String(user?.email || "").toLowerCase().trim();
    const userId = String(user?.id || email || "");
    if(!email || !userId) return [];

    // Usuario local mínimo: permite compatibilidad con flujos actuales.
    try{
      const users = loadJSON(KEY_USERS, []);
      const arr = Array.isArray(users) ? users.slice() : [];
      const idx = arr.findIndex(u=>String(u.email||"").toLowerCase().trim() === email);
      const localUser = {
        userId,
        email,
        nombre: user.nombre || "",
        fromSupabase: true,
        updatedAt: new Date().toISOString()
      };
      if(idx >= 0) arr[idx] = Object.assign({}, arr[idx], localUser);
      else arr.unshift(localUser);
      saveJSON(KEY_USERS, arr);
    }catch(e){}

    const profiles = loadJSON(KEY_PROFILES, []);
    let nextProfiles = Array.isArray(profiles) ? profiles.slice() : [];
    const createdProfiles = [];
    const enrolls = loadJSON(KEY_ENROLL, []);
    let nextEnrolls = Array.isArray(enrolls) ? enrolls.slice() : [];

    (members || []).forEach(m=>{
      if(!m) return;
      const c = coursesById[String(m.curso_id||"")] || {};
      const courseKey = String(c.course_key || m.course_key || m.curso_id || "").trim();
      if(!courseKey) return;
      const role = String(m.rol || "apoderado").toLowerCase().trim();
      const profileId = "sb_" + String(m.id || [courseKey,email,role,m.nombre_alumno||""].join("_")).replace(/[^a-zA-Z0-9_-]/g,"_");
      const course = Object.assign({ courseKey, inviteCode: c.invite_code || "" }, courseFromSupabaseRow(c));
      const profile = {
        profileId,
        userId,
        role,
        courseKey,
        course,
        fromSupabase: true,
        supabase: { usuario_id:user.id, miembro_id:m.id, curso_id:m.curso_id },
        status: String(m.estado || "aprobado").toLowerCase(),
        apoderado: {
          name: m.nombre_apoderado || user.nombre || email,
          alumno: m.nombre_alumno || "",
          email,
          phone: user.telefono || ""
        },
        activation: { required:true, status: m.activacion_pagada ? "paid" : "paid" },
        updatedAt: new Date().toISOString()
      };

      nextProfiles = nextProfiles.filter(p=>String(p.profileId||p.id||"") !== profileId);
      nextProfiles.unshift(profile);
      createdProfiles.push(profile);

      if(role === "apoderado"){
        const enrollmentId = "sb_enr_" + String(m.id || profileId).replace(/[^a-zA-Z0-9_-]/g,"_");
        nextEnrolls = nextEnrolls.filter(e=>String(e.enrollmentId||e.id||"") !== enrollmentId);
        nextEnrolls.unshift({
          enrollmentId,
          courseKey,
          apoderadoName: m.nombre_apoderado || user.nombre || email,
          alumno: m.nombre_alumno || "",
          email,
          phone: user.telefono || "",
          status: String(m.estado || "aprobado").toLowerCase() === "pendiente" ? "pending" : "approved",
          activationStatus: m.activacion_pagada ? "paid" : "paid",
          fromSupabase: true,
          createdAt: new Date().toISOString()
        });
      }
    });

    saveJSON(KEY_PROFILES, nextProfiles);
    saveJSON(KEY_ENROLL, nextEnrolls);

    // Mantener catálogo local mínimo de cursos para topbar/dashboard mientras migramos lectura.
    try{
      const currentCourses = loadJSON("cursapp_courses_v1", []);
      let list = Array.isArray(currentCourses) ? currentCourses.slice() : [];
      Object.keys(coursesById || {}).forEach(id=>{
        const c = coursesById[id];
        if(!c || !c.course_key) return;
        const row = Object.assign({ courseKey:c.course_key, inviteCode:c.invite_code || "" }, courseFromSupabaseRow(c));
        const ix = list.findIndex(x=>String(x.courseKey||"") === String(row.courseKey));
        if(ix >= 0) list[ix] = Object.assign({}, list[ix], row);
        else list.unshift(row);
      });
      saveJSON("cursapp_courses_v1", list);
    }catch(e){}

    return createdProfiles;
  }

  async function loginFromSupabase(email, passwordPlain){
    if(!String(passwordPlain||"")) throw new Error("Ingresa tu contraseña.");

    // Seguridad real: primero valida credenciales contra Supabase Auth.
    // Si la contraseña no coincide, NO se consulta usuarios/miembros ni se crea sesión local.
    const authSession = await supaAuthSignInPassword(email, passwordPlain);

    // Perfil operativo Cursapp: usuarios/miembros_curso siguen siendo la fuente de roles/curso.
    // Se busca por email para mantener compatibilidad con registros creados antes de usar auth.users.id.
    const user = await findSupabaseUserByEmail(email);
    if(!user) throw new Error("Usuario autenticado, pero no existe perfil Cursapp asociado.");

    const members = await findSupabaseMembersByUser(user);
    if(!members.length){
      throw new Error("Usuario existe en Supabase, pero no tiene roles asociados en miembros_curso.");
    }
    const coursesById = await findSupabaseCoursesByIds(members.map(m=>m.curso_id));
    const profiles = cacheSupabaseLoginLocally(user, members, coursesById);
    return { user, profiles };
  }


    ensureDemoAgent();

  // ===== submit =====
  if (!form) {
    showErr("Login inválido: falta #loginForm");
    return;
  }

  try{
    const qsMsg = new URLSearchParams(location.search);
    if(qsMsg.get("not_registered")==="1") showErr("Usuario no registrado o sin roles activos en Supabase.");
  }catch(e){}

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearErr();

    try {
      const u = String(username?.value || "").trim().toLowerCase();
      const p = String(password?.value || "");


      // Login administrador Cursapp
      if (u === "admin@cursapp.cl" && p === "admin123") {
        const s = {userId:"admin_cursapp",email:u,role:"admin",isAdmin:true,createdAt:new Date().toISOString()};
        localStorage.setItem(KEY_SESSION, JSON.stringify(s));
        localStorage.setItem("cursapp_admin_session_v1", JSON.stringify(s));
        window.location.href = "/admin/admin.html";
        return;
      }

      // Login agente Cursapp
      if (u === "agente@cursapp.cl" && p === "123456") {
        const ag = ensureDemoAgent();
        localStorage.setItem(KEY_AGENT_SESSION, JSON.stringify({
          agentId:ag.id,email:ag.email,name:ag.name,code:ag.code,role:"agente",createdAt:new Date().toISOString()
        }));
        window.location.href = "/agente/agente.html";
        return;
      }

      const agents = loadJSON(KEY_REF_AGENTS, []);
      const agent = agents.find(a => String(a.email||"").toLowerCase() === u && String(a.status||"active") !== "inactive");
      if (agent) {
        const passOk = agent.passwordHashDemo ? agent.passwordHashDemo === hashDemo(p) : p === "123456";
        if (!passOk) { showErr("Contraseña incorrecta."); return; }
        localStorage.setItem(KEY_AGENT_SESSION, JSON.stringify({
          agentId:agent.id,email:agent.email,name:agent.name,code:agent.code,role:"agente",createdAt:new Date().toISOString()
        }));
        window.location.href = "/agente/agente.html";
        return;
      }

      // Demo presidente/tesorero
      if ((u === "tesorero" || u === "presidente") && p === "demo") {
        setSession({ userId: u, role: u, courseKey: "", profileId: "" });
        setBanner({ name: (u === "presidente" ? "Presidente" : "Tesorero") + " (Demo)", role: u });
        window.location.href = u + ".html";
        return;
      }

      // Demo apoderado blocked
      if (u === "apoderado" && p === "demo") {
        showErr("Para ingresar como apoderado debes estar aprobado por la directiva. Completa onboarding como apoderado.");
        return;
      }

      // Real login Fase 2B: Supabase es la única fuente de verdad.
      // No se permite fallback a localStorage. Si la DB está vacía, el usuario NO entra.
      let user = null;
      let allProfiles = [];
      try{
        const remote = await loginFromSupabase(u, p);
        if(remote && remote.user){
          user = { userId: remote.user.id, email:u, fromSupabase:true };
          allProfiles = Array.isArray(remote.profiles) ? remote.profiles : [];
          try{ localStorage.setItem("cursapp_login_source_v1", "supabase-only"); }catch(e){}
        }
      }catch(syncErr){
        console.warn("Login Supabase-only falló", syncErr);
        showErr(syncErr && syncErr.message ? syncErr.message : "Usuario no registrado en Supabase.");
        return;
      }

      if (!user) {
        showErr("Usuario no registrado. Usa Onboarding para crear cuenta.");
        return;
      }

      if (!allProfiles.length) {
        showErr("No hay perfiles asociados en Supabase. Completa onboarding o solicita aprobación.");
        return;
      }

      // Normalize roles
      const normProfiles = allProfiles.map(pr => {
        const role = String(pr.role || pr.user?.role || "apoderado").toLowerCase();
        return { ...pr, role };
      });

      resolveAndEnter(u, normProfiles);

    } catch (err) {
      console.error(err);
      showErr("Error en login: " + (err && err.message ? err.message : String(err)));
    }
  });

})();
