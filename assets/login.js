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

  const KEY_ROLES_AVAILABLE = "cursapp_roles_v1";
  const KEY_ACTIVE_ROLE = "cursapp_active_role_v1";
  const KEY_DIRECTIVA_BY_ROLE = "cursapp_directiva_apoderado_by_role_v1";
  // ===== storage helpers =====
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

  function setActiveCourseKey(k) { localStorage.setItem(KEY_ACTIVE_COURSE, String(k || "")); }
  function setActiveProfileId(id) { localStorage.setItem(KEY_ACTIVE_PROFILE, String(id || "")); }

  function setSession(session) {
    // session = { userId, profileId, role, courseKey }
    saveJSON(KEY_SESSION, session);
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
    setSession({
      userId: userEmail,
      role,
      courseKey: courseKey || "",
      profileId: pid || ""
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
        role
      });
    }

    window.location.href = role + ".html";
  }

  // ===== UI: chooser (curso/rol/alumno) =====
  function renderChooser(title, subtitle, items, onPick) {
    const card = document.querySelector(".auth-card");
    if (!card) {
      const old = document.getElementById("cursappPickerOverlay");
      if (old) old.remove();

      const wrap = document.createElement("div");
      wrap.id = "cursappPickerOverlay";
      wrap.style.cssText =
        "position:fixed;inset:0;z-index:9999;background:rgba(15,23,42,.45);display:flex;align-items:center;justify-content:center;padding:18px;";
      wrap.innerHTML = `
        <div style="width:min(560px,100%);background:#fff;border-radius:18px;box-shadow:0 20px 60px rgba(2,6,23,.25);overflow:hidden;">
          <div style="padding:16px 16px 6px 16px;">
            <div style="font-weight:950;font-size:18px;">${esc(title)}</div>
            <div style="margin-top:6px;color:rgba(15,23,42,.65);font-size:13px;">${esc(subtitle||"")}</div>
          </div>
          <div style="padding:0 10px 12px 10px;max-height:60vh;overflow:auto;">
            ${items.map((it,i)=>`
              <button data-pk="${i}" style="width:100%;text-align:left;border:1px solid rgba(229,231,235,.95);background:#fff;border-radius:14px;padding:12px;margin:8px 6px;cursor:pointer;">
                <div style="font-weight:900;color:rgba(15,23,42,.92);">${esc(it.label||it.name||"")}</div>
                ${it.meta ? `<div style="margin-top:4px;color:rgba(15,23,42,.6);font-size:12px;">${esc(it.meta)}</div>` : ``}
              </button>
            `).join("")}
          </div>
          <div style="display:flex;justify-content:flex-end;gap:10px;padding:12px 16px 16px 16px;background:rgba(248,250,252,1);">
            <button id="pkCancel" style="border:1px solid rgba(226,232,240,1);background:#fff;border-radius:12px;padding:10px 14px;font-weight:900;cursor:pointer;">Cancelar</button>
          </div>
        </div>
      `;
      document.body.appendChild(wrap);
      wrap.addEventListener("click", (ev) => { if (ev.target === wrap) wrap.remove(); });
      wrap.querySelector("#pkCancel").addEventListener("click", () => wrap.remove());
      wrap.querySelectorAll("button[data-pk]").forEach(btn => {
        btn.addEventListener("click", () => {
          const i = Number(btn.getAttribute("data-pk"));
          wrap.remove();
          onPick(items[i] || items[0]);
        });
      });
      return;
    }

    card.innerHTML = `
      <div class="brandCenter">
        <div class="logo big">C</div>
        <h1>Cursapp</h1>
        <p class="muted">${esc(title)}</p>
      </div>

      <div style="margin-top:12px;">
        ${items.map((it,i)=>`
          <div style="padding:12px;border:1px solid rgba(229,231,235,.9);border-radius:14px;margin-top:10px;">
            <div style="font-weight:950;">${esc(it.label||it.name||"")}</div>
            ${it.meta ? `<div class="muted" style="margin-top:6px;font-weight:800;">${esc(it.meta)}</div>` : ``}
            <div style="margin-top:10px;display:flex;justify-content:flex-end;">
              <button class="btn primary" type="button" data-pick="${i}">Elegir</button>
            </div>
          </div>
        `).join("")}
      </div>
    `;

    card.querySelectorAll("button[data-pick]").forEach(btn => {
      btn.onclick = () => {
        const idx = Number(btn.getAttribute("data-pick"));
        onPick(items[idx] || items[0]);
      };
    });
  }

  function chooseRoleForCourse(userEmail, courseKey, profilesForCourse) {
    // profilesForCourse: [{role, profile}]
    const byRole = {};
    profilesForCourse.forEach(p => { byRole[p.role] = p.profile; });

    const roles = Object.keys(byRole);
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
      label: "👨‍👩‍👧 Apoderado",
      meta: canAutoApproveApoderado(roles)
        ? "Aprobado automáticamente"
        : "Requiere aprobación por directiva",
      role: r,
      profile: byRole[r]
    };
  }

  if (r === "presidente") {
    return {
      label: "🎓 Presidente",
      meta: "Gestión del curso y campañas",
      role: r,
      profile: byRole[r]
    };
  }

  if (r === "tesorero") {
    return {
      label: "💳 Tesorero",
      meta: "Gestión de pagos y rendiciones",
      role: r,
      profile: byRole[r]
    };
  }

  return {
    label: r,
    meta: "",
    role: r,
    profile: byRole[r]
  };
});

    renderChooser("Elegir rol", "Selecciona cómo ingresar", roleItems, (it) => {
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
    // Group by courseKey
    const courseKeys = Array.from(new Set(allProfiles.map(p => p.courseKey).filter(Boolean)));

    if (!courseKeys.length) {
      const p0 = allProfiles[0];
      const role = p0.role || "apoderado";
      if (role === "apoderado" && !requireApproved(userEmail, p0.courseKey, [role])) return;
      go(role, userEmail, p0.courseKey, p0);
      return;
    }

    if (courseKeys.length === 1) {
      const ck = courseKeys[0];
      const profilesForCourse = allProfiles.filter(p => p.courseKey === ck);
      const roleList = profilesForCourse.map(p => ({ role: p.role || "apoderado", profile: p }));

      // Si el apoderado tiene permiso de Tesorero/Presidente (directivaRole/flags o directiva_by_role),
      // lo agregamos como rol adicional para que aparezca en el selector post-login.
      const getDirectivaRole = (prof) => {
        const dr = (prof?.directivaRole ?? prof?.apoderado?.directivaRole ?? prof?.meta?.directivaRole ?? prof?.directiva ?? "");
        return String(dr || "").toLowerCase();
      };

      // Importante: aquí usamos el courseKey resuelto (ck). No existe una variable global `courseKey`.
      const hasTesoreroDirectiva = hasRoleInDirectiva(userEmail, ck, "tesorero");
      const hasPresidenteDirectiva = hasRoleInDirectiva(userEmail, ck, "presidente");

      const hasTesoreroPerm = profilesForCourse.some(p => {
        const r = String(p?.role ?? "").toLowerCase();
        const dr = getDirectivaRole(p);
        const flag = !!(p?.isTesorero || p?.tesorero === true || p?.permisos?.tesorero === true || p?.permissions?.includes?.("tesorero"));
        return flag || r === "tesorero" || r.includes("tesorero") || dr === "tesorero" || dr.includes("tesorero");
      });

      if ((hasTesoreroPerm || hasTesoreroDirectiva) && !roleList.some(r => r.role === "tesorero")) {
        // Reutilizamos el mismo perfil base del curso (apoderado)
        const base = profilesForCourse[0];
        roleList.push({ role: "tesorero", profile: base });
      }

      if (hasPresidenteDirectiva && !roleList.some(r => r.role === "presidente")) {
        const base = profilesForCourse[0];
        roleList.push({ role: "presidente", profile: base });
      }

      chooseRoleForCourse(userEmail, ck, roleList);
      return;
    }

    // Multiple courses: choose course first
    const items = courseKeys.map(ck => {
      const p0 = allProfiles.find(p => p.courseKey === ck) || allProfiles[0];
      return { courseKey: ck, label: buildCourseLabel(p0), meta: "" };
    });

    renderChooser("Elegir curso", "Tienes más de un curso", items, (it) => {
      const ck = it.courseKey;
      const profilesForCourse = allProfiles.filter(p => p.courseKey === ck);
      const roleList = profilesForCourse.map(p => ({ role: p.role || "apoderado", profile: p }));
      chooseRoleForCourse(userEmail, ck, roleList);
    });
  }

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
