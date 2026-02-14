/* =========================================================
   Cursapp · perfil.js
   - Vista simple de "Mi perfil" (nuevo módulo)
   - Lee sesión normalizada: CURSAPP.getSession()
   - Muestra curso, roles y datos del perfil activo (si existe)
   ========================================================= */

(function(){
  function esc(s){
    return String(s ?? "").replace(/[&<>"']/g, function(c){
      return ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"})[c];
    });
  }
  function safeJsonParse(v){ try{ return JSON.parse(v); }catch(e){ return null; } }

  function getSession(){
    try{
      if(window.CURSAPP && typeof window.CURSAPP.getSession === "function"){
        return window.CURSAPP.getSession() || {};
      }
    }catch(_){ }
    return safeJsonParse(localStorage.getItem("cursapp_session_v1") || "null") || {};
  }

  function loadProfiles(){
    var raw = null;
    try{ raw = localStorage.getItem("cursapp_profiles_v1"); }catch(_){ raw=null; }
    return safeJsonParse(raw) || {};
  }

  function pickActiveProfile(profiles, session){
    var id = null;
    try{ id = localStorage.getItem("cursapp_active_profile_v1"); }catch(_){ id=null; }
    if(!id && session && session.profileId) id = String(session.profileId);

    if(!profiles) return null;

    // object map
    if(id && profiles[id]) return profiles[id];
    if(Array.isArray(profiles) && id){
      for(var i=0;i<profiles.length;i++){
        if(String(profiles[i].id) === String(id)) return profiles[i];
      }
    }
    // fallback: try first matching email
    var email = String(session.email || session.userId || "").toLowerCase().trim();
    if(!email) return null;
    function matchNode(node){
      if(!node || typeof node !== "object") return null;
      var ne = String(node.email || node.userEmail || node.userId || "").toLowerCase().trim();
      if(ne && ne === email) return node;
      return null;
    }
    if(Array.isArray(profiles)){
      for(var j=0;j<profiles.length;j++){
        var m = matchNode(profiles[j]);
        if(m) return m;
      }
    }else{
      var keys = Object.keys(profiles);
      for(var k=0;k<keys.length;k++){
        var mm = matchNode(profiles[keys[k]]);
        if(mm) return mm;
      }
    }
    return null;
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
    try{ courseKey = courseKey || localStorage.getItem("cursapp_active_course_v1"); }catch(_){ }

    var whoLine = document.getElementById("whoCourseLine");
    if(whoLine) whoLine.textContent = courseKey ? String(courseKey) : "—";

    var name = (p && (p.name || p.apoderadoName)) || s.name || "—";
    var alumno = (p && (p.alumno || (p.apoderado && p.apoderado.alumno))) || s.alumno || "—";
    var email = s.email || s.userId || (p && p.email) || "—";
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
            '<div style="font-weight:950;font-size:18px;">' + esc(name) + '</div>' +
            '<div class="muted" style="margin-top:4px;font-weight:800;">' + esc(email) + '</div>' +
          '</div>' +
          '<div style="text-align:right;">' +
            '<div class="muted" style="font-weight:900;">Rol activo</div>' +
            '<div style="font-weight:950;">' + esc(String(currentRole).charAt(0).toUpperCase()+String(currentRole).slice(1)) + '</div>' +
          '</div>' +
        '</div>' +

        '<div style="margin-top:14px;">' +
          '<div class="muted" style="font-weight:900;">Alumno</div>' +
          '<div style="font-weight:900;margin-top:4px;">' + esc(alumno) + '</div>' +
        '</div>' +

        '<div style="margin-top:14px;">' +
          '<div class="muted" style="font-weight:900;">Curso</div>' +
          '<div style="font-weight:800;margin-top:4px;">' + esc(courseKey || "—") + '</div>' +
        '</div>' +

        '<div style="margin-top:14px;">' +
          '<div class="muted" style="font-weight:900;">Mis roles</div>' +
          '<div style="margin-top:6px;">' + roleBadges + '</div>' +
        '</div>' +

        '<div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap;">' +
          (canSwitch ? '<button class="btn ghost" type="button" id="btnSwitch">Cambiar rol</button>' : '') +
          '<button class="btn" type="button" id="btnBack">Volver</button>' +
          '<button class="btn danger" type="button" id="btnLogout">Cerrar sesión</button>' +
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

    var btnLogout = document.getElementById("btnLogout");
    if(btnLogout){
      btnLogout.onclick = function(){
        try{ localStorage.removeItem("cursapp_session_v1"); }catch(_){ }
        try{ localStorage.removeItem("cursapp_demo_user"); }catch(_){ }
        location.href = "/index.html";
      };
    }

    var btnSwitch = document.getElementById("btnSwitch");
    if(btnSwitch){
      btnSwitch.onclick = function(){
        // Reutiliza el switch del menú para mantener una sola lógica
        var next = null;
        var order = ["apoderado","tesorero","presidente"];
        for(var i=0;i<order.length;i++){
          if(order[i] !== String(currentRole).toLowerCase() && roles.includes(order[i])){ next = order[i]; break; }
        }
        if(!next){ alert("No hay otro rol disponible."); return; }
        if(window.CURSAPP && typeof window.CURSAPP.switchRoleSafe === "function"){
          var ok = window.CURSAPP.switchRoleSafe(next);
          if(!ok) return;
        }
        // Redirigir
        if(next === "presidente") location.href = "/presidente.html";
        else if(next === "tesorero") location.href = "/tesorero.html";
        else location.href = "/apoderado.html";
      };
    }
  }

  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", render);
  else render();
})();
