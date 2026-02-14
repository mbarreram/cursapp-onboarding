/* =========================================================
   Cursapp · perfil.js (editable)
   - Módulo "Mi perfil"
   - Edita datos básicos (nombre, alumno, teléfono)
   - Cambia contraseña (localStorage demo)
   - Usa sesión normalizada (CURSAPP.getSessionSafe / getSession)
   ========================================================= */

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

    var name = (p && (p.name || p.apoderadoName || (p.apoderado && p.apoderado.name))) || s.name || "";
    var alumno = (p && (p.alumno || (p.apoderado && p.apoderado.alumno))) || s.alumno || "";
    var phone = (p && (p.phone || (p.apoderado && p.apoderado.phone))) || "";
    var email = (s.email || s.userId || (p && (p.email || p.userEmail)) || "").toLowerCase();
    var currentRole = (s.currentRole || s.role || "apoderado");

    var roleBadges = roles.length ? roles.map(function(r){
      var label = r.charAt(0).toUpperCase() + r.slice(1);
      var isActive = String(r) === String(currentRole).toLowerCase();
      return '<span class="tag" style="margin-right:6px;' + (isActive ? 'border:2px solid rgba(15,23,42,.55);' : '') + '">' + esc(label) + (isActive ? ' ✓' : '') + '</span>';
    }).join("") : '<span class="tag">Apoderado</span>';

    var canSwitch = roles.length > 1;

    root.innerHTML = (
      '<div class="card" style="margin-top:14px;">' +
        '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">' +
          '<div>' +
            '<div style="font-weight:950;font-size:18px;">' + esc(name || "—") + '</div>' +
            '<div class="muted" style="margin-top:4px;font-weight:800;">' + esc(email || "—") + '</div>' +
          '</div>' +
          '<div style="text-align:right;">' +
            '<div class="muted" style="font-weight:900;">Rol activo</div>' +
            '<div style="font-weight:950;">' + esc(String(currentRole).charAt(0).toUpperCase()+String(currentRole).slice(1)) + '</div>' +
          '</div>' +
        '</div>' +

        '<div style="margin-top:14px;">' +
          '<div class="muted" style="font-weight:900;">Curso</div>' +
          '<div style="font-weight:800;margin-top:4px;">' + esc(courseKey || "—") + '</div>' +
        '</div>' +

        '<div style="margin-top:14px;">' +
          '<div class="muted" style="font-weight:900;">Mis roles</div>' +
          '<div style="margin-top:6px;">' + roleBadges + '</div>' +
        '</div>' +

        '<div style="margin-top:16px;padding-top:14px;border-top:1px solid rgba(15,23,42,.08);">' +
          '<div style="font-weight:950;">Editar datos</div>' +
          '<div class="muted" style="margin-top:4px;">Se guardan para este usuario.</div>' +

          '<div style="margin-top:12px;display:grid;gap:10px;">' +
            '<label style="display:grid;gap:6px;">' +
              '<span class="muted" style="font-weight:900;">Nombre</span>' +
              '<input id="pfName" class="input" type="text" value="' + esc(name) + '" placeholder="Nombre y apellido">' +
            '</label>' +
            '<label style="display:grid;gap:6px;">' +
              '<span class="muted" style="font-weight:900;">Alumno</span>' +
              '<input id="pfAlumno" class="input" type="text" value="' + esc(alumno) + '" placeholder="Nombre del alumno">' +
            '</label>' +
            '<label style="display:grid;gap:6px;">' +
              '<span class="muted" style="font-weight:900;">Teléfono</span>' +
              '<input id="pfPhone" class="input" type="tel" value="' + esc(phone) + '" placeholder="+56 9 ...">' +
            '</label>' +
          '</div>' +

          '<div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;">' +
            '<button class="btn" type="button" id="btnSaveProfile">Guardar cambios</button>' +
            (canSwitch ? '<button class="btn ghost" type="button" id="btnSwitch">Cambiar rol</button>' : '') +
            '<button class="btn ghost" type="button" id="btnBack">Volver</button>' +
          '</div>' +
        '</div>' +

        '<div style="margin-top:16px;padding-top:14px;border-top:1px solid rgba(15,23,42,.08);">' +
          '<div style="font-weight:950;">Cambiar contraseña</div>' +
          '<div class="muted" style="margin-top:4px;">Debes ingresar tu contraseña actual.</div>' +

          '<div style="margin-top:12px;display:grid;gap:10px;">' +
            '<label style="display:grid;gap:6px;">' +
              '<span class="muted" style="font-weight:900;">Contraseña actual</span>' +
              '<input id="pwCurrent" class="input" type="password" autocomplete="current-password" placeholder="••••••••">' +
            '</label>' +
            '<label style="display:grid;gap:6px;">' +
              '<span class="muted" style="font-weight:900;">Nueva contraseña</span>' +
              '<input id="pwNew" class="input" type="password" autocomplete="new-password" placeholder="Mínimo 4 caracteres">' +
            '</label>' +
            '<label style="display:grid;gap:6px;">' +
              '<span class="muted" style="font-weight:900;">Repetir nueva contraseña</span>' +
              '<input id="pwNew2" class="input" type="password" autocomplete="new-password" placeholder="Repite la nueva contraseña">' +
            '</label>' +
          '</div>' +
          '<div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;">' +
            '<button class="btn" type="button" id="btnChangePw">Actualizar contraseña</button>' +
          '</div>' +
        '</div>' +
      '</div>'
    );

    var btnBack = document.getElementById("btnBack");
    if(btnBack){
      btnBack.onclick = function(){
        var r = String(currentRole||"apoderado").toLowerCase();
        if(r === "presidente") location.href = "/presidente.html";
        else if(r === "tesorero") location.href = "/tesorero.html";
        else location.href = "/apoderado.html";
      };
    }

    var btnSwitch = document.getElementById("btnSwitch");
    if(btnSwitch){
      btnSwitch.onclick = function(){
        var next = null;
        var order = ["apoderado","tesorero","presidente"];
        for(var i=0;i<order.length;i++){
          if(order[i] !== String(currentRole).toLowerCase() && roles.includes(order[i])){ next = order[i]; break; }
        }
        if(!next){ alert("No hay otro rol disponible."); return; }

        if(window.CURSAPP && typeof window.CURSAPP.switchRoleSafe === "function"){
          var ok = window.CURSAPP.switchRoleSafe(next);
          if(!ok) return;
        }else if(window.CURSAPP && typeof window.CURSAPP.switchRole === "function"){
          window.CURSAPP.switchRole(next);
        }else{
          s.currentRole = next; s.role = next;
          saveJSON("cursapp_session_v1", s);
        }

        if(next === "presidente") location.href = "/presidente.html";
        else if(next === "tesorero") location.href = "/tesorero.html";
        else location.href = "/apoderado.html";
      };
    }

    var btnSaveProfile = document.getElementById("btnSaveProfile");
    if(btnSaveProfile){
      btnSaveProfile.onclick = function(){
        var newName = String((document.getElementById("pfName")||{}).value || "").trim();
        var newAlumno = String((document.getElementById("pfAlumno")||{}).value || "").trim();
        var newPhone = String((document.getElementById("pfPhone")||{}).value || "").trim();

        if(!newName){
          alert("Ingresa tu nombre.");
          return;
        }
        if(!p){
          alert("No se encontró un perfil activo para editar.");
          return;
        }

        updateProfileObject(p, { name:newName, alumno:newAlumno, phone:newPhone });

        if(Array.isArray(profiles)){
          var curId = String(p.profileId || p.id || "");
          for(var i=0;i<profiles.length;i++){
            var pid = String(profiles[i].profileId || profiles[i].id || "");
            if(curId && pid === curId){ profiles[i] = p; break; }
          }
        }
        saveProfiles(profiles);

        // compat: sesión
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
