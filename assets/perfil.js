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

const el = (id) => document.getElementById(id);
// --------------------------------------------------------------


(function(){
  function esc(s){
    return String(s ?? "").replace(/[&<>"']/g, function(c){
      return ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"})[c];
    });
  }
  function safeJsonParse(v){ try{ return JSON.parse(v); }catch(e){ return null; } }
  
  function getDisplayName(p, session){
    var fromProfile = (p && (p.name || p.apoderadoName || (p.apoderado && p.apoderado.name))) || "";
    var fromSession = (session && (session.apoderadoName || session.displayName || session.name)) || "";
    var email = (session && session.email) || (p && p.email) || "";
    var fallback = email ? email.split("@")[0] : "—";
    return String(fromProfile || fromSession || fallback).trim();
  }
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

    var apPhoto = p && p.photoApoderado ? String(p.photoApoderado) : "";
    var alPhoto = p && p.photoAlumno ? String(p.photoAlumno) : "";
    var alName = (p && p.alumno) ? String(p.alumno) : "";
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
    function wirePhoto(root, which, p, session){
    var btn = root.querySelector('[data-photo-btn="'+which+'"]');
    var img = root.querySelector('[data-photo-img="'+which+'"]');
    var hint = root.querySelector('[data-photo-hint="'+which+'"]');
    if(!btn || !img) return;

    var input = root.querySelector('[data-photo-input="'+which+'"]');
    if(!input){
      input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.setAttribute("capture","environment");
      input.style.display = "none";
      input.setAttribute("data-photo-input", which);
      root.appendChild(input);
    }

    var key = (which==="apoderado") ? "photoApoderado" : "photoAlumno";

    function setUI(dataUrl){
      if(dataUrl){
        img.src = dataUrl;
        img.classList.add("hasPhoto");
        if(hint) hint.textContent = "Cambiar foto";
      } else {
        img.removeAttribute("src");
        img.classList.remove("hasPhoto");
        if(hint) hint.textContent = "Subir foto";
      }
    }

    setUI(p && p[key]);

    btn.onclick = function(){ input.click(); };

    input.onchange = function(){
      var file = input.files && input.files[0];
      if(!file) return;

      try{
        var t = String(file.type||"");
        if(t && !t.startsWith("image/")){
          alert("Selecciona una imagen (JPG/PNG/HEIC).");
          return;
        }
        var maxMB = 8;
        if(file.size > maxMB*1024*1024){
          alert("La imagen es muy pesada. Máximo "+maxMB+"MB.");
          return;
        }

        fileToDataURL(file).then(function(dataUrl){
          return compressImageDataURL(dataUrl, 720, 0.82);
        }).then(function(compressed){
          // persist profile
          var storeKey="cursapp_profiles_v1";
          var all = safeJsonParse(localStorage.getItem(storeKey)) || {};
          var email = (session && (session.email||session.userEmail)) || (p && p.email) || "";
          var courseKey = (session && session.courseKey) || (p && p.courseKey) || "";
          var pid = (session && (session.profileId||session.profileID)) || (p && (p.profileId||p.profileID||p.id)) || null;
          var realId = pid || (email ? ("pr_"+btoa(email).replace(/=/g,"").slice(0,12)) : ("pr_"+Date.now()));
          var existing = all[realId] || {};
          var next = Object.assign({}, existing, p||{}, { id: realId, profileId: realId, email: email, courseKey: courseKey });
          next[key] = compressed;
          next.updatedAt = new Date().toISOString();
          all[realId]=next;
          localStorage.setItem(storeKey, JSON.stringify(all));

          // update in-memory and UI
          if(p) p[key]=compressed;
          setUI(compressed);
          input.value = "";
        }).catch(function(e){
          alert("No se pudo cargar la foto: "+(e && e.message ? e.message : e));
        });

      }catch(e){
        alert("No se pudo cargar la foto: "+(e && e.message ? e.message : e));
      }
    };
  }

  function fileToDataURL(file){
    return new Promise(function(resolve, reject){
      var fr = new FileReader();
      fr.onload = function(){ resolve(fr.result); };
      fr.onerror = reject;
      fr.readAsDataURL(file);
    });
  }

  function compressImageDataURL(dataUrl, maxSide, quality){
    return new Promise(function(resolve){
      var img = new Image();
      img.onload = function(){
        var w = img.width || 1, h = img.height || 1;
        var scale = Math.min(1, maxSide / Math.max(w, h));
        var nw = Math.max(1, Math.round(w*scale));
        var nh = Math.max(1, Math.round(h*scale));
        var canvas = document.createElement("canvas");
        canvas.width = nw; canvas.height = nh;
        var ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, nw, nh);
        var out="";
        try { out = canvas.toDataURL("image/jpeg", quality); } catch(e){ out = canvas.toDataURL(); }
        resolve(out);
      };
      img.onerror = function(){ resolve(dataUrl); };
      img.src = dataUrl;
    });
  })();