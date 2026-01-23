/* =========================================================
   Cursapp · Login
   - Apoderado real: email + password desde onboarding
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

  function buildCourseLabel(p){
    const c = p.course || {};
    return `${c.schoolName||"Colegio"} · ${c.level||""}${c.letter||""} ${c.year||""} · ${c.jornada||""}`;
  }

  function showCourseChooser(profiles){
    // Replace the login card content with chooser (safe & simple)
    const card = document.querySelector(".auth-card");
    if(!card){
      // fallback prompt
      const chosen = prompt("Tienes más de un curso. Ingresa el índice (1..n):", "1");
      const idx = Number(chosen||1)-1;
      const p = profiles[idx] || profiles[0];
      setActiveCourseKey(p.courseKey);
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
        ${profiles.map((p,i)=>`
          <div style="padding:12px;border:1px solid rgba(229,231,235,.9);border-radius:14px;margin-top:10px;">
            <div style="font-weight:950;">${buildCourseLabel(p)}</div>
            <div class="muted" style="margin-top:6px;font-weight:800;">
              ${p.activation?.required ? (p.activation.status==="paid"?"✅ Activo":"⏳ Activación pendiente") : "✅ Activo"}
            </div>
            <div style="margin-top:10px;display:flex;justify-content:flex-end;">
              <button class="btn primary" type="button" data-pick="${i}">Elegir</button>
            </div>
          </div>
        `).join("")}
      </div>

      <p class="muted small" style="margin-top:14px;">
        Si eliges un curso con activación pendiente, se bloqueará el uso hasta pagar.
      </p>
    `;

    card.querySelectorAll("button[data-pick]").forEach(btn=>{
      btn.onclick = ()=>{
        const idx = Number(btn.getAttribute("data-pick"));
        const p = profiles[idx] || profiles[0];
        setActiveCourseKey(p.courseKey);
        window.location.href = "apoderado.html";
      };
    });
  }

  form?.addEventListener("submit", (e)=>{
    e.preventDefault();
    clearErr();

    const u = String(username.value||"").trim().toLowerCase();
    const p = String(password.value||"");

    // Demo roles keep working
    if((u==="tesorero" || u==="presidente") && p==="demo"){
      window.location.href = u + ".html";
      return;
    }

    // Backward-compat demo apoderado
    if(u==="apoderado" && p==="demo"){
      window.location.href = "apoderado.html";
      return;
    }

    // Real apoderado login
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

    if(profiles.length===1){
      setActiveCourseKey(profiles[0].courseKey);
      window.location.href = "apoderado.html";
      return;
    }

    // Multiple courses: show chooser
    showCourseChooser(profiles);
  });

})();
