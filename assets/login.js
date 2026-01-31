/* =========================================================
   Cursapp · Login (con aprobación obligatoria)
   - Apoderado real: email + password desde onboarding
   - Bloqueo A: apoderado NO entra hasta que directiva apruebe enrollment
   - Tesorero/Presidente demo: usuario=tesorero/presidente, pass=demo
   - Selector de curso si apoderado tiene múltiples perfiles
   ========================================================= */

(function(){
  const form = document.getElementById("loginForm");
  const username = document.getElementById("username");
  const password = document.getElementById("password");
  const loginError = document.getElementById("loginError");

  const KEY_USERS = "cursapp_users_v1";
  const KEY_PROFILES = "cursapp_profiles_v1";
  const KEY_ACTIVE_COURSE = "cursapp_active_course_v1";
  const KEY_ACTIVE_PROFILE = "cursapp_active_profile_v1";
  const KEY_ENROLL = "cursapp_enrollments_v1";
  const KEY_DEMO_USER = "cursapp_demo_user";

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
    if(!loginError) return;
    loginError.style.display = "block";
    loginError.textContent = msg;
  }
  function clearErr(){
    if(!loginError) return;
    loginError.style.display = "none";
    loginError.textContent = "";
  }

  function hashDemo(str){
    let h=5381;
    const s = String(str||"");
    for(let i=0;i<s.length;i++) h = ((h<<5)+h) + s.charCodeAt(i);
    return "h_"+(h>>>0).toString(16);
  }

  function setActiveCourseKey(k){
    localStorage.setItem(KEY_ACTIVE_COURSE, k);
  }

  function setActiveProfileId(id){
    localStorage.setItem(KEY_ACTIVE_PROFILE, String(id||""));
  }

  function buildCourseLabel(p){
    const c = p.course || {};
    return `${c.schoolName||"Colegio"} · ${c.level||""}${c.letter||""} ${c.year||""} · ${c.jornada||""}`;
  }

  // ====== Aprobación obligatoria (A) ======
  function enrollments(){
    return loadJSON(KEY_ENROLL, []);
  }

  function findEnrollment(email, courseKey){
    const e = String(email||"").trim().toLowerCase();
    const ck = String(courseKey||"");
    const list = enrollments();

    const matches = list
      .filter(x => String(x.email||"").trim().toLowerCase() === e && String(x.courseKey||"") === ck)
      .sort((a,b)=>String(b.createdAt||"").localeCompare(String(a.createdAt||"")));

    return matches[0] || null;
  }

  function ensureApprovedOrBlock(email, courseKey){
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
  // ======================================

  // ✅ NUEVO: guardar sesión apoderado para banner/menú tesorero
  function setApoderadoSession(userEmail, profile){
    const ap = profile?.apoderado || {};
    saveJSON(KEY_DEMO_USER, {
      name: (ap.name || "Apoderado") + " (Demo)",
      role: "apoderado",
      alumno: ap.alumno || "Alumno",
      email: userEmail
    });
  }

  function showCourseChooser(userEmail, profiles){
    const card = document.querySelector(".auth-card");
    if(!card){
      const chosen = prompt("Tienes más de un curso. Ingresa el índice (1..n):", "1");
      const idx = Number(chosen||1)-1;
      const p = profiles[idx] || profiles[0];
      if(!ensureApprovedOrBlock(userEmail, p.courseKey)) return;

      setActiveCourseKey(p.courseKey);
      setActiveProfileId(p.profileId || p.id || (userEmail+"||"+p.courseKey));
      setApoderadoSession(userEmail, p);  // ✅
      window.location.href = "apoderado.html";
      return;
    }

    card.innerHTML = `
      <div class="brandCenter">
        <div class="logo big">C</div>
        <h1>Cursapp</h1>
        <p class="muted">Elegir curso</p>
      </div>

      <div style="margin-top:12px;">
        ${profiles.map((p,i)=>{
          const label = buildCourseLabel(p);
          const enr = findEnrollment(userEmail, p.courseKey);
          const approved = enr && enr.status === "approved";
          const statusTxt = !enr
            ? "⏳ Sin solicitud (debes registrarte)"
            : (approved ? "✅ Aprobado por directiva" : "⏳ Pendiente de aprobación");
          const payTxt = enr?.activation?.status
            ? (enr.activation.status === "paid" ? " · Pago OK" : " · Pago pendiente")
            : "";

          const disabledAttr = approved ? "" : "disabled";
          const btnClass = approved ? "btn primary" : "btn ghost";

          return `
            <div style="padding:12px;border:1px solid rgba(229,231,235,.9);border-radius:14px;margin-top:10px;">
              <div style="font-weight:950;">${label}</div>
              <div class="muted" style="margin-top:6px;font-weight:800;">
                ${statusTxt}${payTxt}
              </div>
              <div style="margin-top:10px;display:flex;justify-content:flex-end;">
                <button class="${btnClass}" type="button" data-pick="${i}" ${disabledAttr}>${approved ? "Elegir" : "Bloqueado"}</button>
              </div>
            </div>
          `;
        }).join("")}
      </div>

      <p class="muted small" style="margin-top:14px;">
        El apoderado no puede ingresar hasta que la directiva apruebe la solicitud.
      </p>
    `;

    card.querySelectorAll("button[data-pick]").forEach(btn=>{
      btn.onclick = ()=>{
        const idx = Number(btn.getAttribute("data-pick"));
        const p = profiles[idx] || profiles[0];

        if(!ensureApprovedOrBlock(userEmail, p.courseKey)) return;

        setActiveCourseKey(p.courseKey);
      setActiveProfileId(p.profileId || p.id || (userEmail+"||"+p.courseKey));
      setApoderadoSession(userEmail, p); // ✅
        window.location.href = "apoderado.html";
      };
    });
  }

  form?.addEventListener("submit", (e)=>{
    e.preventDefault();
    clearErr();

    const u = String(username.value||"").trim().toLowerCase();
    const p = String(password.value||"");

    // Demo roles (guardan sesión)
    if((u==="tesorero" || u==="presidente") && p==="demo"){
      saveJSON(KEY_DEMO_USER, {
        name: (u === "presidente" ? "Presidente" : "Tesorero") + " (Demo)",
        role: u
      });
      localStorage.removeItem(KEY_ACTIVE_PROFILE);
      window.location.href = u + ".html";
      return;
    }

    // Demo apoderado bloqueado
    if(u==="apoderado" && p==="demo"){
      showErr("Para ingresar como apoderado debes estar aprobado por la directiva. Completa onboarding como apoderado.");
      return;
    }

    // Real apoderado login (email/password)
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

    // Load profiles for this user
    const profiles = loadJSON(KEY_PROFILES, []).filter(pr=>pr.userId===user.userId && pr.role==="apoderado");
    if(!profiles.length){
      showErr("No hay cursos asociados a este usuario. Completa onboarding.");
      return;
    }

    // 1 curso: validar aprobación + guardar sesión apoderado
    if(profiles.length===1){
      const courseKey = profiles[0].courseKey;

      if(!ensureApprovedOrBlock(u, courseKey)) return;

      setActiveCourseKey(courseKey);
      setActiveProfileId(profiles[0].profileId || profiles[0].id || (u+"||"+courseKey));
      setApoderadoSession(u, profiles[0]); // ✅
      window.location.href = "apoderado.html";
      return;
    }

    // Multiple courses
    showCourseChooser(u, profiles);
  });

})();
