/* =========================================================
   Cursapp · Login (multi-rol por curso)
   - Apoderado real: email + password desde onboarding
   - Bloqueo A: apoderado NO entra hasta que directiva apruebe enrollment
   - Tesorero/Presidente demo: usuario=tesorero/presidente, pass=demo
   - Selector de curso si el usuario tiene múltiples perfiles
   - Selector de rol si el usuario tiene (presidente + apoderado) en el mismo curso
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
  const KEY_SESSION = "cursapp_session_v1";

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

  function setSession(userId, role, courseKey, profileId){
    saveJSON(KEY_SESSION, {
      userId,
      role,
      courseKey: courseKey || "",
      profileId: profileId || ""
    });
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

  // Back-compat: pantallas antiguas leen KEY_DEMO_USER para banner/menú
  function setApoderadoBanner(userEmail, profile){
    const ap = profile?.apoderado || {};
    saveJSON(KEY_DEMO_USER, {
      name: (ap.name || "Apoderado") + " (Demo)",
      role: "apoderado",
      alumno: ap.alumno || "Alumno",
      email: userEmail
    });
  }
  function setRoleBanner(role){
    saveJSON(KEY_DEMO_USER, {
      name: (role === "presidente" ? "Presidente" : "Tesorero") + " (Demo)",
      role
    });
  }

  function profileIdOf(userEmail, p){
    return String(p?.profileId || p?.id || (userEmail+"||"+(p?.courseKey||"")+"||"+(p?.role||"")));
  }

  function goAsRole(userEmail, role, profile, requireApproval){
    const courseKey = profile?.courseKey || "";
    const pid = profileIdOf(userEmail, profile);

    if(requireApproval){
      if(!ensureApprovedOrBlock(userEmail, courseKey)) return;
    }

    setActiveCourseKey(courseKey);
    setActiveProfileId(pid);
    setSession(userEmail, role, courseKey, pid);

    if(role==="apoderado") setApoderadoBanner(userEmail, profile);
    else setRoleBanner(role);

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
      if(bp) bp.onclick = ()=> goAsRole(userEmail, "presidente", prProfile || apProfile, false);
      if(ba) ba.onclick = ()=> goAsRole(userEmail, "apoderado", apProfile || prProfile, true);
      return;
    }

    const pick = prompt("Entrar como (1) Presidente o (2) Apoderado:", "1");
    if(pick==="2") goAsRole(userEmail, "apoderado", apProfile || prProfile, true);
    else goAsRole(userEmail, "presidente", prProfile || apProfile, false);
  }

  function showCourseChooser(userEmail, profiles, roleToEnter, requireApproval){
    const card = document.querySelector(".auth-card");

    if(!card){
      const chosen = prompt("Tienes más de un curso. Ingresa el índice (1..n):", "1");
      const idx = Number(chosen||1)-1;
      const p = profiles[idx] || profiles[0];
      goAsRole(userEmail, roleToEnter, p, requireApproval);
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

          const disabled = (roleToEnter==="apoderado" && requireApproval && !approved);
          const disabledAttr = disabled ? "disabled" : "";
          const btnClass = disabled ? "btn ghost" : "btn primary";
          const buttonText = disabled ? "Bloqueado" : "Elegir";

          return `
            <div style="padding:12px;border:1px solid rgba(229,231,235,.9);border-radius:14px;margin-top:10px;">
              <div style="font-weight:950;">${label}</div>
              <div class="muted" style="margin-top:6px;font-weight:800;">
                ${statusTxt}${payTxt}
              </div>
              <div style="margin-top:10px;display:flex;justify-content:flex-end;">
                <button class="${btnClass}" type="button" data-pick="${i}" ${disabledAttr}>${buttonText}</button>
              </div>
            </div>
          `;
        }).join("")}
      </div>

      ${roleToEnter==="apoderado" ? `
        <p class="muted small" style="margin-top:14px;">
          El apoderado no puede ingresar hasta que la directiva apruebe la solicitud.
        </p>
      ` : ``}
    `;

    card.querySelectorAll("button[data-pick]").forEach(btn=>{
      btn.onclick = ()=>{
        const idx = Number(btn.getAttribute("data-pick"));
        const p = profiles[idx] || profiles[0];
        goAsRole(userEmail, roleToEnter, p, requireApproval);
      };
    });
  }

  form?.addEventListener("submit", (e)=>{
    e.preventDefault();
    clearErr();

    const u = String(username.value||"").trim().toLowerCase();
    const p = String(password.value||"");

    // Demo roles
    if((u==="tesorero" || u==="presidente") && p==="demo"){
      setRoleBanner(u);
      setSession(u, u, "", "");
      window.location.href = u + ".html";
      return;
    }

    // Demo apoderado bloqueado
    if(u==="apoderado" && p==="demo"){
      showErr("Para ingresar como apoderado debes estar aprobado por la directiva. Completa onboarding como apoderado.");
      return;
    }

    // Real login (email/password)
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

    const allProfiles = loadJSON(KEY_PROFILES, []).filter(pr=>pr.userId===user.userId);
    const apProfiles = allProfiles.filter(pr=>pr.role==="apoderado");
    const prProfiles = allProfiles.filter(pr=>pr.role==="presidente");

    // Caso: no registró hijo => solo presidente (si existe)
    if(!apProfiles.length && prProfiles.length){
      if(prProfiles.length===1){
        goAsRole(u, "presidente", prProfiles[0], false);
      } else {
        showCourseChooser(u, prProfiles, "presidente", false);
      }
      return;
    }

    if(!apProfiles.length && !prProfiles.length){
      showErr("No hay cursos asociados a este usuario. Completa onboarding.");
      return;
    }

    const courseKeys = Array.from(new Set(allProfiles.map(p=>p.courseKey).filter(Boolean)));

    function chooseForCourse(courseKey){
      const ap = apProfiles.find(x=>x.courseKey===courseKey) || null;
      const pr = prProfiles.find(x=>x.courseKey===courseKey) || null;

      if(ap && pr){
        showRoleChooser(u, courseKey, ap, pr);
        return;
      }
      if(ap && !pr){
        goAsRole(u, "apoderado", ap, true);
        return;
      }
      if(pr && !ap){
        goAsRole(u, "presidente", pr, false);
        return;
      }

      if(apProfiles.length) goAsRole(u, "apoderado", apProfiles[0], true);
      else goAsRole(u, "presidente", prProfiles[0], false);
    }

    if(courseKeys.length<=1){
      const ck = courseKeys[0] || (apProfiles[0]?.courseKey || prProfiles[0]?.courseKey || "");
      if(!ck){
        showErr("No se pudo resolver el curso activo. Reintenta onboarding.");
        return;
      }
      chooseForCourse(ck);
      return;
    }

    if(apProfiles.length && !prProfiles.length){
      showCourseChooser(u, apProfiles, "apoderado", true);
      return;
    }
    if(prProfiles.length && !apProfiles.length){
      showCourseChooser(u, prProfiles, "presidente", false);
      return;
    }

    const representative = courseKeys.map(ck=>{
      return apProfiles.find(p=>p.courseKey===ck) || prProfiles.find(p=>p.courseKey===ck);
    }).filter(Boolean);

    const card = document.querySelector(".auth-card");
    if(!card){
      const chosen = prompt("Tienes más de un curso. Ingresa el índice (1..n):", "1");
      const idx = Number(chosen||1)-1;
      const p0 = representative[idx] || representative[0];
      chooseForCourse(p0.courseKey);
      return;
    }

    card.innerHTML = `
      <div class="brandCenter">
        <div class="logo big">C</div>
        <h1>Cursapp</h1>
        <p class="muted">Elegir curso</p>
      </div>

      <div style="margin-top:12px;">
        ${representative.map((p,i)=>{
          const label = buildCourseLabel(p);
          return `
            <div style="padding:12px;border:1px solid rgba(229,231,235,.9);border-radius:14px;margin-top:10px;">
              <div style="font-weight:950;">${label}</div>
              <div class="muted" style="margin-top:6px;font-weight:800;">
                Selecciona para elegir rol.
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
        const p0 = representative[idx] || representative[0];
        chooseForCourse(p0.courseKey);
      };
    });
  });

})();
