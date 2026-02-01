/* =========================================================
   Cursapp · Login (rewrite: perfil activo + multi-rol)
   Objetivos:
   - Un usuario puede tener múltiples perfiles (apoderado / presidente / tesorero) por curso.
   - La sesión SIEMPRE se amarra a un profileId (perfil activo).
   - Selector de curso si hay múltiples courseKey.
   - Selector de rol si en el mismo courseKey existen varios roles.
   - Apoderado requiere enrollment approved (por curso).
   - Mantiene accesos demo: presidente/tesorero con pass demo.
   ========================================================= */

(function(){
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

  // ===== storage helpers =====
  function loadJSON(k, def){
    try{
      const v = localStorage.getItem(k);
      if(v==null) return def;
      return JSON.parse(v);
    }catch(e){
      return def;
    }
  }
  function saveJSON(k, v){ localStorage.setItem(k, JSON.stringify(v)); }

  function showErr(msg){
    if(loginError){
      loginError.style.display = "block";
      loginError.textContent = msg;
    }else{
      alert(msg);
    }
  }
  function clearErr(){
    if(loginError){
      loginError.style.display = "none";
      loginError.textContent = "";
    }
  }

  // demo hash used in onboarding
  function hashDemo(str){
    let h=5381;
    const s = String(str||"");
    for(let i=0;i<s.length;i++) h = ((h<<5)+h) + s.charCodeAt(i);
    return "h_"+(h>>>0).toString(16);
  }

  function setActiveCourseKey(k){ localStorage.setItem(KEY_ACTIVE_COURSE, String(k||"")); }
  function setActiveProfileId(id){ localStorage.setItem(KEY_ACTIVE_PROFILE, String(id||"")); }

  function setSession(session){
    // session = { userId, profileId, role, courseKey }
    saveJSON(KEY_SESSION, session);
  }

  // Back-compat banner (some pages still read this)
  function setBanner(obj){ saveJSON(KEY_DEMO_USER, obj); }

  function buildCourseLabel(p){
    const c = p.course || {};
    return `${c.schoolName||"Colegio"} · ${c.level||""}${c.letter||""} ${c.year||""} · ${c.jornada||""}`;
  }

  function profileIdOf(userEmail, p){
    // stable fallback
    return String(p?.profileId || p?.id || (userEmail+"||"+(p?.courseKey||"")+"||"+(p?.role||"")));
  }

  // ===== enrollment approval =====
  function enrollments(){ return loadJSON(KEY_ENROLL, []); }

  function findEnrollment(email, courseKey){
    const e = String(email||"").trim().toLowerCase();
    const ck = String(courseKey||"");
    const list = enrollments();
    const matches = list
      .filter(x => String(x.email||"").trim().toLowerCase() === e && String(x.courseKey||"") === ck)
      .sort((a,b)=>String(b.createdAt||"").localeCompare(String(a.createdAt||"")));
    return matches[0] || null;
  }

  function requireApproved(email, courseKey){
    const enr = findEnrollment(email, courseKey);
    if(!enr){
      showErr("No existe una solicitud para este curso. Completa onboarding como apoderado para enviar tu solicitud.");
      return false;
    }
    if(enr.status !== "approved"){
      showErr("Tu solicitud está pendiente de aprobación por la directiva.");
      return false;
    }
    return true;
  }

  // ===== routing by role =====
  function go(role, userEmail, courseKey, profile){
    const pid = profile ? profileIdOf(userEmail, profile) : "";
    setActiveCourseKey(courseKey || "");
    setActiveProfileId(pid || "");
    setSession({
      userId: userEmail,
      role,
      courseKey: courseKey || "",
      profileId: pid || ""
    });

    if(role==="apoderado" && profile){
      const ap = profile.apoderado || {};
      setBanner({
        name: (ap.name || "Apoderado") + " (Demo)",
        role: "apoderado",
        alumno: ap.alumno || "Alumno",
        email: userEmail
      });
    }else{
      setBanner({
        name: (role==="presidente" ? "Presidente" : role==="tesorero" ? "Tesorero" : "Usuario") + " (Demo)",
        role
      });
    }

    window.location.href = role + ".html";
  }

  // ===== UI: choose course =====
  function renderChooser(title, subtitle, items, onPick){
    const card = document.querySelector(".auth-card");
    if(!card){
      const chosen = prompt(title + "\n" + subtitle + "\n\nIngresa el índice (1..n):", "1");
      const idx = Number(chosen||1)-1;
      onPick(items[idx] || items[0]);
      return;
    }

    card.innerHTML = `
      <div class="brandCenter">
        <div class="logo big">C</div>
        <h1>Cursapp</h1>
        <p class="muted">${title}</p>
      </div>

      <div style="margin-top:12px;">
        ${items.map((it,i)=>`
          <div style="padding:12px;border:1px solid rgba(229,231,235,.9);border-radius:14px;margin-top:10px;">
            <div style="font-weight:950;">${it.label}</div>
            ${it.meta ? `<div class="muted" style="margin-top:6px;font-weight:800;">${it.meta}</div>` : ``}
            <div style="margin-top:10px;display:flex;justify-content:flex-end;">
              <button class="btn primary" type="button" data-pick="${i}">Elegir</button>
            </div>
          </div>
        `).join("")}
      </div>
    `;

    card.querySelectorAll("button[data-pick]").forEach(btn=>{
      btn.onclick = ()=>{
        const idx = Number(btn.getAttribute("data-pick"));
        onPick(items[idx] || items[0]);
      };
    });
  }

  function chooseRoleForCourse(userEmail, courseKey, profilesForCourse){
    // profilesForCourse: [{role, profile}]
    const byRole = {};
    profilesForCourse.forEach(p=>{ byRole[p.role]=p.profile; });

    const roles = Object.keys(byRole);
    if(roles.length===1){
      const role = roles[0];
      if(role==="apoderado" && !requireApproved(userEmail, courseKey)) return;
      go(role, userEmail, courseKey, byRole[role]);
      return;
    }

    const roleItems = roles.map(r=>({
      label: r==="presidente" ? "Entrar como Presidente" : r==="tesorero" ? "Entrar como Tesorero" : "Entrar como Apoderado",
      meta: r==="apoderado" ? "Requiere aprobación por directiva" : "",
      role: r,
      profile: byRole[r]
    }));

    renderChooser("Elegir rol", "Selecciona cómo ingresar", roleItems, (it)=>{
      if(it.role==="apoderado" && !requireApproved(userEmail, courseKey)) return;
      go(it.role, userEmail, courseKey, it.profile);
    });
  }

  function resolveAndEnter(userEmail, allProfiles){
    // Group by courseKey
    const courseKeys = Array.from(new Set(allProfiles.map(p=>p.courseKey).filter(Boolean)));

    // If no courseKey, fallback to first profile
    if(!courseKeys.length){
      const p0 = allProfiles[0];
      const role = p0.role || "apoderado";
      if(role==="apoderado" && !requireApproved(userEmail, p0.courseKey)) return;
      go(role, userEmail, p0.courseKey, p0);
      return;
    }

    if(courseKeys.length===1){
      const ck = courseKeys[0];
      const profilesForCourse = allProfiles.filter(p=>p.courseKey===ck);
      // map to role list
      const roleList = profilesForCourse.map(p=>({ role: p.role || "apoderado", profile: p }));
      chooseRoleForCourse(userEmail, ck, roleList);
      return;
    }

    // Multiple courses: choose course first
    const items = courseKeys.map(ck=>{
      const p0 = allProfiles.find(p=>p.courseKey===ck) || allProfiles[0];
      return { courseKey: ck, label: buildCourseLabel(p0), meta: "" };
    });

    renderChooser("Elegir curso", "Tienes más de un curso", items, (it)=>{
      const ck = it.courseKey;
      const profilesForCourse = allProfiles.filter(p=>p.courseKey===ck);
      const roleList = profilesForCourse.map(p=>({ role: p.role || "apoderado", profile: p }));
      chooseRoleForCourse(userEmail, ck, roleList);
    });
  }

  // ===== submit =====
  if(!form){
    showErr("Login inválido: falta #loginForm");
    return;
  }

  form.addEventListener("submit", (e)=>{
    e.preventDefault();
    clearErr();

    const u = String(username?.value||"").trim().toLowerCase();
    const p = String(password?.value||"");

    // Demo presidente/tesorero
    if((u==="tesorero" || u==="presidente") && p==="demo"){
      setSession({ userId: u, role: u, courseKey: "", profileId: "" });
      setBanner({ name: (u==="presidente" ? "Presidente" : "Tesorero") + " (Demo)", role: u });
      window.location.href = u + ".html";
      return;
    }

    // Demo apoderado blocked
    if(u==="apoderado" && p==="demo"){
      showErr("Para ingresar como apoderado debes estar aprobado por la directiva. Completa onboarding como apoderado.");
      return;
    }

    // Real login
    const users = loadJSON(KEY_USERS, []);
    const user = users.find(x=>x.email===u);
    if(!user){
      showErr("Usuario no registrado. Usa Onboarding para crear cuenta.");
      return;
    }

    const hash = hashDemo(p);
    if(user.passwordHashDemo !== hash){
      showErr("Contraseña incorrecta.");
      return;
    }

    // Load all profiles for this user (multi-rol)
    const allProfiles = loadJSON(KEY_PROFILES, []).filter(pr=>pr.userId===user.userId);
    if(!allProfiles.length){
      showErr("No hay perfiles asociados. Completa onboarding.");
      return;
    }

    // Normalize roles to expected set (apoderado/presidente/tesorero)
    const norm = allProfiles.map(pr=>{
      const role = String(pr.role || pr.user?.role || "apoderado").toLowerCase();
      return { ...pr, role };
    });

    resolveAndEnter(u, norm);
  });
})();
