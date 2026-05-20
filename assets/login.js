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
  const LOGIN_JS_VERSION = "20260214154124";
  const DEBUG_LOGIN = (() => {
    try {
      const qs = new URLSearchParams(window.location.search || "");
      if (qs.get("debug") === "1") return true;
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

  function setActiveCourseKey(k) { localStorage.setItem(KEY_ACTIVE_COURSE, String(k || "")); }
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

  function requireApproved(email, courseKey, rolesInCourse) {
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
    setActiveCourseKey(courseKey || "");
    setActiveProfileId(pid || "");
        dbgAlert("Session BEFORE save", { email: userEmail, courseKey, role, profileId: pid });

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
    ]));

    dbgAlert("Roles detectados", { userEmail, courseKey, roles, byRole, directivaByRole });


    // Si agregamos rol virtual sin profile explícito, reutilizamos el profile apoderado
    if (hasTesorero && !byRole.tesorero) byRole.tesorero = byRole.apoderado || null;
    if (hasPresidente && !byRole.presidente) byRole.presidente = byRole.apoderado || null;
    try { saveJSON(KEY_ROLES_AVAILABLE, roles); } catch(e) {}

    if (roles.length === 1) {
      const role = roles[0];
      if (role === "apoderado" && !requireApproved(userEmail, courseKey, roles)) return;
      go(role, userEmail, courseKey, byRole[role]);
      return;
    }

    const roleItems = roles.map(r => {
  if (r === "apoderado") {
    return {
      label: "Apoderado",
      meta: "Gestión de apoderados",
      desc: "Ingresa para ver avisos, pagos y movimientos de tu curso.",
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

        // ✅ Si es presidente en este curso: entra como apoderado sin enrollments
        if (canAutoApproveApoderado(roles)) {
          // intenta setear alumno desde perfil si existe
          try {
            const ap = (it.profile && it.profile.apoderado) ? it.profile.apoderado : {};
            const u = JSON.parse(localStorage.getItem(KEY_DEMO_USER) || "{}");
            u.apoderado = u.apoderado || {};
            u.apoderado.alumno = ap.alumno || u.apoderado.alumno || "Alumno";
            u.apoderado.email = userEmail;
            localStorage.setItem(KEY_DEMO_USER, JSON.stringify(u));
            localStorage.setItem(KEY_ACTIVE_ENROLL, "");
          } catch (e) {}
          go("apoderado", userEmail, courseKey, it.profile);
          return;
        }

        // flujo normal apoderado: requiere enrollment(s)
        const list = findEnrollments(userEmail, courseKey);
        if (!list || !list.length) {
          showErr("No existe una solicitud para este curso. Completa onboarding como apoderado para enviar tu solicitud.");
          return;
        }

        // Si hay más de un alumno, elegir cuál gestionar (separación de cuotas)
        if (list.length > 1) {
          const items = list.map(e => ({
            name: e.alumno || "Alumno/a",
            meta: (e.status === "approved" ? "Aprobado" : "Pendiente"),
            enr: e
          }));
          renderChooser("Elegir alumno/a", "Selecciona el alumno para gestionar pagos y cuotas", items, (pick) => {
            const enr = pick.enr;
            if (!enr || enr.status !== "approved") {
              showErr(enr && enr.status !== "approved" ? "La solicitud de este alumno está pendiente de aprobación." : "Solicitud inválida.");
              return;
            }
            try {
              const u = JSON.parse(localStorage.getItem(KEY_DEMO_USER) || "{}");
              u.apoderado = u.apoderado || {};
              u.apoderado.alumno = enr.alumno || "";
              u.apoderado.email = userEmail;
              localStorage.setItem(KEY_DEMO_USER, JSON.stringify(u));
              localStorage.setItem(KEY_ACTIVE_ENROLL, enr.enrollmentId || "");
            } catch (e) {}
            go("apoderado", userEmail, courseKey, it.profile);
          });
          return;
        }

        // Solo 1 alumno/enrollment
        if (!requireApproved(userEmail, courseKey, roles)) return;
        try {
          const enr = list[0];
          const u = JSON.parse(localStorage.getItem(KEY_DEMO_USER) || "{}");
          u.apoderado = u.apoderado || {};
          u.apoderado.alumno = enr.alumno || "";
          u.apoderado.email = userEmail;
          localStorage.setItem(KEY_DEMO_USER, JSON.stringify(u));
          localStorage.setItem(KEY_ACTIVE_ENROLL, enr.enrollmentId || "");
        } catch (e) {}

        go("apoderado", userEmail, courseKey, it.profile);
        return;
      }

      go(it.role, userEmail, courseKey, it.profile);
    });
  }

  function resolveAndEnter(userEmail, allProfiles) {
  // Decide curso (si hay varios, hoy tomamos el curso activo si existe; si no, el primero)
  const activeCourseKey = localStorage.getItem(KEY_ACTIVE_COURSE) || "";
  const courseKeys = Array.from(new Set((allProfiles || []).map(p => p.courseKey).filter(Boolean)));

  const ck = (activeCourseKey && courseKeys.includes(activeCourseKey))
    ? activeCourseKey
    : (courseKeys[0] || (allProfiles[0] && allProfiles[0].courseKey) || "");

  const profilesForCourse = (allProfiles || []).filter(p => (p.courseKey || "") === ck);

  // Roles base desde profiles
  const roleList = [];
  const seen = new Set();
  profilesForCourse.forEach(p => {
    const r = String(p.role || "apoderado").toLowerCase();
    if (!seen.has(r)) {
      roleList.push({ role: r, profile: p });
      seen.add(r);
    }
  });

  // Siempre asegurar apoderado si existe al menos un perfil apoderado o enrollment
  if (!seen.has("apoderado")) {
    roleList.push({ role: "apoderado", profile: profilesForCourse[0] || {} });
    seen.add("apoderado");
  }

  // Roles por directiva_by_role (por email del usuario)
  const hasTes = hasRoleInDirectiva(userEmail, ck, "tesorero");
  const hasPres = hasRoleInDirectiva(userEmail, ck, "presidente");

  if (hasTes && !seen.has("tesorero")) {
    roleList.push({ role: "tesorero", profile: profilesForCourse[0] || {} });
    seen.add("tesorero");
  }
  if (hasPres && !seen.has("presidente")) {
    roleList.push({ role: "presidente", profile: profilesForCourse[0] || {} });
    seen.add("presidente");
  }

  // Guardar roles disponibles para el menú
  try { saveJSON(KEY_ROLES_AVAILABLE, roleList.map(x => x.role)); } catch(e) {}

  // Elegir rol (modal si hay más de uno)
  chooseRoleForCourse(userEmail, ck, roleList);
}

  ensureDemoAgent();

  // ===== submit =====
  if (!form) {
    showErr("Login inválido: falta #loginForm");
    return;
  }

  form.addEventListener("submit", (e) => {
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

      // Real login
      const users = loadJSON(KEY_USERS, []);
      const user = users.find(x => x.email === u);
      if (!user) {
        showErr("Usuario no registrado. Usa Onboarding para crear cuenta.");
        return;
      }

      const hash = hashDemo(p);
      if (user.passwordHashDemo !== hash) {
        showErr("Contraseña incorrecta.");
        return;
      }

      // Load all profiles for this user (multi-rol)
      const allProfiles = loadJSON(KEY_PROFILES, []).filter(pr => pr.userId === user.userId);
      if (!allProfiles.length) {
        showErr("No hay perfiles asociados. Completa onboarding.");
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
