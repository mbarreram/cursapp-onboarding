/* =========================================================
   Cursapp · switchRole.js (por rol)
   - Cambia entre Directiva (presidente/tesorero) y Apoderado
   - Usa cursapp_directiva_apoderado_by_role_v1
   ========================================================= */

(function(){
  const KEY_USER = "cursapp_demo_user";
  const KEY_BY_ROLE = "cursapp_directiva_apoderado_by_role_v1";
  const KEY_LAST_DIRECTIVA_ROLE = "cursapp_directiva_role_v1";
  const KEY_ENTRY_PREF = "cursapp_entry_pref_v1"; // { presidente: "directiva|apoderado", tesorero: ... }

  function loadJSON(k, def){
    try{
      const v = localStorage.getItem(k);
      if(v==null) return def;
      return JSON.parse(v);
    }catch(e){ return def; }
  }
  function saveJSON(k, v){ localStorage.setItem(k, JSON.stringify(v)); }

  function currentUser(){ return loadJSON(KEY_USER, null); }

  function rememberDirectivaRole(role){
    localStorage.setItem(KEY_LAST_DIRECTIVA_ROLE, String(role||"").toLowerCase());
  }
  function getDirectivaRole(){
    return (localStorage.getItem(KEY_LAST_DIRECTIVA_ROLE) || "presidente").toLowerCase();
  }

  function getApoderadoProfileForRole(role){
    const map = loadJSON(KEY_BY_ROLE, {});
    return map[String(role||"").toLowerCase()] || null;
  }

  function setEntryPref(role, pref){
    const map = loadJSON(KEY_ENTRY_PREF, {});
    map[String(role).toLowerCase()] = pref;
    saveJSON(KEY_ENTRY_PREF, map);
  }
  function getEntryPref(role){
    const map = loadJSON(KEY_ENTRY_PREF, {});
    return map[String(role).toLowerCase()] || null;
  }

  // -------- API global --------
  window.CURSAPP_SWITCH = window.CURSAPP_SWITCH || {};

  window.CURSAPP_SWITCH.toApoderado = function(){
    const u = currentUser();
    const role = (u && u.role) ? String(u.role).toLowerCase() : "";

    if(role !== "presidente" && role !== "tesorero"){
      alert("Debes estar en una sesión de directiva para cambiar a apoderado.");
      return;
    }

    rememberDirectivaRole(role);

    const dap = getApoderadoProfileForRole(role);
    if(!dap || !dap.email || !dap.courseKey){
      alert("Este rol no tiene un hijo registrado.\n\nEn onboarding directiva marca: “También soy apoderado” y registra tu alumno/a.");
      return;
    }

    // set session as apoderado (solo el suyo)
    saveJSON(KEY_USER, {
      name: (dap.apoderadoName || "Apoderado") + " (Demo)",
      role: "apoderado",
      alumno: dap.alumno || "Alumno",
      email: dap.email
    });

    setEntryPref(role, "apoderado");
    location.assign("/apoderado.html");
  };

  window.CURSAPP_SWITCH.toDirectiva = function(){
    const role = getDirectivaRole();
    saveJSON(KEY_USER, {
      name: (role === "tesorero" ? "Tesorero" : "Presidente") + " (Demo)",
      role
    });
    setEntryPref(role, "directiva");
    location.assign("/" + role + ".html");
  };

  // -------- Selector de rol (modal) --------
  window.CURSAPP_SWITCH.maybeShowRolePicker = function(){
    const u = currentUser();
    const role = (u && u.role) ? String(u.role).toLowerCase() : "";
    if(role !== "presidente" && role !== "tesorero") return;

    const pref = getEntryPref(role);
    if(pref === "apoderado"){
      // si prefirió apoderado y existe perfil, entra directo
      const dap = getApoderadoProfileForRole(role);
      if(dap && dap.email && dap.courseKey) window.CURSAPP_SWITCH.toApoderado();
      else setEntryPref(role, "directiva");
      return;
    }
    if(pref === "directiva") return;

    // Solo mostrar modal si existe perfil apoderado para este rol
    const dap = getApoderadoProfileForRole(role);
    if(!dap || !dap.email) return;

    const root = document.createElement("div");
    root.style.cssText = "position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:20000;display:flex;align-items:flex-end;justify-content:center;padding:14px;";
    root.innerHTML = `
      <div class="card" style="width:min(560px,100%);margin-bottom:12px;">
        <div style="font-weight:950;font-size:18px;">¿Cómo quieres ingresar hoy?</div>
        <div class="muted" style="margin-top:6px;font-weight:800;">
          Tienes perfil de directiva y apoderado para este curso.
        </div>

        <div style="margin-top:12px;display:grid;gap:10px;">
          <button class="btn primary" id="pickDirectiva">🧑‍💼 Entrar como Directiva</button>
          <button class="btn ghost" id="pickApoderado">👤 Entrar como Apoderado (${dap.alumno || "Alumno"})</button>
        </div>

        <div class="muted" style="margin-top:10px;font-size:12px;">
          Puedes cambiar después desde el menú ☰.
        </div>
      </div>
    `;
    document.body.appendChild(root);

    root.querySelector("#pickDirectiva").onclick = () => {
      setEntryPref(role, "directiva");
      root.remove();
    };
    root.querySelector("#pickApoderado").onclick = () => {
      setEntryPref(role, "apoderado");
      root.remove();
      window.CURSAPP_SWITCH.toApoderado();
    };

    root.addEventListener("click", (e)=>{
      if(e.target === root) root.remove();
    });
  };

})();
