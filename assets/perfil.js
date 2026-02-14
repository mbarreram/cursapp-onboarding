/* =========================================================
   Cursapp · perfil.js (editable)
   - Módulo "Mi perfil"
   - Edita datos básicos (nombre, alumno, teléfono)
   - Cambia contraseña (localStorage demo)
   - Usa sesión normalizada (CURSAPP.getSessionSafe / getSession)
   ========================================================= */

// --- DOM helpers (local, para no depender de otros módulos) ---
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

// --- esc helper (local) ---
const esc = (s) => String(s ?? "").replace(/[&<>\'\"]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;","\"":"&quot;"}[c]));

const el = (id) => document.getElementById(id);
// --------------------------------------------------------------


(function(){
  function esc(s){
    return String(s ?? "").replace(/[&<>"']/g, function(c){
      return ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"})[c];
    });
  }
  function safeJsonParse(v){ try{ return JSON.parse(v); }catch(e){ return null; } }
  function loadJSON(key, fallback){
    var raw=null; try{ raw=localStorage.getItem(key); }catch(_){ raw=null; }
    var v=safeJsonParse(raw);
    return (v==null ? (fallback==null?null:fallback) : v);
  }
  function saveJSON(key, value){
    try{ localStorage.setItem(key, JSON.stringify(value)); }catch(_){}
  }

  // Mismo hashDemo del login (para cambiar contraseña)
  function hashDemo(str) {
    var h = 5381;
    var s = String(str || "");
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h) + s.charCodeAt(i);
    return "h_" + ((h >>> 0).toString(16));
  }


  function parseCourseKey(courseKey){
    // courseKey format: "sch-central|2°|B|Mañana|2026"
    var parts = String(courseKey||"").split("|");
    if(parts.length < 5) return null;
    return {
      schoolId: parts[0] || "",
      level: parts[1] || "",
      letter: parts[2] || "",
      jornada: parts[3] || "",
      year: parts[4] || ""
    };
  }
  function schoolNameFromId(id){
    var map = {
      "sch-central": "Colegio Central (Demo)",
      "sch-demo": "Colegio Demo"
    };
    return map[String(id||"")] || String(id||"—");
  }

  function getSession(){
    try{
      if(window.CURSAPP && typeof window.CURSAPP.getSessionSafe === "function"){
        return window.CURSAPP.getSessionSafe() || {};
      }
      if(window.CURSAPP && typeof window.CURSAPP.getSession === "function"){
        return window.CURSAPP.getSession() || {};
      }
    }catch(_){ }
    return loadJSON("cursapp_session_v1", {}) || {};
  }

  function loadProfiles(){
    return loadJSON("cursapp_profiles_v1", []) || [];
  }
  function saveProfiles(profiles){
    saveJSON("cursapp_profiles_v1", profiles || []);
  }

  function pickActiveProfile(profiles, session){
    var id = null;
    try{ id = localStorage.getItem("cursapp_active_profile_v1"); }catch(_){ id=null; }
    if(!id && session && session.profileId) id = String(session.profileId);

    if(!profiles) return null;

    // array
    if(Array.isArray(profiles) && id){
      for(var i=0;i<profiles.length;i++){
        if(String(profiles[i].profileId || profiles[i].id) === String(id)) return profiles[i];
      }
    }
    // fallback: match email + courseKey
    var email = String(session.email || session.userId || "").toLowerCase().trim();
    var ck = String(session.courseKey || session.activeCourse || "").trim();
    if(!email) return null;
    if(Array.isArray(profiles)){
      for(var j=0;j<profiles.length;j++){
        var pr = profiles[j];
        var pe = String(pr.email || pr.userEmail || pr.userId || "").toLowerCase().trim();
        var pck = String(pr.courseKey || pr.activeCourse || pr.course || "").trim();
        if(pe === email && (!ck || !pck || pck === ck)) return pr;
      }
    }
    return null;
  }

  function updateProfileObject(p, updates){
    if(!p || typeof p !== "object") return;
    if(updates.name != null){
      p.name = updates.name;
      if(p.apoderadoName != null) p.apoderadoName = updates.name;
      if(p.apoderado && typeof p.apoderado === "object") p.apoderado.name = updates.name;
    }
    if(updates.alumno != null){
      p.alumno = updates.alumno;
      if(p.apoderado && typeof p.apoderado === "object") p.apoderado.alumno = updates.alumno;
    }
    if(updates.phone != null){
      p.phone = updates.phone;
      if(p.apoderado && typeof p.apoderado === "object") p.apoderado.phone = updates.phone;
    }
    p.updatedAt = new Date().toISOString();
  }

  function render(){
    var root = document.getElementById("perfilRoot");
    if(!root) return;

    var s = getSession();
    var profiles = loadProfiles();
    var p = pickActiveProfile(profiles, s);

    var roles = Array.isArray(s.roles) ? s.roles : (s.role ? [String(s.role)] : []);
    roles = roles.map(function(r){return String(r||"").toLowerCase().trim();}).filter(Boolean);
    roles = Array.from(new Set(roles));

    var courseKey = s.courseKey || s.activeCourse || null;
    try{ courseKey = courseKey || localStorage.getItem("cursapp_active_course_v1"); }catch(_){}

    // Course data (if exists)
    var course = null;
    try{
      var courses = loadJSON("cursapp_courses_v1", []) || [];
      course = courses.find(function(c){ return String(c.courseKey||"") === String(courseKey||""); }) || null;
    }catch(_){ course = null; }


    // Fallback: derive course fields from courseKey if not stored
    if(!course && courseKey){
      var ck = parseCourseKey(courseKey);
      if(ck){
        course = {
          schoolId: ck.schoolId,
          schoolName: schoolNameFromId(ck.schoolId),
          level: ck.level,
          letter: ck.letter,
          jornada: ck.jornada,
          year: ck.year
        };
      }
    } else if(course && !course.schoolName && course.schoolId){
      course.schoolName = schoolNameFromId(course.schoolId);
    }
    // Enrollment (approval)
    var enrollment = null;
    try{
      var ens = loadJSON("cursapp_enrollments_v1", []) || [];
      enrollment = ens.find(function(e){
        return String(e.courseKey||"") === String(courseKey||"") &&
          String(e.email||"").toLowerCase() === String(s.email||s.userId||"").toLowerCase() &&
          (e.alumno ? true : true);
      }) || null;
    }catch(_){ enrollment = null; }

    var name = (p && (p.name || p.apoderadoName || (p.apoderado && p.apoderado.name))) || s.name || "";
    var alumno = (p && (p.alumno || (p.apoderado && p.apoderado.alumno))) || s.alumno || "";
    var phone = (p && (p.phone || (p.apoderado && p.apoderado.phone))) || "";
    var email = (s.email || s.userId || (p && (p.email || p.userEmail)) || "").toLowerCase();
    var currentRole = String((s.currentRole || s.role || "apoderado")).toLowerCase();

    var initials = (name||email||"U").trim().charAt(0).toUpperCase();

    var apPhoto = profile && profile.photoApoderado ? String(profile.photoApoderado) : "";
    var alPhoto = profile && profile.photoAlumno ? String(profile.photoAlumno) : "";
    var alName = (profile && profile.alumno) ? String(profile.alumno) : "";
    var alInitials = (alName || "A").trim().charAt(0).toUpperCase();

    function roleLabel(r){
      r = String(r||"").toLowerCase();
      if(r==="apoderado") return "Apoderado";
      if(r==="tesorero") return "Tesorero";
      if(r==="presidente") return "Presidente";
      return r.charAt(0).toUpperCase()+r.slice(1);
    }

    var approvalText = "—";
    var approvalBadge = "";
    if(roles.includes("presidente") && currentRole==="apoderado"){
      approvalText = "Aprobado";
      approvalBadge = '<span class="finBadge finBadge--accent">✅ Aprobado</span>';
    }else if(enrollment){
      if(String(enrollment.status||"").toLowerCase()==="approved"){
        approvalText = "Aprobado";
        approvalBadge = '<span class="finBadge finBadge--accent">✅ Aprobado</span>';
      }else{
        approvalText = "Pendiente de aprobación";
        approvalBadge = '<span class="finBadge">⏳ Pendiente</span>';
      }
    }else{
      // Directiva / sin enrollment
      approvalText = (roles.includes("presidente") || roles.includes("tesorero")) ? "Acceso directiva" : "—";
      approvalBadge = (roles.includes("presidente") || roles.includes("tesorero")) ? '<span class="finBadge finBadge--accent">🎓 Directiva</span>' : '<span class="finBadge">—</span>';
    }

    var joinDate = enrollment && enrollment.createdAt ? enrollment.createdAt : "";
    try{
      if(joinDate){
        var d = new Date(joinDate);
        joinDate = isNaN(d.getTime()) ? joinDate : d.toLocaleDateString("es-CL");
      }
    }catch(_){}

    var courseLine = "";
    if(course){
      courseLine = `${course.schoolName||"Colegio"} · ${course.level||""}${course.letter||""} ${course.year||""} · ${course.jornada||""}`.replace(/\s+/g," ").trim();
    }else if(courseKey){
      courseLine = String(courseKey);
    }else{
      courseLine = "—";
    }

    // Update header lines if present
    try{
      var elCourse = document.getElementById("whoCourseLine");
      if(elCourse) elCourse.textContent = courseLine || "—";
    }catch(_){}

    var roleTags = roles.length ? roles.map(function(r){
      var active = (String(r) === currentRole);
      return '<span class="roleTag '+(active?'roleTag--active':'')+'">'+esc(roleLabel(r))+(active?' ✓':'')+'</span>';
    }).join("") : '<span class="roleTag roleTag--active">Apoderado ✓</span>';

    var canSwitch = roles.length > 1;

    root.innerHTML = `
      <div class="finGrid" style="margin-top:14px;">
        <!-- Identidad -->
        <section class="finCard">
          <div class="finCard__head">
            <div class="finCard__title">Mi perfil</div>
            <span class="finBadge finBadge--accent" id="pfRolePill">👤 Perfil</span>
          </div>
          <div class="pfHead">
            <div class="pfAvatars">
              <div class="pfAvatarWrap">
                <button class="pfAvatarBtn" id="btnApPhoto" type="button" aria-label="Cambiar foto apoderado">
                  ${apPhoto ? `<img class="pfAvatarImg" src="${apPhoto}" alt="Foto apoderado"/>` : `<span class="pfAvatarTxt">${esc(initials)}</span>`}
                </button>
                <div class="pfAvatarLabel">Apoderado</div>
                <input id="inpApPhoto" class="pfFile" type="file" accept="image/*">
              </div>

              <div class="pfAvatarWrap">
                <button class="pfAvatarBtn" id="btnAlPhoto" type="button" aria-label="Cambiar foto alumno">
                  ${alPhoto ? `<img class="pfAvatarImg" src="${alPhoto}" alt="Foto alumno"/>` : `<span class="pfAvatarTxt">${esc(alInitials)}</span>`}
                </button>
                <div class="pfAvatarLabel">Alumno</div>
                <input id="inpAlPhoto" class="pfFile" type="file" accept="image/*">
              </div>
            </div>

            <div class="pfIdentity">
              <div class="pfName">${esc(name || "—")}</div>
              <div class="pfEmail">${esc(email || "—")}</div>
            </div>
          </div>
</div>

          <div class="finRow" style="margin-top:12px;">
            <div class="finField">
              <div class="finLabel">Nombre</div>
              <input class="finInput" id="inpName" value="${esc(name)}" placeholder="Nombre y apellido"/>
            </div>
            <div class="finField">
              <div class="finLabel">Teléfono</div>
              <input class="finInput" id="inpPhone" value="${esc(phone)}" placeholder="+56 9 1234 5678"/>
            </div>
          </div>

          <div class="finField">
            <div class="finLabel">Alumno/a</div>
            <input class="finInput" id="inpAlumno" value="${esc(alumno)}" placeholder="Nombre del alumno/a"/>
          </div>

          <div class="finBtnRow">
            <button class="btn accent" id="btnSave" type="button">Guardar cambios</button>
            ${canSwitch ? '<button class="btn" id="btnSwitchRole" type="button">Cambiar rol</button>' : ''}
          </div>
        </section>

        <!-- Curso -->
        <section class="finCard">
          <div class="finCard__head">
            <div class="finCard__title">Curso actual</div>
            <span class="finBadge">🏫 ${esc(course && course.schoolName ? String(course.schoolName) : "—")}</span>
          </div>

          <div class="finKV">
            <div class="finKV__row">
              <div class="finKV__k">Curso</div>
              <div class="finKV__v">${esc(course ? ((course.level||"")+(course.letter||"")) : "—")}</div>
            </div>
            <div class="finKV__row">
              <div class="finKV__k">Jornada</div>
              <div class="finKV__v">${esc(course && course.jornada ? course.jornada : "—")}</div>
            </div>
            <div class="finKV__row">
              <div class="finKV__k">Año</div>
              <div class="finKV__v">${esc(course && course.year ? String(course.year) : "—")}</div>
            </div>
            <div class="finKV__row">
              <div class="finKV__k">Fecha ingreso</div>
              <div class="finKV__v">${esc(joinDate || "—")}</div>
            </div>
          </div>
        </section>

        <!-- Roles -->

        <section class="finCard">
          <div class="finCard__head">
            <div class="finCard__title">Roles y estado</div>
            <span class="finBadge finBadge--accent">🎯 ${esc(roleLabel(currentRole))}</span>
          </div>
          <div class="roleTags">${roleTags}</div>
          <div class="finStatus" style="margin-top:10px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
            <span class="finBadge finBadge--accent">🧭 Rol activo</span>
            <div style="font-weight:950;">${esc(roleLabel(currentRole))}</div>
          </div>
          <div class="muted" style="margin-top:6px;font-weight:800;">Estado: ${esc(approvalText || "—")}</div>
          ${canSwitch ? '<div class="finBtnRow"><button class="btn" id="btnSwitchRole2" type="button">Cambiar rol</button></div>' : ''}
        </section>

        <!-- Seguridad -->
        <section class="finCard">
          <div class="finCard__head">
            <div class="finCard__title">Seguridad</div>
            <span class="finBadge">🔒 Contraseña</span>
          </div>

          <div class="finField">
            <div class="finLabel">Contraseña actual</div>
            <input class="finInput" id="pwCurrent" type="password" placeholder="••••••"/>
          </div>

          <div class="finRow">
            <div class="finField">
              <div class="finLabel">Nueva contraseña</div>
              <input class="finInput" id="pwNew" type="password" placeholder="mínimo 4 caracteres"/>
            </div>
            <div class="finField">
              <div class="finLabel">Repetir nueva contraseña</div>
              <input class="finInput" id="pwNew2" type="password" placeholder="repetir"/>
            </div>
          </div>

          <div class="finBtnRow">
            <button class="btn accent" id="btnChangePw" type="button">Cambiar contraseña</button>
          </div>

          <div class="muted" style="margin-top:10px;font-weight:800;">
            Tip: usa una contraseña distinta a la del colegio. (Demo: se guarda en tu navegador).
          </div>
        </section>
      </div>
    `;

    // ---- Photo uploads (demo: store as dataURL in profile) ----
    function wirePhoto(btnId, inpId, field){
      var btn = document.getElementById(btnId);
      var inp = document.getElementById(inpId);
      if(!btn || !inp) return;
      btn.onclick = function(){ inp.click(); };
      inp.onchange = function(){
        var file = (inp.files && inp.files[0]) ? inp.files[0] : null;
        if(!file) return;
        if(!/^image\//.test(file.type||"")){ alert("Selecciona una imagen."); inp.value=""; return; }
        var reader = new FileReader();
        reader.onload = function(){
          try{
            var dataUrl = String(reader.result||"");
            profile = profile || {};
            profile[field] = dataUrl;
            // persist in profiles list
            var profiles2 = loadProfiles();
            var idx = profiles2.findIndex(function(p){
              return String(p.email||"").toLowerCase()===String(email||"").toLowerCase()
                && String(p.courseKey||"")===String(courseKey||"");
            });
            if(idx>=0) profiles2[idx] = Object.assign({}, profiles2[idx], profile);
            else profiles2.push(Object.assign({ email: email, courseKey: courseKey }, profile));
            saveProfiles(profiles2);
            // rerender
            render();
          }catch(e){
            alert("No se pudo guardar la foto.");
          }
        };
        reader.readAsDataURL(file);
      };
    }
    wirePhoto("btnApPhoto","inpApPhoto","photoApoderado");
    wirePhoto("btnAlPhoto","inpAlPhoto","photoAlumno");

    // ---- Actions ----
    var btnSave = document.getElementById("btnSave");
    if(btnSave){
      btnSave.onclick = function(){
        var newName = String((document.getElementById("inpName")||{}).value || "").trim();
        var newAlumno = String((document.getElementById("inpAlumno")||{}).value || "").trim();
        var newPhone = String((document.getElementById("inpPhone")||{}).value || "").trim();

        // Update active profile
        if(p){
          if(p.apoderado){
            p.apoderado.name = newName;
            p.apoderado.alumno = newAlumno;
            p.apoderado.phone = newPhone;
          }
          p.name = newName;
          p.alumno = newAlumno;
          p.phone = newPhone;
        }

        // Persist profiles
        for(var i=0;i<profiles.length;i++){
          if(String(profiles[i].id||"") === String(p && p.id || "")){
            profiles[i] = p;
            break;
          }
        }
        saveProfiles(profiles);

        // compat session
        try{
          var ss = getSession();
          ss.name = newName;
          ss.alumno = newAlumno;
          saveJSON("cursapp_session_v1", ss);
        }catch(_){}

        alert("Perfil actualizado.");
        render();
      };
    }

    function openRoleChooser(){
      if(!canSwitch) return;
      var items = roles.map(function(r){
        var icon = (r==="tesorero") ? "💳" : (r==="presidente") ? "🎓" : "👨‍👩‍👧";
        var meta = (r==="apoderado") ? approvalText : (r==="tesorero") ? "Pagos, rendiciones y cobranza" : "Gestión del curso, campañas y apoderados";
        return { label: icon + " " + roleLabel(r), meta: meta, role: r, icon: icon };
      });
      // Reuse chooser from login.js styles
      if(typeof window.renderChooser === "function"){
        // if exposed (unlikely)
      }
      // Lightweight chooser (same overlay classes)
      var old = document.getElementById("cursappPickerOverlay");
      if(old) old.remove();
      var wrap = document.createElement("div");
      wrap.id = "cursappPickerOverlay";
      wrap.className = "cpOverlay";
      wrap.innerHTML = `
        <div class="cpPanel" role="dialog" aria-modal="true">
          <div class="cpPanel__head">
            <div>
              <div class="cpTitle">Cambiar rol</div>
              <div class="cpSub">Selecciona cómo quieres continuar</div>
            </div>
            <button type="button" class="cpClose" data-close>✕</button>
          </div>
          <div class="cpList">
            ${items.map(function(it,i){
              var active = (String(it.role) === currentRole);
              return `
                <button type="button" class="cpItem" data-pk="${i}">
                  <div class="cpItem__icon">${esc(it.icon)}</div>
                  <div class="cpItem__body">
                    <div class="cpItem__label">${esc(it.label)} ${active ? " (Activo)" : ""}</div>
                    <div class="cpItem__meta">${esc(it.meta||"")}</div>
                  </div>
                  <div class="cpItem__chev">›</div>
                </button>
              `;
            }).join("")}
          </div>
        </div>
      `;
      wrap.addEventListener("click", function(e){
        if(e.target === wrap || (e.target && e.target.matches("[data-close]"))) wrap.remove();
      });
      document.body.appendChild(wrap);
      wrap.querySelectorAll("button[data-pk]").forEach(function(btn){
        btn.onclick = function(){
          var idx = Number(btn.getAttribute("data-pk"));
          var target = items[idx] ? items[idx].role : null;
          if(!target) return;
          if(target === currentRole){ wrap.remove(); return; }
          try{
            if(window.CURSAPP && typeof window.CURSAPP.switchRoleSafe === "function"){
              var ok = window.CURSAPP.switchRoleSafe(target);
              if(!ok) return;
              // go to dashboard for role
              if(target === "presidente") location.assign("/presidente.html");
              else if(target === "tesorero") location.assign("/tesorero.html");
              else location.assign("/apoderado.html");
            }
          }catch(_){}
        };
      });
    }

    var btnSwitchRole = document.getElementById("btnSwitchRole");
    if(btnSwitchRole) btnSwitchRole.onclick = openRoleChooser;
    var btnSwitchRole2 = document.getElementById("btnSwitchRole2");
    if(btnSwitchRole2) btnSwitchRole2.onclick = openRoleChooser;

    var btnChangePw = document.getElementById("btnChangePw");
    if(btnChangePw){
      btnChangePw.onclick = function(){
        var cur = String((document.getElementById("pwCurrent")||{}).value || "");
        var nw = String((document.getElementById("pwNew")||{}).value || "");
        var nw2 = String((document.getElementById("pwNew2")||{}).value || "");

        if(!email){
          alert("No se pudo identificar el usuario.");
          return;
        }
        if(nw.length < 4){
          alert("La nueva contraseña debe tener al menos 4 caracteres.");
          return;
        }
        if(nw !== nw2){
          alert("La nueva contraseña no coincide.");
          return;
        }

        var users = loadJSON("cursapp_users_v1", []);
        var uidx = -1;
        for(var i=0;i<users.length;i++){
          if(String(users[i].email||"").toLowerCase() === email){ uidx = i; break; }
        }
        if(uidx === -1){
          alert("Usuario no encontrado.");
          return;
        }
        var expected = users[uidx].passwordHashDemo;
        var curHash = hashDemo(cur);
        if(expected && curHash !== expected){
          alert("Contraseña actual incorrecta.");
          return;
        }

        users[uidx].passwordHashDemo = hashDemo(nw);
        saveJSON("cursapp_users_v1", users);

        try{
          document.getElementById("pwCurrent").value = "";
          document.getElementById("pwNew").value = "";
          document.getElementById("pwNew2").value = "";
        }catch(_){}

        alert("Contraseña actualizada.");
      };
    }
  }

  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", render);
  else render();
})();