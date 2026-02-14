/* =========================================================
   Cursapp · switchRoleEnrollment.js
   - Cambia entre Apoderado <-> Tesorero usando enrollment.directivaRole
   - Requiere cursapp_demo_user.email y cursapp_active_course_v1
   ========================================================= */

(function(){
  const KEY_USER   = "cursapp_demo_user";
  const KEY_ACTIVE = "cursapp_active_course_v1";
  const KEY_ENROLL = "cursapp_enrollments_v1";

  function loadJSON(k, def){
    try{ const v = localStorage.getItem(k); if(v==null) return def; return JSON.parse(v); }
    catch(e){ return def; }
  }
  function saveJSON(k, v){ localStorage.setItem(k, JSON.stringify(v)); }

  function getUser(){ return loadJSON(KEY_USER, null); }
  function activeCourseKey(){ return localStorage.getItem(KEY_ACTIVE) || ""; }
  function enrollments(){ return loadJSON(KEY_ENROLL, []); }

  function findMyEnrollment(email, courseKey){
    const e = String(email||"").trim().toLowerCase();
    const ck = String(courseKey||"");
    return enrollments()
      .filter(x => String(x.courseKey||"")===ck && String(x.email||"").trim().toLowerCase()===e)
      .sort((a,b)=>String(b.createdAt||"").localeCompare(String(a.createdAt||"")))[0] || null;
  }

  window.CURSAPP_SWITCH = window.CURSAPP_SWITCH || {};

  // Desde apoderado -> tesorero (si directivaRole === "tesorero")
  window.CURSAPP_SWITCH.toTesorero = function(){
    const u = getUser();
    if(!u || !u.email) return alert("Falta email en sesión. Vuelve a iniciar sesión.");
    const ck = activeCourseKey();
    if(!ck) return alert("No hay curso activo.");

    const enr = findMyEnrollment(u.email, ck);
    if(!enr || enr.status !== "approved") return alert("Tu usuario no está aprobado en este curso.");
    if(enr.directivaRole !== "tesorero") return alert("Tu usuario no tiene rol tesorero asignado.");

    saveJSON(KEY_USER, { ...u, role:"tesorero", name: (enr.apoderadoName||u.name||"Tesorero") + " (Tesorero)" });
    location.assign("/tesorero.html");
  };

  // Desde tesorero -> apoderado (vuelve al apoderado del mismo email)
  window.CURSAPP_SWITCH.toApoderado = function(){
    const u = getUser();
    if(!u || !u.email) return alert("Falta email en sesión. Vuelve a iniciar sesión.");
    const ck = activeCourseKey();
    if(!ck) return alert("No hay curso activo.");

    const enr = findMyEnrollment(u.email, ck);
    if(!enr || enr.status !== "approved") return alert("Tu usuario no está aprobado en este curso.");

    saveJSON(KEY_USER, {
      ...u,
      role:"apoderado",
      name: (enr.apoderadoName||u.name||"Apoderado") + " (Apoderado)",
      alumno: enr.alumno || u.alumno || "Alumno"
    });
    location.assign("/apoderado.html");
  };
})();
