/* =========================================================
   Cursapp · Login (multi-rol + debug alerts)
   - Apoderado real: email + password desde onboarding
   - Bloqueo: apoderado entra solo si enrollment approved (por curso)
   - Presidente/Tesorero demo: usuario=presidente/tesorero, pass=demo
   - Selector de curso si el usuario tiene múltiples cursos
   - Selector de rol si en el mismo curso tiene presidente + apoderado
   - DEBUG: alerts para ver variables críticas
   ========================================================= */

(function(){
  // ---- DOM ----
  const form = document.getElementById("loginForm");
  const username = document.getElementById("username");
  const password = document.getElementById("password");
  const loginError = document.getElementById("loginError");

  // ---- Keys ----
  const KEY_USERS = "cursapp_users_v1";
  const KEY_PROFILES = "cursapp_profiles_v1";
  const KEY_ACTIVE_COURSE = "cursapp_active_course_v1";
  const KEY_ACTIVE_PROFILE = "cursapp_active_profile_v1";
  const KEY_ENROLL = "cursapp_enrollments_v1";
  const KEY_DEMO_USER = "cursapp_demo_user";
  const KEY_SESSION = "cursapp_session_v1";

  // ---- Debug toggle ----
  const DEBUG_ALERTS = true; // ponlo en false cuando esté listo

  function dbg(msg){
    if(!DEBUG_ALERTS) return;
    try{ alert(msg); }catch(e){}
  }

  // ---- storage helpers ----
  function loadJSON(k, def){
    try{
      const v = localStorage.getItem(k);
      if(v==null) return def;
      return JSON.parse(v);
    }catch(e){
      return def;
    }
  }
  function saveJSON(k, v){
    localStorage.setItem(k, JSON.stringify(v));
  }

  function showErr(msg){
    if(loginError){
      loginError.style.display = "block";
      loginError.textContent = msg;
    } else {
      alert(msg);
    }
  }
  function clearErr(){
    if(loginError){
      loginError.style.display = "none";
      loginError.textContent = "";
    }
  }

  function hashDemo(str){
    let h=5381;
    const s = String(str||"");
    for(let i=0;i<s.length;i++) h = ((h<<5)+h) + s.charCodeAt(i);
    return "h_"+(h>>>0).toString(16);
  }

  function setActiveCourseKey(k){
    localStorage.setItem(KEY_ACTIVE_COURSE, String(k||""));
  }
  function setActiveProfileId(id){
    localStorage.setItem(KEY_ACTIVE_PROFILE, String(id||""));
  }

  function setSession(obj){
    saveJSON(KEY_SESSION, obj);
  }

  // compat: algunos banners/menús leen esto
  function setDemoUserBanner(obj){
    saveJSON(KEY_DEMO_USER, obj);
  }

  function profileIdOf(userEmail, p){
    return String(p?.profileId || p?.id || (userEmail+"||"+(p?.courseKey||"")+"||"+(p?.role||"")));
  }

  function buildCourseLabel(p){
    const c = p.course || {};
    return `${c.schoolName||"Colegio"} · ${c.level||""}${c.letter||""} ${c.year||""} · ${c.jornada||""}`;
  }

  // ===== Enrollment approval =====
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

  // ---- navigation ----
  function go(role, userEmail, courseKey, profile){
    const pid = profile ? profileIdOf(userEmail, profile) : "";

    // Guardar contexto siempre
    if(courseKey) setActiveCourseKey(courseKey);
    if(pid) setActiveProfileId(pid);

    setSession({
      userId: userEmail,
      role: role,
      courseKey: courseKey || "",
      profileId: pid || ""
    });

    // Compat banner
    if(role==="apoderado" && profile){
      const ap = profile.apoderado || {};
      setDemoUserBanner({
        name: (ap.name || "Apoderado") + " (Demo)",
        role: "apoderado",
        alumno: ap.alumno || "Alumno",
        email: userEmail
      });
    } else {
      setDemoUserBanner({
        name: (role === "presidente" ? "Presidente" : role === "tesorero" ? "Tesorero" : "Usuario") + " (Demo)",
        role: role
      });
    }

    dbg(
      "[REDIRECT]\n" +
      "role: " + role + "\n" +
      "userId: " + userEmail + "\n" +
      "courseKey: " + (courseKey||"") + "\n" +
      "profileId: " + (pid||"") + "\n\n" +
      "session:\n" + JSON.stringify(loadJSON(KEY_SESSION, {}), null, 2)
    );

    window.location.href = role + ".html";
  }

  function showRoleChooser(userEmail, courseKey, apProfile, prProfile){
    const card = document.querySelector(".auth-card");
    const label = buildCourseLabel(apProfile || prProfile || {course:{}});

    const html = `
      <div class="brandCenter">
        <div class="logo big">C</div>
        <h1>Cursapp</h1>
        <p class="muted">Elegir rol</p>
      </div>

      <div style="margin-top:12px;padding:12px;border:1px solid rgba(229,231,235,.9);border-radius:14px;">
        <div style="font-weight:950;">${label}</div>
        <div class="muted" style="margin-top:6px;font-weight:800;">
          Tienes más de un rol en este curso.
        </div>

        <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end;">
          <button class="btn primary" type="button" id="pickPresident">Entrar como Presidente</button>
          <button class="btn primary" type="button" id="pickApoderado">Entrar como Apoderado</button>
        </div>
      </div>

      <p class="muted small" style="margin-top:14px;">
        Si eliges Apoderado, requiere aprobación por la directiva.
      </p>
    `;

    if(card){
      card.innerHTML = html;
      const bp = document.getElementById("pickPresident");
      const ba = document.getElementById("pickApoderado");

      if(bp) bp.onclick = ()=> go("presidente", userEmail, courseKey, prProfile || apProfile);
      if(ba) ba.onclick = ()=>{
        if(!ensureApprovedOrBlock(userEmail, courseKey)) return;
        go("apoderado", userEmail, courseKey, apProfile || prProfile);
      };
      return;
    }

    const pick = prompt("Entrar como (1) Presidente o (2) Apoderado:", "1");
    if(pick==="2"){
      if(!ensureApprovedOrBlock(userEmail, courseKey)) return;
      go("apoderado", userEmail, courseKey, apProfile || prProfile);
    } else {
      go("presidente", userEmail, courseKey, prProfile || apProfile);
    }
  }

  function showCourseChooser(userEmail, profiles, onPick){
    const card = document.querySelector(".auth-card");

    if(!card){
      const chosen = prompt("Tienes más de un curso. Ingresa el índice (1..n):", "1");
      const idx = Number(chosen||1)-1;
      const p = profiles[idx] || profiles[0];
      onPick(p);
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
          return `
            <div style="padding:12px;border:1px solid rgba(229,231,235,.9);border-radius:14px;margin-top:10px;">
              <div style="font-weight:950;">${label}</div>
              <div class="muted" style="margin-top:6px;font-weight:800;">
                Selecciona para continuar.
              </div>
              <div style="margin-top:10px;display:flex;justify-content:flex-end;">
                <button class="btn primary" type="button" data-pick="${i}">Elegir</button>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;

    card.querySelectorAll("button[data-pick]").forEach(btn=>{
      btn.onclick = ()=>{
        const idx = Number(btn.getAttribute("data-pick"));
        const p = profiles[idx] || profiles[0];
        onPick(p);
      };
    });
  }

  // ---- submit handler ----
  if(!form){
    // si esto pasa, el login.html no coincide con IDs
    dbg("[LOGIN] No existe #loginForm en el DOM");
    return;
  }

  form.addEventListener("submit", (e)=>{
    e.preventDefault();
    clearErr();

    const u = String(username?.value||"").trim().toLowerCase();
    const p = String(password?.value||"");

    dbg("[LOGIN SUBMIT]\nuser: "+u+"\npassLen: "+p.length);

    // Demo roles
    if((u==="tesorero" || u==="presidente") && p==="demo"){
      // NO borramos active_profile aquí
      setSession({ userId: u, role: u, courseKey:"", profileId:"" });
      setDemoUserBanner({ name: (u==="presidente"?"Presidente":"Tesorero")+" (Demo)", role: u });
      window.location.href = u + ".html";
      return;
    }

    // Demo apoderado bloqueado
    if(u==="apoderado" && p==="demo"){
      showErr("Para ingresar como apoderado debes estar aprobado por la directiva. Completa onboarding como apoderado.");
      return;
    }

    // Real user auth
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
      showErr("No hay cursos asociados a este usuario. Completa onboarding.");
      return;
    }

    const apProfiles = allProfiles.filter(pr=>pr.role==="apoderado");
    const prProfiles = allProfiles.filter(pr=>pr.role==="presidente");

    dbg(
      "[PROFILES]\n" +
      "total: " + allProfiles.length + "\n" +
      "apoderado: " + apProfiles.length + "\n" +
      "presidente: " + prProfiles.length + "\n" +
      "courseKeys: " + JSON.stringify([...new Set(allProfiles.map(p=>p.courseKey).filter(Boolean))])
    );

    // Resolve course selection
    const courseKeys = [...new Set(allProfiles.map(p=>p.courseKey).filter(Boolean))];
    const pickCourse = (courseKey)=>{
      const ap = apProfiles.find(x=>x.courseKey===courseKey) || null;
      const pr = prProfiles.find(x=>x.courseKey===courseKey) || null;

      // Case: both roles in same course -> choose
      if(ap && pr){
        showRoleChooser(u, courseKey, ap, pr);
        return;
      }

      // Only apoderado
      if(ap && !pr){
        if(!ensureApprovedOrBlock(u, courseKey)) return;
        go("apoderado", u, courseKey, ap);
        return;
      }

      // Only presidente
      if(pr && !ap){
        go("presidente", u, courseKey, pr);
        return;
      }

      // Fallback: if something odd
      if(apProfiles.length){
        const ap0 = apProfiles[0];
        if(!ensureApprovedOrBlock(u, ap0.courseKey)) return;
        go("apoderado", u, ap0.courseKey, ap0);
      } else if(prProfiles.length){
        const pr0 = prProfiles[0];
        go("presidente", u, pr0.courseKey, pr0);
      } else {
        showErr("No hay perfiles válidos para este usuario.");
      }
    };

    // If only 1 courseKey -> go
    if(courseKeys.length<=1){
      const ck = courseKeys[0] || (apProfiles[0]?.courseKey || prProfiles[0]?.courseKey || "");
      if(!ck){
        showErr("No se pudo resolver el curso activo. Reintenta onboarding.");
        return;
      }
      pickCourse(ck);
      return;
    }

    // Multiple courses -> choose course, then role
    // Build representative profiles per course
    const reps = courseKeys.map(ck=>{
      return apProfiles.find(p=>p.courseKey===ck) || prProfiles.find(p=>p.courseKey===ck);
    }).filter(Boolean);

    showCourseChooser(u, reps, (p0)=> pickCourse(p0.courseKey));
  });

})();
