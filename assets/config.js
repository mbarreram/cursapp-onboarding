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

  // ================================
  // ✅ Producción-ready (sin backend)
  // - Sesión única (evita cruce de usuarios/roles)
  // - Keys "scoped" por curso (evita datos fantasma entre cursos)
  // - Compatibilidad legacy (cursapp_demo_user)
  // ================================

  const KEY_SESSION = "cursapp_session_v1";
  const KEY_DEMO_USER = "cursapp_demo_user"; // legacy
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

  function saveJSON(k, v){
    localStorage.setItem(k, JSON.stringify(v));
  }

  // Scope por curso (prioriza active_course)
  function getCourseScope(){
    try{
      const active = localStorage.getItem(KEY_ACTIVE_COURSE);
      if(active && String(active).trim()) return String(active).trim();
    }catch(e){}
    try{
      const course = loadJSON("cursapp_course_v1", null);
      const ck = course && course.courseKey;
      if(ck && String(ck).trim()) return String(ck).trim();
    }catch(e){}
    return "global";
  }

  function sanitizeScope(s){
    return String(s||"global").replace(/[^a-zA-Z0-9_\-]/g,"_").slice(0,64) || "global";
  }

  function scopedKey(base){
    const scope = sanitizeScope(getCourseScope());
    return `cursapp_${scope}_${base}`;
  }

  // ✅ Sesión única con migración
  function getSession(){
    const s = loadJSON(KEY_SESSION, null);
    if(s && (s.userId || s.role)) return s;

    // Migrar desde demo_user si existe
    const legacy = loadJSON(KEY_DEMO_USER, null);
    if(legacy && (legacy.email || legacy.role)){
      const migrated = {
        userId: String(legacy.email || legacy.role || "").toLowerCase().trim(),
        role: legacy.role || "apoderado",
        alumno: legacy.alumno,
        courseKey: localStorage.getItem(KEY_ACTIVE_COURSE) || legacy.courseKey
      };
      saveJSON(KEY_SESSION, migrated);
      return migrated;
    }
    return null;
  }

  function setSession(session){
    const s = session || null;
    if(!s){
      localStorage.removeItem(KEY_SESSION);
      // no eliminamos KEY_DEMO_USER para no romper pantallas antiguas, pero lo vaciamos
      localStorage.removeItem(KEY_DEMO_USER);
      return;
    }
    saveJSON(KEY_SESSION, s);

    // Mirror legacy para compatibilidad (mismo contenido esencial)
    const legacy = {
      name: s.name || (s.role ? (String(s.role).charAt(0).toUpperCase()+String(s.role).slice(1)) : "Usuario"),
      role: s.role,
      alumno: s.alumno,
      email: s.userId
    };
    saveJSON(KEY_DEMO_USER, legacy);
  }

  window.CURSAPP.KEY_SESSION = KEY_SESSION;
  window.CURSAPP.KEY_DEMO_USER = KEY_DEMO_USER;
  window.CURSAPP.KEY_ACTIVE_COURSE = KEY_ACTIVE_COURSE;
  window.CURSAPP.loadJSON = loadJSON;
  window.CURSAPP.saveJSON = saveJSON;
  window.CURSAPP.scopedKey = scopedKey;
  window.CURSAPP.getCourseScope = getCourseScope;
  window.CURSAPP.getSession = getSession;
  window.CURSAPP.setSession = setSession;
})();
