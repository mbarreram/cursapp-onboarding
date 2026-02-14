/* ===========================
   Cursapp · config.js
   - Configuración global para todos los roles
   =========================== */

(function(){
  window.CURSAPP = window.CURSAPP || {};
  // ✅ Activar demo seed manualmente:
  // - URL: ?demo=1
  // - o: localStorage.setItem('cursapp_demo_mode','1') y recargar
  window.CURSAPP.DEMO_MODE = false;
  // ===== Storage helpers (demo -> producción) =====
  const KEY_SESSION = "cursapp_session_v1";
  const KEY_DEMO_USER = "cursapp_demo_user";
  const KEY_ACTIVE_COURSE = "cursapp_active_course_v1";

  // --- Roles/session hardening (compat: role + roles/currentRole) ---
  function _normRole(r){
    return String(r || "").toLowerCase().trim();
  }
  function _normalizeRoles(input){
    var arr = [];
    if(Array.isArray(input)) arr = input;
    else if(typeof input === "string") arr = input.split(",");
    else if(input && typeof input === "object" && Array.isArray(input.roles)) arr = input.roles;
    return Array.from(new Set(arr.map(_normRole).filter(Boolean)));
  }

  window.CURSAPP.getSessionSafe = function(){
    var s = null;
    try{ s = localStorage.getItem(KEY_SESSION); if(s) s = JSON.parse(s); }catch(e){ s = null; }
    if(!s){
      // Legacy fallback
      try{ var d = localStorage.getItem(KEY_DEMO_USER); if(d) s = JSON.parse(d); }catch(e){ s = null; }
    }
    s = s || {};

    // Map fields (compat)
    if(!s.email && s.userEmail) s.email = s.userEmail;
    if(!s.email && s.username) s.email = s.username;
    if(!s.userId && s.email) s.userId = s.email;

    // Roles
    var roles = _normalizeRoles(s.roles);
    if(!roles.length){
      var fallback = _normRole(s.currentRole || s.role || "apoderado");
      roles = fallback ? [fallback] : ["apoderado"];
    }
    var currentRole = _normRole(s.currentRole || s.activeRole || s.active_role || s.role || roles[0] || "apoderado");
    if(!roles.includes(currentRole)) currentRole = roles[0] || "apoderado";

    s.roles = roles;
    s.currentRole = currentRole;
    // Keep legacy role in sync to avoid breaking older screens
    s.role = currentRole;

    // Persist normalized session (best-effort)
    try{ localStorage.setItem(KEY_SESSION, JSON.stringify(s)); }catch(e){}
    // Mirror legacy for older screens
    try{ localStorage.setItem(KEY_DEMO_USER, JSON.stringify(s)); }catch(e){}

    return s;
  };

  window.CURSAPP.switchRoleSafe = function(nextRole){
    var s = window.CURSAPP.getSessionSafe();
    var nr = _normRole(nextRole);
    if(!nr || !s.roles || !Array.isArray(s.roles) || !s.roles.includes(nr)){
      alert("Rol no disponible para este usuario.");
      return false;
    }
    s.currentRole = nr;
    s.role = nr;
    try{ localStorage.setItem(KEY_SESSION, JSON.stringify(s)); }catch(e){}
    try{ localStorage.setItem(KEY_DEMO_USER, JSON.stringify(s)); }catch(e){}
    return true;
  };

  // Key scoping por curso (evita cruces entre cursos / pruebas)
  window.CURSAPP.scopedKey = function(base){
    const ck = localStorage.getItem(KEY_ACTIVE_COURSE) || "default";
    return `cursapp_${ck}_${base}`;
  };

  // Sesión unificada (normalizada)
  window.CURSAPP.getSession = function(){
    return window.CURSAPP.getSessionSafe();
  };

  window.CURSAPP.setSession = function(session){
    try{
      localStorage.setItem(KEY_SESSION, JSON.stringify(session || null));
      // mirror legacy (solo para pantallas antiguas que lean demo_user)
      if(session){
        localStorage.setItem(KEY_DEMO_USER, JSON.stringify(session));
      }else{
        localStorage.removeItem(KEY_DEMO_USER);
      }
    }catch(e){}
  };

  window.CURSAPP.clearLegacyDemoUser = function(){
    try{ localStorage.removeItem(KEY_DEMO_USER); }catch(e){}
  };
  // ===============================================

})();