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

  // Key scoping por curso (evita cruces entre cursos / pruebas)
  window.CURSAPP.scopedKey = function(base){
    const ck = localStorage.getItem(KEY_ACTIVE_COURSE) || "default";
    return `cursapp_${ck}_${base}`;
  };

  // Sesión unificada (prefiere session_v1; demo_user solo fallback legacy)
  window.CURSAPP.getSession = function(){
    try{
      const s = localStorage.getItem(KEY_SESSION);
      if(s) return JSON.parse(s);
    }catch(e){}
    try{
      const d = localStorage.getItem(KEY_DEMO_USER);
      if(d) return JSON.parse(d);
    }catch(e){}
    return null;
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