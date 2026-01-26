/* =========================================================
   Cursapp · switchRole.js
   - Cambia entre Directiva (presidente/tesorero) y Apoderado
   - Usa cursapp_directiva_apoderado_v1 creado en onboarding directiva
   ========================================================= */

(function(){
  const KEY_USER = "cursapp_demo_user";
  const KEY_DAP  = "cursapp_directiva_apoderado_v1";
  const KEY_ROLE = "cursapp_directiva_role_v1";

  function loadJSON(k, def){
    try{
      const v = localStorage.getItem(k);
      if(v==null) return def;
      return JSON.parse(v);
    }catch(e){ return def; }
  }
  function saveJSON(k, v){ localStorage.setItem(k, JSON.stringify(v)); }

  function currentUser(){ return loadJSON(KEY_USER, null); }

  // Guarda/recupera el rol directiva original para volver
  function rememberDirectivaRole(role){
    localStorage.setItem(KEY_ROLE, String(role||"").toLowerCase());
  }
  function getDirectivaRole(){
    return (localStorage.getItem(KEY_ROLE) || "presidente").toLowerCase();
  }

  window.CURSAPP_SWITCH = window.CURSAPP_SWITCH || {};

  // Ir a apoderado usando perfil guardado
  window.CURSAPP_SWITCH.toApoderado = function(){
    const u = currentUser();
    const role = (u && u.role) ? String(u.role).toLowerCase() : "";
    if(role === "presidente" || role === "tesorero"){
      rememberDirectivaRole(role);
    }

    const dap = loadJSON(KEY_DAP, null);
    if(!dap || !dap.email || !dap.courseKey){
      alert("No tienes perfil de apoderado asociado.\n\nEn onboarding directiva marca: 'También soy apoderado'.");
      return;
    }

    // set session as apoderado
    saveJSON(KEY_USER, {
      name: (dap.apoderadoName || "Apoderado") + " (Demo)",
      role: "apoderado",
      alumno: dap.alumno || "Alumno",
      email: dap.email
    });

    // navegar a vista apoderado
    location.assign("/apoderado.html");
  };

  // Volver a directiva usando el rol recordado
  window.CURSAPP_SWITCH.toDirectiva = function(){
    const role = getDirectivaRole(); // presidente|tesorero
    saveJSON(KEY_USER, {
      name: (role === "tesorero" ? "Tesorero" : "Presidente") + " (Demo)",
      role
    });
    location.assign("/" + role + ".html");
  };
})();
