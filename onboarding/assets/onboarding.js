/* =========================================================
   Cursapp · Onboarding (Wizard) — Opción 1
   - Presidente: crea el curso (genera inviteCode)
   - Tesorero: lo designa el Presidente dentro del curso
   - Apoderado: valida inviteCode, salta a paso 3, crea user/profile + enrollment pending
   - Directiva puede marcar “También soy apoderado” (auto-approved y asociado al rol)
   ========================================================= */

function uid(prefix = "id") {
  return prefix + "_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
}

(function () {
  const KEY_ONB_DRAFT = "cursapp_onb_draft_v1";
  const KEY_USERS = "cursapp_users_v1";
  const KEY_PROFILES = "cursapp_profiles_v1";
  const KEY_ACTIVE_COURSE = "cursapp_active_course_v1";
  const KEY_COURSE_V1 = "cursapp_course_v1";
  const KEY_DIRECTIVA_AP_BY_ROLE = "cursapp_directiva_apoderado_by_role_v1";

  // Referidos / agentes Cursapp
  const KEY_REF_AGENTS = "cursapp_ref_agents_v1";
  const KEY_REF_CONVERSIONS = "cursapp_ref_conversions_v1";

  function normalizeReferralCode(v){
    return String(v||"").trim().toUpperCase().replace(/[^A-Z0-9_-]/g,"").slice(0,24);
  }

  function loadRefAgents(){
    const arr = loadJSON(KEY_REF_AGENTS, []);
    if(Array.isArray(arr) && arr.length) return arr;
    // Semilla visual/demo para probar el flujo sin panel admin aún.
    return [
      { id:"ag_demo_1", name:"Agente Demo", code:"CURSAPP2026", status:"active", commissionPct:10 },
      { id:"ag_demo_2", name:"Directiva Referente", code:"DIRECTIVA2026", status:"active", commissionPct:8 }
    ];
  }

  function findRefAgent(code){
    const c = normalizeReferralCode(code);
    if(!c) return null;
    return loadRefAgents().find(a => normalizeReferralCode(a.code) === c && String(a.status||"active") !== "inactive") || null;
  }

  function estimatedStudentsRangeLabel(v){
    const n = Number(v||0);
    if(n===20) return "10 a 20";
    if(n===30) return "21 a 30";
    if(n===40) return "31 a 40";
    if(n===50) return "41 a 50";
    if(n===60) return "51 a 60";
    return "";
  }

  function addDaysISO(days){
    const d = new Date();
    d.setDate(d.getDate() + Number(days||0));
    return d.toISOString();
  }

  function saveReferralConversion(payload){
    const list = loadJSON(KEY_REF_CONVERSIONS, []);
    const key = [payload.courseKey, payload.referralCode].join("|");
    const cleaned = Array.isArray(list) ? list.filter(x => [x.courseKey, x.referralCode].join("|") !== key) : [];
    cleaned.unshift(Object.assign({
      id: "ref_"+uid("conv"),
      status: "pendiente_validacion",
      createdAt: nowISO()
    }, payload));
    saveJSON(KEY_REF_CONVERSIONS, cleaned.slice(0,500));
  }


  function activeReferralForCourse(courseKey){
    const list = loadJSON(KEY_REF_CONVERSIONS, []);
    const nowMs = Date.now();
    return (Array.isArray(list) ? list : []).find(x=>{
      if(String(x.courseKey||"") !== String(courseKey||"")) return false;
      if(!normalizeReferralCode(x.referralCode||"")) return false;
      const st = String(x.status||"").toLowerCase();
      if(st === "rechazado" || st === "liberado") return false;
      if(st === "reservado"){
        const exp = x.reservedUntil ? Date.parse(x.reservedUntil) : 0;
        if(exp && exp < nowMs) return false;
      }
      return true;
    }) || null;
  }

  const DEBUG = localStorage.getItem("cursapp_onb_debug") === "1";
  let __cursappOnboardingFinalizing = false;


  const QS = new URLSearchParams(location.search);
  const MODE = (QS.get("mode") || "apoderado").toLowerCase(); // directiva | apoderado
  const DIRECTIVA_ROLE = (QS.get("role") || "presidente").toLowerCase(); // presidente | tesorero
   // ✅ Si cambiaste de rol/mode, resetea el draft para evitar que “quede pegado” en presidente
(function(){
  try{
    const d = JSON.parse(localStorage.getItem("cursapp_onb_draft_v1") || "{}");
    const last = (d._lastMode || "") + "|" + (d._lastRole || "");
    const now  = MODE + "|" + DIRECTIVA_ROLE;
    if(last && last !== now){
      localStorage.removeItem("cursapp_onb_draft_v1");
    }
    const d2 = JSON.parse(localStorage.getItem("cursapp_onb_draft_v1") || "{}");
    d2._lastMode = MODE;
    d2._lastRole = DIRECTIVA_ROLE;
    localStorage.setItem("cursapp_onb_draft_v1", JSON.stringify(d2));
  }catch(e){}
})();

  // Demo data
  const REGIONS = [
  {"id": "rm", "name": "Región Metropolitana"},
  {"id": "v", "name": "Valparaíso"},
  {"id": "iv", "name": "Coquimbo"},
  {"id": "viii", "name": "Biobío"},
  {"id": "ix", "name": "La Araucanía"},
  {"id": "x", "name": "Los Lagos"}
];
  const COMUNAS = [
  {"id": "rm-stgo", "regionId": "rm", "name": "Santiago"},
  {"id": "rm-nunoa", "regionId": "rm", "name": "Ñuñoa"},
  {"id": "rm-provi", "regionId": "rm", "name": "Providencia"},
  {"id": "rm-maipu", "regionId": "rm", "name": "Maipú"},
  {"id": "v-valpo", "regionId": "v", "name": "Valparaíso"},
  {"id": "v-vina", "regionId": "v", "name": "Viña del Mar"},
  {"id": "v-quilpue", "regionId": "v", "name": "Quilpué"},
  {"id": "iv-coq", "regionId": "iv", "name": "Coquimbo"},
  {"id": "iv-ls", "regionId": "iv", "name": "La Serena"},
  {"id": "viii-conce", "regionId": "viii", "name": "Concepción"},
  {"id": "viii-talc", "regionId": "viii", "name": "Talcahuano"},
  {"id": "ix-temu", "regionId": "ix", "name": "Temuco"},
  {"id": "ix-vill", "regionId": "ix", "name": "Villarrica"},
  {"id": "x-pto", "regionId": "x", "name": "Puerto Montt"},
  {"id": "x-osorno", "regionId": "x", "name": "Osorno"}
];
  const SCHOOLS = [
  {"id": "sch-central", "comunaId": "rm-stgo", "name": "Colegio Central (Demo)"},
  {"id": "sch-andes", "comunaId": "rm-provi", "name": "Colegio Los Andes (Demo)"},
  {"id": "sch-santa", "comunaId": "rm-nunoa", "name": "Colegio Santa María (Demo)"},
  {"id": "sch-bicent", "comunaId": "rm-maipu", "name": "Liceo Bicentenario Maipú (Demo)"},
  {"id": "sch-valpo", "comunaId": "v-valpo", "name": "Colegio Puerto (Demo)"},
  {"id": "sch-vina", "comunaId": "v-vina", "name": "Colegio Costa Viña (Demo)"},
  {"id": "sch-coq", "comunaId": "iv-coq", "name": "Colegio Bahía (Demo)"},
  {"id": "sch-ls", "comunaId": "iv-ls", "name": "Colegio Faro La Serena (Demo)"},
  {"id": "sch-conce", "comunaId": "viii-conce", "name": "Colegio Concepción (Demo)"},
  {"id": "sch-temu", "comunaId": "ix-temu", "name": "Colegio Araucanía (Demo)"}
];
  const LEVELS = ["1°","2°","3°","4°","5°","6°","7°","8°","I°","II°","III°","IV°"];
  const LETTERS = ["A","B","C","D","E","F"];
  const JORNADAS = ["Mañana","Tarde"];

  function $(id) { return document.getElementById(id); }
  function nowISO() { return new Date().toISOString(); }
  function nowYear() { return new Date().getFullYear(); }

  function escapeHtml(str){
    return String(str||"").replace(/[&<>'"]/g, s=>({ "&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;" }[s]));
  }

  // ---- Modal (UI) ----
  function showModal(opts){
    const o = opts || {};
    const title = escapeHtml(o.title || "");
    const body = o.bodyHtml || "";
    const actions = Array.isArray(o.actions) ? o.actions : [{ label:"Cerrar", variant:"primary", onClick: ()=>closeModal() }];
    // remove existing
    const old = document.getElementById("cursappModal");
    if(old) old.remove();

    const wrap = document.createElement("div");
    wrap.id = "cursappModal";
    wrap.style.cssText = "position:fixed;inset:0;z-index:9999;background:rgba(15,23,42,.45);display:flex;align-items:center;justify-content:center;padding:18px;";
    wrap.innerHTML = `
      <div style="width:min(520px,100%);background:#fff;border-radius:18px;box-shadow:0 20px 60px rgba(2,6,23,.25);overflow:hidden;">
        <div style="padding:16px 16px 10px 16px;">
          <div style="font-weight:950;font-size:18px;line-height:1.2;">${title}</div>
        </div>
        <div style="padding:0 16px 14px 16px;color:rgba(15,23,42,.78);font-size:14px;line-height:1.45;">
          ${body}
        </div>
        <div style="display:flex;gap:10px;justify-content:flex-end;padding:12px 16px 16px 16px;background:rgba(248,250,252,1);">
          ${actions.map((a,i)=>{
            const v = a.variant==="ghost" ? "border:1px solid rgba(226,232,240,1);background:#fff;color:rgba(15,23,42,.9);" :
                      a.variant==="danger" ? "background:#ef4444;color:#fff;" :
                      "background:linear-gradient(90deg,#5b5fe5,#7c3aed);color:#fff;";
            return `<button data-mi="${i}" style="border:0;border-radius:12px;padding:10px 14px;font-weight:900;cursor:pointer;${v}">${escapeHtml(a.label||"OK")}</button>`;
          }).join("")}
        </div>
      </div>
    `;
    document.body.appendChild(wrap);

    function closeModal(){ wrap.remove(); }
    wrap.addEventListener("click", (ev)=>{ if(ev.target===wrap) closeModal(); });
    wrap.querySelectorAll("button[data-mi]").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        const i = Number(btn.getAttribute("data-mi"));
        const act = actions[i];
        try{ if(act && typeof act.onClick==="function") act.onClick(closeModal); }catch(e){ closeModal(); }
      });
    });
    return { close: ()=>wrap.remove() };
  }

  function loadJSON(key, fallback){
    try{
      const v = localStorage.getItem(key);
      if(v==null) return fallback;
      return JSON.parse(v);
    }catch(e){
      return fallback;
    }
  }
  function saveJSON(key, val){ localStorage.setItem(key, JSON.stringify(val)); }

  function loadDraft(){ return loadJSON(KEY_ONB_DRAFT, {}); }
  function saveDraft(d){ saveJSON(KEY_ONB_DRAFT, d||{}); }
  function clearDraft(){ localStorage.removeItem(KEY_ONB_DRAFT); }

  function loadUsers(){ return loadJSON(KEY_USERS, []); }
  function saveUsers(u){ saveJSON(KEY_USERS, u||[]); }

  function loadProfiles(){ return loadJSON(KEY_PROFILES, []); }
  function saveProfiles(p){ saveJSON(KEY_PROFILES, p||[]); }

  async function maybeSyncSupabase(reason){
    try{
      if(window.CURSAPP && typeof window.CURSAPP.syncSupabase === "function"){
        await window.CURSAPP.syncSupabase(reason || "onboarding");
        return true;
      }
    }catch(e){
      try{ alert("Supabase ERROR ❌\n" + (e && e.message ? e.message : String(e))); }catch(_){}
      return false;
    }
    return false;
  }

  /* =========================================================
     Fase 2B · Supabase directo en Onboarding
     Regla: usuarios/cursos/miembros NO se crean desde localStorage.
     localStorage queda solo como compatibilidad visual/sesión mínima.
     ========================================================= */
  const SB_URL_ONB = "https://ngxistgymgdkoaiulfbq.supabase.co";
  const SB_KEY_ONB = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5neGlzdG5tZ2Rrb2FpdWxmYnEiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTc4MDY5ODU0NCwiZXhwIjoyMDk2Mjc0NTQ0fQ.INVALID";
  const SB_KEY_ONB_REAL = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5neGlzdGd5bWdka29haXVsZmJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2OTg1NDQsImV4cCI6MjA5NjI3NDU0NH0.1r-aLijYEWvUifKcLjlClnA8-oYw11lgThY0swg_xbg";

  function sbQ(v){ return encodeURIComponent(String(v == null ? "" : v)); }
  function sbCleanDate(v){ const s = String(v || "").slice(0,10); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null; }
  async function sbOnb(path, opts){
    const key = SB_KEY_ONB_REAL;
    const res = await fetch(SB_URL_ONB + "/rest/v1/" + path, Object.assign({
      method: "GET",
      headers: {
        apikey: key,
        Authorization: "Bearer " + key,
        "Content-Type": "application/json",
        Prefer: "return=representation"
      }
    }, opts || {}));
    const text = await res.text();
    let data = null;
    try{ data = text ? JSON.parse(text) : null; }catch(e){ data = text; }
    if(!res.ok){
      const msg = (data && (data.message || data.error || data.hint || data.details)) || text || ("HTTP " + res.status);
      throw new Error(msg);
    }
    return Array.isArray(data) ? data : (data ? [data] : []);
  }
  async function sbSelectOne(table, query){
    const rows = await sbOnb(table + "?" + query + "&limit=1");
    return rows[0] || null;
  }
  async function sbInsert(table, body){
    const rows = await sbOnb(table, { method:"POST", body: JSON.stringify(body) });
    return rows[0] || null;
  }
  async function ensureColegioDB(courseObj){
    const c = courseObj.course || courseObj || {};
    const nombre = String(c.schoolName || c.school || c.colegio || "Colegio").trim() || "Colegio";
    const region = String(c.regionName || c.region || "").trim();
    const comuna = String(c.comunaName || c.comuna || "").trim();
    let row = await sbSelectOne("colegios", "nombre=eq." + sbQ(nombre) + "&region=eq." + sbQ(region) + "&comuna=eq." + sbQ(comuna) + "&select=*");
    if(row && row.id) return row;
    row = await sbInsert("colegios", {
      nombre,
      region: region || null,
      comuna: comuna || null,
      rbd: c.schoolId || null,
      es_catalogo_demo: /\(demo\)/i.test(nombre)
    });
    return row;
  }
  async function ensureCursoDB(courseObj){
    const c = courseObj.course || courseObj || {};
    const courseKey = String(courseObj.courseKey || c.courseKey || "").trim();
    if(!courseKey) throw new Error("courseKey vacío al crear curso");
    let row = await sbSelectOne("cursos", "course_key=eq." + sbQ(courseKey) + "&select=*");
    if(row && row.id) return row;
    const colegio = await ensureColegioDB(courseObj);
    const nombre = `${c.schoolName || "Colegio"} · ${c.level || ""}${c.letter || ""} ${c.year || ""}`.replace(/\s+/g," ").trim();
    row = await sbInsert("cursos", {
      colegio_id: colegio && colegio.id ? colegio.id : null,
      nombre: nombre || "Curso Cursapp",
      nivel: c.level || null,
      letra: c.letter || null,
      anio: Number(c.year || 0) || null,
      jornada: c.jornada || null,
      course_key: courseKey,
      invite_code: courseObj.inviteCode || c.inviteCode || generateCode(),
      estado: "activo"
    });
    return row;
  }
  async function ensureUsuarioDB(payload){
    const email = String(payload.email || "").trim().toLowerCase();
    if(!email) throw new Error("email vacío al crear usuario");
    let row = await sbSelectOne("usuarios", "email=eq." + sbQ(email) + "&select=*");
    if(row && row.id) return row;
    row = await sbInsert("usuarios", {
      email,
      nombre: payload.nombre || payload.name || null,
      telefono: payload.telefono || payload.phone || null,
      rol_global: "usuario",
      estado: "activo"
    });
    return row;
  }
  async function ensureMiembroDB(payload){
    if(!payload.curso_id) throw new Error("curso_id vacío al crear miembro");
    const email = String(payload.email || "").trim().toLowerCase();
    const rol = String(payload.rol || "apoderado").toLowerCase();
    let row = await sbSelectOne("miembros_curso", "curso_id=eq." + sbQ(payload.curso_id) + "&email=eq." + sbQ(email) + "&rol=eq." + sbQ(rol) + "&select=*");
    if(row && row.id) return row;
    row = await sbInsert("miembros_curso", {
      curso_id: payload.curso_id,
      usuario_id: payload.usuario_id || null,
      rol,
      nombre_apoderado: payload.nombre_apoderado || null,
      nombre_alumno: payload.nombre_alumno || null,
      email: email || null,
      estado: payload.estado || (rol === "apoderado" ? "pendiente" : "aprobado"),
      activacion_pagada: !!payload.activacion_pagada
    });
    return row;
  }
  async function findCursoByInviteCodeDB(code){
    const rows = await sbOnb("cursos?invite_code=eq." + sbQ(String(code||"").trim().toUpperCase()) + "&select=*,colegios(*)&limit=1");
    return rows[0] || null;
  }
  function buildCourseObjFromCursoDB(row){
    const colegio = row.colegios || {};
    const regionObj = REGIONS.find(r => String(r.name||"").toLowerCase() === String(colegio.region||"").toLowerCase());
    const comunaObj = COMUNAS.find(c => String(c.name||"").toLowerCase() === String(colegio.comuna||"").toLowerCase());
    return {
      courseKey: row.course_key,
      inviteCode: row.invite_code || "",
      course: {
        regionId: regionObj ? regionObj.id : "",
        regionName: colegio.region || "",
        comunaId: comunaObj ? comunaObj.id : "",
        comunaName: colegio.comuna || "",
        schoolId: colegio.rbd || "",
        schoolName: colegio.nombre || row.nombre || "Colegio",
        jornada: row.jornada || "",
        level: row.nivel || "",
        letter: row.letra || "",
        year: row.anio || ""
      },
      createdAt: row.created_at || nowISO(),
      createdByRole: "supabase"
    };
  }
  function setMinimalSession(session){
    const clean = {
      userId: session.userId,
      email: session.email,
      role: session.role,
      currentRole: session.role,
      roles: session.roles || [session.role],
      courseKey: session.courseKey
    };
    try{ sessionStorage.setItem("cursapp_session_v1", JSON.stringify(clean)); }catch(e){}
    // Compatibilidad temporal: las pantallas actuales aún leen esta sesión.
    try{ localStorage.setItem("cursapp_session_v1", JSON.stringify(clean)); }catch(e){}
    try{ localStorage.setItem("cursapp_active_course_v1", clean.courseKey || ""); }catch(e){}
    try{ localStorage.setItem("cursapp_active_role_v1", clean.role || ""); }catch(e){}
  }
  async function registerPresidentSupabaseOnly(courseObj, data){
    const curso = await ensureCursoDB(courseObj);
    const usuario = await ensureUsuarioDB({ email:data.email, nombre:data.name, telefono:data.phone || "" });
    await ensureMiembroDB({
      curso_id: curso.id,
      usuario_id: usuario.id,
      rol: "presidente",
      nombre_apoderado: data.name,
      email: data.email,
      estado: "aprobado",
      activacion_pagada: true
    });
    if(data.alsoApoderado){
      await ensureMiembroDB({
        curso_id: curso.id,
        usuario_id: usuario.id,
        rol: "apoderado",
        nombre_apoderado: data.name,
        nombre_alumno: data.alumno || "",
        email: data.email,
        estado: "aprobado",
        activacion_pagada: true
      });
    }
    return { curso, usuario };
  }
  async function registerApoderadoSupabaseOnly(courseKey, courseObj, data){
    const curso = await ensureCursoDB(courseObj || { courseKey, course:{} });
    const usuario = await ensureUsuarioDB({ email:data.email, nombre:data.name, telefono:data.phone || "" });
    const miembro = await ensureMiembroDB({
      curso_id: curso.id,
      usuario_id: usuario.id,
      rol: "apoderado",
      nombre_apoderado: data.name,
      nombre_alumno: data.alumno || "",
      email: data.email,
      estado: "pendiente",
      activacion_pagada: data.activationStatus === "paid"
    });
    return { curso, usuario, miembro };
  }


  function setActiveCourseKey(k){ localStorage.setItem(KEY_ACTIVE_COURSE, k); }

  function validateEmail(e){
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e||"").trim());
  }

  function hashDemo(str){
    let h=5381;
    const s = String(str||"");
    for(let i=0;i<s.length;i++) h = ((h<<5)+h) + s.charCodeAt(i);
    return "h_"+(h>>>0).toString(16);
  }
  function alumnoIdOf(courseKey, apoderadoEmail, alumnoLabel){
    let h=5381;
    const s = [courseKey, apoderadoEmail, alumnoLabel].join("|");
    for(let i=0;i<s.length;i++) h = ((h<<5)+h) + s.charCodeAt(i);
    return "alu_"+(h>>>0).toString(16);
  }

  function makeCourseKey(schoolId, level, letter, jornada, year){
    return [schoolId, level, letter, jornada, year].join("|");
  }

  function generateCode(){
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for(let i=0;i<6;i++) code += chars[Math.floor(Math.random()*chars.length)];
    return code;
  }

  function getCourseV1(){ return loadJSON(KEY_COURSE_V1, null); }

  function courseSummaryHTML(courseObj){
    const c = courseObj?.course || {};
    return `
      <div class="card" style="padding:12px;border:1px solid rgba(91,92,226,.22);background:rgba(91,92,226,.06);">
        <div style="font-weight:950;">Curso encontrado ✅</div>
        <div class="muted" style="margin-top:6px;font-weight:800;">
          ${c.schoolName} · ${c.level}${c.letter} ${c.year} · ${c.jornada}
        </div>
      </div>
    `;
  }

  function courseBanner(courseObj){
    const c = courseObj?.course || {};
    return `
      <div class="card" style="margin-top:12px;border:1px solid rgba(34,197,94,.20);background:rgba(34,197,94,.06);">
        <div style="font-weight:950;">Te estás registrando en:</div>
        <div class="muted" style="margin-top:6px;font-weight:900;">
          ${c.schoolName} · ${c.level}${c.letter} ${c.year} · ${c.jornada}
        </div>
      </div>
    `;
  }

  function render(){
    const root = $("app");
    if(!root) return;

    const d = loadDraft();
    if(!d.step) d.step = 1;

    // Apoderado con curso validado: forzar step 3
    if(MODE==="apoderado" && d.courseLocked && Number(d.step) < 3){
      d.step = 3;
      saveDraft(d);
    }

    const step = Number(d.step||1);
    const stepsTotal = 4;
    const progressPct = Math.round((step/stepsTotal)*100);

    // defaults (solo presidente crea curso) — con fallbacks para evitar combos sin data
    // 1) región válida con comunas
    let regionId = d.regionId || (REGIONS[0] && REGIONS[0].id);
    if(regionId){
      const hasComunas = COMUNAS.some(c=>c.regionId===regionId);
      if(!hasComunas){
        const r2 = REGIONS.find(r=>COMUNAS.some(c=>c.regionId===r.id));
        if(r2) regionId = r2.id;
      }
    }

    // 2) comuna válida dentro de la región
    let comunas = COMUNAS.filter(c=>c.regionId===regionId);
    let comunaId = d.comunaId || (comunas[0]?.id || "");
    if(!comunaId || !comunas.some(c=>c.id===comunaId)){
      comunaId = comunas[0]?.id || "";
    }

    // 3) colegio válido dentro de la comuna; si no hay, mover a una comuna con colegios
    let schools = SCHOOLS.filter(s=>s.comunaId===comunaId);
    if(!schools.length){
      const comunaWithSchools = comunas.find(c=>SCHOOLS.some(s=>s.comunaId===c.id));
      if(comunaWithSchools){
        comunaId = comunaWithSchools.id;
        schools = SCHOOLS.filter(s=>s.comunaId===comunaId);
      }
    }
    let schoolId = d.schoolId || (schools[0]?.id || "");
    if(!schoolId || !schools.some(s=>s.id===schoolId)){
      schoolId = schools[0]?.id || "";
    }

    const jornada = d.jornada || JORNADAS[0];
    const year = d.year || nowYear();
    const level = d.level || "2°";
    const letter = d.letter || "B";

    const name = d.name || "";
    const alumno = d.alumno || "";

    // apoderado real
    const email = d.email || "";
    const email2 = d.email2 || "";
    const phone = d.phone || "";
    const pass = d.pass || "";
    const pass2 = d.pass2 || "";

    // directiva también apoderado (campos separados)
    const alsoAp = !!d.alsoApoderado;
    const dEmail = d.dEmail || "";
    const dEmail2 = d.dEmail2 || "";
    const dPhone = d.dPhone || "";
    const dPass = d.dPass || "";
    const dPass2 = d.dPass2 || "";

    const inviteCodeInput = (d.inviteCode || "").toUpperCase();         // apoderados
    const referralCode = normalizeReferralCode(d.referralCode || "");
    const referralAgent = findRefAgent(referralCode);
    const estimatedStudents = Number(d.estimatedStudents || 0);
    const payChoice = d.payChoice || "now";

    const debugLine = DEBUG
      ? `<div class="muted" style="margin-top:8px;font-size:12px;">DEBUG · mode=${MODE} role=${DIRECTIVA_ROLE} step=${step} locked=${d.courseLocked?"1":"0"} alsoAp=${alsoAp?"1":"0"}</div>`
      : "";

    function option(list, valueKey, labelKey, selected){
      return list.map(x=>`<option value="${x[valueKey]}" ${x[valueKey]===selected?"selected":""}>${x[labelKey]}</option>`).join("");
    }
    function optionVals(list, selected){
      return list.map(x=>`<option value="${x}" ${x===selected?"selected":""}>${x}</option>`).join("");
    }

    const courseObj = getCourseV1();
    const banner = (MODE==="apoderado" && d.courseLocked && courseObj) ? courseBanner(courseObj) : "";
    const roleName = MODE==="directiva" ? (DIRECTIVA_ROLE==="tesorero" ? "Tesorero" : "Presidente") : "Apoderado";
    const stepTitles = MODE==="directiva"
      ? ["Datos del curso", "Curso", "Cuenta", "¡Listo!"]
      : ["Invitación", "Curso", "Cuenta", "Activación"];
    const currentStepTitle = stepTitles[step-1] || "Onboarding";

    root.innerHTML = `
      <div class="card onbHeroCard onbHeroCompact" style="margin-top:12px;">
        <div class="onbHeroHead">
          <div class="onbHeroLogo">C</div>
          <div class="onbHeroCopy">
            <div class="onbEyebrow">${MODE==="directiva" ? "👑" : "🔐"} ${roleName}</div>
            <h1>${step===4 ? (MODE==="directiva" ? "Resumen final" : "Activa tu acceso") : (MODE==="directiva" ? "Crear curso" : "Ingresa a tu curso")}</h1>
            <p>Paso ${step} de ${stepsTotal} · <b>${progressPct}% completado</b></p>
          </div>
        </div>

        <div class="wizardWrap" style="margin-top:16px;">
          <div class="wizardBar"><div class="wizardFill" style="width:${progressPct}%"></div></div>
          <div class="wizardSteps wizardStepsLabels" aria-hidden="true">
            ${[1,2,3,4].map(n=>`<div class="wStepItem ${step===n?"active":(step>n?"done":"")}"><div class="wStep"><span>${step>n?"✓":n}</span></div><small>${stepTitles[n-1]}</small></div>`).join("")}
          </div>
        </div>
        ${debugLine}
      </div>

      ${banner}

      <div class="card onbFormCard" style="margin-top:12px;">
        ${step===1 ? `
          ${
            MODE==="apoderado" ? `
              <div>
                <label style="font-weight:900;">Código de invitación (Apoderados)</label>
                <input id="onbInviteCode" placeholder="Ej: ABC123" value="${escapeHtml(inviteCodeInput)}" />
                <button class="btn primary" id="btnValidateCode" type="button" style="width:100%;margin-top:10px;">Validar código</button>
                <div class="muted" style="margin-top:8px;">Pídeselo a la directiva del curso.</div>
                <div id="coursePreview" style="margin-top:12px;"></div>
              </div>
            ` : (DIRECTIVA_ROLE!=="presidente" ? `
              <div style="border:1px solid rgba(229,231,235,.75);border-radius:16px;padding:12px;background:rgba(248,250,252,1);">
                <div style="font-weight:950;">El tesorero no se registra aquí</div>
                <div class="muted" style="margin-top:6px;">
                  El Presidente designa al tesorero desde el menú del curso.
                </div>
              </div>
            ` : `
              <div class="onbPremiumIntro onbInfoSoft">
                <div class="onbIntroIcon">🎓</div>
                <div>
                  <div style="font-weight:950;">Crear curso como Presidente</div>
                  <div class="muted" style="margin-top:6px;">Selecciona región, comuna y colegio. Luego podrás invitar a la directiva y apoderados.</div>
                </div>
              </div>

              <div class="onbFieldGrid">
                <div class="onbInputGroup">
                  <label style="font-weight:900;">Región</label>
                  <div class="onbSelectShell"><span>📍</span><select id="onbRegion">${option(REGIONS,"id","name",regionId)}</select></div>
                </div>
                <div class="onbInputGroup">
                  <label style="font-weight:900;">Comuna</label>
                  <div class="onbSelectShell"><span>🏙️</span><select id="onbComuna">${option(comunas,"id","name",comunaId)}</select></div>
                </div>
              </div>

              <div class="onbInputGroup" style="margin-top:12px;">
                <label style="font-weight:900;">Colegio</label>
                <div class="onbSelectShell"><span>🏫</span><select id="onbSchool">${option(schools,"id","name",schoolId)}</select></div>
              </div>

              <div class="onbReferralBox onbRangeBox">
                <div class="onbReferralHead">
                  <div class="onbReferralIcon">👥</div>
                  <div>
                    <div style="font-weight:950;">Cantidad estimada de alumnos/apoderados</div>
                    <div class="muted" style="margin-top:4px;">Este dato nos ayuda a personalizar tu experiencia.</div>
                  </div>
                </div>
                <div class="onbRangeGrid" role="radiogroup" aria-label="Cantidad estimada">
                  ${[
                    [20,"10-20","👥"],
                    [30,"21-30","👥"],
                    [40,"31-40","👥"],
                    [50,"41+","👥"]
                  ].map(([val,label,icon])=>`<label class="onbRangeOption ${estimatedStudents===val?"active":""}"><input type="radio" name="onbEstimatedStudentsRadio" value="${val}" ${estimatedStudents===val?"checked":""}/><span>${icon}</span><b>${label}</b></label>`).join("")}
                </div>
              </div>

              <div class="onbReferralBox">
                <div class="onbReferralHead">
                  <div class="onbReferralIcon">🏆</div>
                  <div>
                    <div style="font-weight:950;">Código de recomendación</div>
                    <div class="muted" style="margin-top:4px;">Opcional · si alguien te compartió un código Cursapp.</div>
                  </div>
                </div>
                <input id="onbReferralCode" placeholder="Ej: CURSAPP2026" value="${escapeHtml(referralCode)}" autocomplete="off" autocapitalize="characters" />
                <div id="onbReferralStatus" class="muted" style="margin-top:8px;font-weight:800;">
                  ${referralCode ? (referralAgent ? `Código asociado a: <b>${escapeHtml(referralAgent.name||referralAgent.code)}</b>` : `Código ingresado pendiente de validación`) : `Si no tienes código, puedes continuar normalmente.`}
                </div>
              </div>
            `)
          }
        `:""}

        ${step===2 ? `
          ${MODE==="directiva" && DIRECTIVA_ROLE==="presidente" ? `
            <div style="display:flex;gap:10px;flex-wrap:wrap;">
              <div style="flex:1;min-width:160px;">
                <label style="font-weight:900;">Jornada</label>
                <select id="onbJornada">${optionVals(JORNADAS,jornada)}</select>
              </div>
              <div style="flex:1;min-width:160px;">
                <label style="font-weight:900;">Año</label>
                <input id="onbYear" inputmode="numeric" value="${year}" />
              </div>
            </div>

            <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;">
              <div style="flex:1;min-width:160px;">
                <label style="font-weight:900;">Nivel</label>
                <select id="onbLevel">${optionVals(LEVELS,level)}</select>
              </div>
              <div style="flex:1;min-width:160px;">
                <label style="font-weight:900;">Letra</label>
                <select id="onbLetter">${optionVals(LETTERS,letter)}</select>
              </div>
            </div>
          ` : `
            <div class="muted" style="font-weight:900;">Paso no usado.</div>
          `}
        `:""}

        ${step===3 ? `
          <div>
            <label style="font-weight:900;">Nombre ${MODE==="directiva" ? "directiva" : "apoderado"}</label>
            <input id="onbName" placeholder="Nombre y apellido" value="${escapeHtml(name)}" />
          </div>

          ${MODE==="apoderado" ? `
          <div style="margin-top:12px;">
            <label style="font-weight:900;">Alumno/a</label>
            <input id="onbAlumno" placeholder="Nombre alumno/a" value="${escapeHtml(alumno)}" />
          </div>
          ` : ``}

          ${MODE==="directiva" ? `
          <div class="credBox" style="margin-top:12px;border:1px solid rgba(229,231,235,.75);border-radius:16px;padding:12px;background:rgba(248,250,252,1);">
            <div style="font-weight:950;">Acceso del Presidente</div>
            <div class="muted" style="margin-top:6px;">Este correo será tu usuario de entrada.</div>

            <div style="margin-top:10px;">
              <label style="font-weight:900;">Correo (usuario)</label>
              <input id="pEmail" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false"
                     placeholder="correo@dominio.com" value="${escapeHtml(d.pEmail||'')}" />
            </div>

            
<div class="muted" style="margin-top:8px;">Revisa tu correo e ingresa el código para continuar.</div>

<div class="otpRow" style="margin-top:10px;">
  <div class="otpField">
    <label style="font-weight:900;">Código (OTP)</label>
    <input id="pOtp" autocomplete="off" inputmode="numeric" maxlength="6" placeholder="6 dígitos"
           value="${escapeHtml(d.pOtp||'')}" />
  </div>
  <button class="btn ghost" id="btnSendOtp" type="button">Enviar código</button>
  <button class="btn primary" id="btnVerifyOtp" type="button">Validar</button>
</div>

<div id="otpHint" class="muted" style="margin-top:8px; display:${d.pOtpSent ? "block":"none"};">
  Demo OTP: <b>${escapeHtml(d.pOtpCode||"")}</b>
</div>

<div id="otpOk" class="otpStatusOk" style="display:${d.pOtpVerified ? "inline-flex":"none"};">✓ Código verificado</div>


            <div style="margin-top:10px;">
              <label style="font-weight:900;">Contraseña (mín. 6)</label>
              <input id="pPass" type="password" autocomplete="new-password" placeholder="••••" value="${escapeHtml(d.pPass||'')}" />
            </div>
            <div style="margin-top:12px;">
              <label style="font-weight:900;">Confirmar contraseña</label>
              <input id="pPass2" type="password" autocomplete="new-password" placeholder="Repite tu contraseña" value="${escapeHtml(d.pPass2||'')}" />
            </div>


          </div>
          ` : ``}

          ${MODE==="directiva" ? `
            <div style="margin-top:12px;border:1px solid rgba(229,231,235,.75);border-radius:16px;padding:12px;background:rgba(248,250,252,1);">
              <label style="display:flex;gap:10px;align-items:center;cursor:pointer;">
                <input id="alsoAp" type="checkbox" ${alsoAp ? "checked":""}/>
                <span style="font-weight:950;">También soy apoderado de este curso</span>
              </label>
              <div class="muted" style="margin-top:6px;">Registrarás tu alumno/a y podrás cambiar de rol desde el menú.</div>
            </div>

            ${alsoAp ? `
              <div style="margin-top:12px;">
                <label style="font-weight:900;">Alumno/a (obligatorio)</label>
                <input id="dAlumno" placeholder="Nombre alumno/a" value="${escapeHtml(alumno)}" />
              </div>

              <div style="margin-top:12px;">
                <label style="font-weight:900;">Teléfono (opcional)</label>
                <input id="dPhone" placeholder="+56 9 1234 5678" value="${escapeHtml(dPhone)}" />
              </div>


              <div class="muted" style="margin-top:10px;font-weight:800;">
                Tu perfil apoderado quedará <b>aprobado automáticamente</b> por ser directiva.
              </div>
            ` : ``}
          ` : ``}

          ${MODE==="apoderado" ? `
            <div class="credBox" style="margin-top:12px;border:1px solid rgba(229,231,235,.75);border-radius:16px;padding:12px;background:rgba(248,250,252,1);">
              <div style="font-weight:950;">Correo de acceso</div>
              <div class="muted" style="margin-top:6px;">Te pediremos un código (OTP) para continuar.</div>

              <div style="margin-top:10px;">
                <label style="font-weight:900;">Correo (usuario)</label>
                <input id="onbEmail" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false"
                       placeholder="correo@dominio.com" value="${escapeHtml(email)}" />
              </div>

              <div style="margin-top:10px; display:flex; gap:10px; align-items:flex-end; flex-wrap:wrap;">
                <div style="flex:1; min-width:160px;">
                  <label style="font-weight:900;">Código (OTP)</label>
                  <input id="aOtp" autocomplete="off" inputmode="numeric" maxlength="6" placeholder="6 dígitos"
                         value="${escapeHtml(d.aOtp||'')}" />
                </div>
                <button class="btn ghost" id="btnSendOtpA" type="button" style="min-width:160px;">Enviar código</button>
                <button class="btn primary" id="btnVerifyOtpA" type="button" style="min-width:160px;">Validar</button>
              </div>
              <div id="otpHintA" class="muted" style="margin-top:8px; display:${d.aOtpSent ? "block":"none"};">
                Demo OTP: <b>${escapeHtml(d.aOtpCode||"")}</b>
              </div>
              <div id="otpOkA" class="otpStatusOk" style="display:${d.aOtpVerified ? "inline-flex":"none"};">✓ Código verificado</div>

            </div>

            <div style="margin-top:12px;">
              <label style="font-weight:900;">Teléfono (opcional)</label>
              <input id="onbPhone" placeholder="+56 9 1234 5678" value="${escapeHtml(phone)}" />
            </div>

            <div style="margin-top:12px;">
              <label style="font-weight:900;">Password</label>
              <input id="onbPass" type="password" placeholder="Mínimo 6 caracteres" value="${escapeHtml(pass)}" />
            </div>

            <div style="margin-top:12px;">
              <label style="font-weight:900;">Confirmar password</label>
              <input id="onbPass2" type="password" placeholder="Repite tu password" value="${escapeHtml(pass2)}" />
            </div>
          ` : ``}
        `:""}

        ${step===4 ? `
          ${MODE==="apoderado" ? `
            <div style="border:1px solid rgba(229,231,235,.75);border-radius:16px;padding:12px;background:#fff;">
              <div style="font-weight:950;">Resumen</div>
              <div class="muted" style="margin-top:6px;">Revisa tus datos antes de finalizar.</div>

              <div class="muted" style="margin-top:10px;line-height:1.45;">
                Te registrarás en el colegio <b>${escapeHtml(String((SCHOOLS.find(s=>s.id===d.schoolId)||{}).name||"").trim())||"—"}</b>,
                curso <b>${escapeHtml(String(d.level||"").trim())}${escapeHtml(String(d.letter||"").trim().toUpperCase())}</b>,
                jornada <b>${escapeHtml(String(d.jornada||"").trim())||"—"}</b>,
                año <b>${escapeHtml(String(d.year||"").trim())||"—"}</b>.
              </div>

              <div style="margin-top:12px;display:grid;gap:8px;">
                <div><span class="muted">Correo de acceso:</span> <b>${escapeHtml(String(d.email||"").trim().toLowerCase()) || "-"}</b></div>
                <div><span class="muted">Alumno/a:</span> <b>${escapeHtml(String(d.alumno||"").trim()) || "-"}</b></div>
              </div>

              <div class="muted" style="margin-top:12px;">
                Tu ingreso al curso quedará <b>pendiente de aprobación</b> por la directiva.
              </div>
            </div>

            <div style="border:1px solid rgba(229,231,235,.75);border-radius:16px;padding:12px;background:rgba(248,250,252,1);">
              <div style="font-weight:950;">Activación por curso</div>
              <div class="muted" style="margin-top:6px;">Setup único: <b>$7.990</b> por apoderado por curso (demo).</div>

              <div style="margin-top:10px;display:flex;gap:10px;flex-wrap:wrap;">
                <label class="tag" style="cursor:pointer;">
                  <input type="radio" name="pay" value="now" ${payChoice!=="later"?"checked":""}/> Pagar ahora
                </label>
                <label class="tag" style="cursor:pointer;">
                  <input type="radio" name="pay" value="later" ${payChoice==="later"?"checked":""}/> Pagar después
                </label>
              </div>

              <div class="muted" style="margin-top:8px;">
                Aunque pagues, el ingreso quedará <b>pendiente de aprobación</b> por la directiva.
              </div>
            </div>
          ` : `
            <div class="onbSuccessHero">
              <div class="onbSuccessIcon">🏫<span>✓</span></div>
              <h2>Tu curso está listo para crear</h2>
              <p>Revisa la información antes de finalizar. Después podrás invitar directiva y apoderados.</p>
            </div>

            <div class="onbSummaryCard">
              <div class="onbSummaryHead">
                <div><span class="onbTinyIcon">📋</span><b>Resumen del curso</b></div>
              </div>
              <div class="onbSummaryRows">
                <div><span>Nombre del curso</span><b>${escapeHtml(String(d.level||"").trim())}° ${escapeHtml(String(d.letter||"").trim().toUpperCase())}</b></div>
                <div><span>Colegio</span><b>${escapeHtml(String((SCHOOLS.find(s=>s.id===d.schoolId)||{}).name||"").trim())||"—"}</b></div>
                <div><span>Región</span><b>${escapeHtml(String((REGIONS.find(r=>r.id===d.regionId)||{}).name||"").trim())||"—"}</b></div>
                <div><span>Comuna</span><b>${escapeHtml(String((COMUNAS.find(c=>c.id===d.comunaId)||{}).name||"").trim())||"—"}</b></div>
                <div><span>Jornada</span><b>${escapeHtml(String(d.jornada||"").trim())||"—"}</b></div>
                <div><span>Alumnos estimados</span><b>${estimatedStudentsRangeLabel(d.estimatedStudents) || "—"}</b></div>
                <div><span>Correo de acceso</span><b>${escapeHtml(String(d.pEmail||"").trim().toLowerCase()) || "-"}</b></div>
                <div><span>Rol</span><b>${escapeHtml((DIRECTIVA_ROLE==="tesorero" ? "Tesorero" : (d.alsoApoderado ? "Presidente · Apoderado" : "Presidente")))}</b></div>
              </div>
            </div>

            <div class="onbNextActions">
              <div class="onbActionCard"><span>👥</span><b>Invitar directiva</b><small>Agrega tesorero y secretario del curso.</small></div>
              <div class="onbActionCard"><span>📨</span><b>Invitar apoderados</b><small>Comparte el código de invitación.</small></div>
              <div class="onbActionCard green"><span>📈</span><b>Ir al dashboard</b><small>Gestiona campañas, pagos e informes.</small></div>
            </div>
          `}
        `:""}

        <div style="margin-top:14px;display:flex;justify-content:space-between;gap:10px;">
          <button class="btn ghost" id="btnPrev" ${step===1?"disabled":""}>Atrás</button>
          <button class="btn primary" id="btnNext">${step===4?"Finalizar":"Continuar"}</button>
        </div>
      </div>
    `;

    wire(step, d, { regionId, comunaId, schoolId });
    saveDraft(d);
  }

  function wire(step, d, ctx){
  const btnPrev = $("btnPrev");
  const btnNext = $("btnNext");

  // --- Step 1: Apoderado valida inviteCode ---
  if(step===1 && MODE==="apoderado"){
    const inv = $("onbInviteCode");
    const btn = $("btnValidateCode");
    const preview = $("coursePreview");

    inv && (inv.oninput = ()=>{ d.inviteCode = String(inv.value||"").trim().toUpperCase(); saveDraft(d); });

    btn && (btn.onclick = async ()=>{
      const code = String(d.inviteCode||"").trim().toUpperCase();
      if(!code){ alert("Ingresa el código de invitación."); return; }

      try{
        const curso = await findCursoByInviteCodeDB(code);
        if(!curso || !curso.id){
          alert("Código de invitación incorrecto o curso no existe en Supabase.");
          if(preview) preview.innerHTML = "";
          return;
        }
        const course = buildCourseObjFromCursoDB(curso);
        const c = course.course || {};
        d.regionId = c.regionId;
        d.comunaId = c.comunaId;
        d.schoolId = c.schoolId;
        d.jornada = c.jornada;
        d.level = c.level;
        d.letter = c.letter;
        d.year = c.year;
        d.courseKey = course.courseKey;
        d.inviteCode = course.inviteCode;
        d.courseLocked = true;
        d.step = 3;
        saveDraft(d);
        if(preview) preview.innerHTML = courseSummaryHTML(course);
        render();
      }catch(e){
        alert("No se pudo validar el código en Supabase: " + (e && e.message ? e.message : String(e)));
      }
    });

    // Continuar no aplica
    btnNext && (btnNext.onclick = ()=> alert("Primero valida el código de invitación."));
  }

  // --- Step 1: Directiva (solo Presidente crea curso) ---
  if(step===1 && MODE==="directiva"){
    if(DIRECTIVA_ROLE!=="presidente"){
      btnNext && (btnNext.onclick = ()=> alert("El tesorero lo designa el Presidente desde el menú del curso."));
    }else{
      const r = $("onbRegion"), c = $("onbComuna"), s = $("onbSchool"), ref = $("onbReferralCode"), est = $("onbEstimatedStudents");
      r && (r.onchange = ()=>{ d.regionId=r.value; d.comunaId=""; d.schoolId=""; saveDraft(d); render(); });
      c && (c.onchange = ()=>{ d.comunaId=c.value; d.schoolId=""; saveDraft(d); render(); });
      s && (s.onchange = ()=>{ d.schoolId=s.value; saveDraft(d); });
      est && (est.onchange = ()=>{ d.estimatedStudents = Number(est.value || 0); saveDraft(d); });
      document.querySelectorAll('input[name="onbEstimatedStudentsRadio"]').forEach(r=>{
        r.onchange = ()=>{ d.estimatedStudents = Number(r.value || 0); saveDraft(d); render(); };
      });
      ref && (ref.oninput = ()=>{
        d.referralCode = normalizeReferralCode(ref.value);
        ref.value = d.referralCode;
        const agent = findRefAgent(d.referralCode);
        const st = $("onbReferralStatus");
        if(st){
          st.innerHTML = d.referralCode
            ? (agent ? `Código asociado a: <b>${escapeHtml(agent.name||agent.code)}</b>` : `Código ingresado pendiente de validación`)
            : `Si no tienes código, puedes continuar normalmente.`;
        }
        saveDraft(d);
      });
      d.regionId = ctx.regionId; d.comunaId = ctx.comunaId; d.schoolId = ctx.schoolId;
    }
  }

  // --- Step 2 wiring ---
  if(step===2){
    if(MODE==="directiva" && DIRECTIVA_ROLE==="presidente"){
      $("onbJornada") && ($("onbJornada").onchange = ()=>{ d.jornada=$("onbJornada").value; saveDraft(d); });
      $("onbYear") && ($("onbYear").oninput = ()=>{ d.year=$("onbYear").value; saveDraft(d); });
      $("onbLevel") && ($("onbLevel").onchange = ()=>{ d.level=$("onbLevel").value; saveDraft(d); });
      $("onbLetter") && ($("onbLetter").onchange = ()=>{ d.letter=$("onbLetter").value; saveDraft(d); });
    }
  }

  // --- Step 3 inputs (OTP + pass) ---
  if(step===3){
    $("onbName") && ($("onbName").oninput = ()=>{ d.name = $("onbName").value; saveDraft(d); });

    // Apoderado
    if(MODE==="apoderado"){
      $("onbAlumno") && ($("onbAlumno").oninput = ()=>{ d.alumno = $("onbAlumno").value; saveDraft(d); });

      const emailInp = $("onbEmail");
      const otpInp = $("aOtp");
      const sendBtn = $("btnSendOtpA");
      const verBtn = $("btnVerifyOtpA");
      // Si ya está verificado, bloquear correo y envío
      if(d.aOtpVerified){
        try{
          if(emailInp) emailInp.disabled = true;
          if(sendBtn) sendBtn.disabled = true;
        }catch(e){}
      }


      emailInp && (emailInp.oninput = ()=>{ d.email = emailInp.value; saveDraft(d); });
      otpInp && (otpInp.oninput = ()=>{ d.aOtp = otpInp.value; saveDraft(d); });

      sendBtn && (sendBtn.onclick = ()=>{
        const e = String(emailInp?.value||"").trim().toLowerCase();
        if(!validateEmail(e)){ alert("Correo inválido."); return; }
        d.email = e;
        d.aOtpCode = String(Math.floor(100000 + Math.random()*900000));
        d.aOtpSent = true;
        d.aOtpVerified = false;
        d.aOtpSentAt = Date.now();
        saveDraft(d);
        alert("Demo OTP: " + d.aOtpCode);
        render();
      });

      verBtn && (verBtn.onclick = ()=>{
        const code = String(otpInp?.value||"").trim();
        if(!d.aOtpSent){ alert("Primero envía el código."); return; }
        if(Date.now() - (d.aOtpSentAt||0) > 10*60*1000){ alert("Código expirado. Envía uno nuevo."); return; }
        if(code !== String(d.aOtpCode||"")){ alert("Código incorrecto."); return; }
        d.aOtpVerified = true;
        saveDraft(d);
        // Mostrar estado verificado en UI
        render();
      });

      $("onbPhone") && ($("onbPhone").oninput = ()=>{ d.phone = $("onbPhone").value; saveDraft(d); });
      $("onbPass") && ($("onbPass").oninput = ()=>{ d.pass = $("onbPass").value; saveDraft(d); });
      $("onbPass2") && ($("onbPass2").oninput = ()=>{ d.pass2 = $("onbPass2").value; saveDraft(d); });
    }

    // Directiva (Presidente)
    if(MODE==="directiva"){
      const chk = $("alsoAp");
      chk && (chk.onchange = ()=>{ d.alsoApoderado = !!chk.checked; saveDraft(d); render(); });

      const pEmail = $("pEmail");
      const pOtp = $("pOtp");
      const sendBtn = $("btnSendOtp");
      const verBtn = $("btnVerifyOtp");

      pEmail && (pEmail.oninput = ()=>{ d.pEmail = pEmail.value; saveDraft(d); });
      pOtp && (pOtp.oninput = ()=>{ d.pOtp = pOtp.value; saveDraft(d); });
      $("pPass") && ($("pPass").oninput = ()=>{ d.pPass = $("pPass").value; saveDraft(d); });
      $("pPass2") && ($("pPass2").oninput = ()=>{ d.pPass2 = $("pPass2").value; saveDraft(d); });

      // Si ya está verificado, bloquear correo y envío
      if(d.pOtpVerified){
        try{
          if(pEmail) pEmail.disabled = true;
          if(sendBtn) sendBtn.disabled = true;
        }catch(e){}
      }

sendBtn && (sendBtn.onclick = ()=>{
        const e = String(pEmail?.value||"").trim().toLowerCase();
        if(!validateEmail(e)){ alert("Correo inválido."); return; }
        d.pEmail = e;
        d.pOtpCode = String(Math.floor(100000 + Math.random()*900000));
        d.pOtpSent = true;
        d.pOtpVerified = false;
        d.pOtpSentAt = Date.now();
        saveDraft(d);
render();
      });

      verBtn && (verBtn.onclick = ()=>{
        const code = String(pOtp?.value||"").trim();
        if(!d.pOtpSent){ alert("Primero envía el código."); return; }
        if(Date.now() - (d.pOtpSentAt||0) > 10*60*1000){ alert("Código expirado. Envía uno nuevo."); return; }
        if(code !== String(d.pOtpCode||"")){ alert("Código incorrecto."); return; }
        d.pOtpVerified = true;
        saveDraft(d);
        // Mostrar estado verificado en UI
        render();
      });

      if(d.alsoApoderado){
        $("dAlumno") && ($("dAlumno").oninput = ()=>{ d.alumno = $("dAlumno").value; saveDraft(d); });
        $("dPhone") && ($("dPhone").oninput = ()=>{ d.dPhone = $("dPhone").value; saveDraft(d); });
      }
    }
  }

  // --- Step 4 wiring (apoderado radios) ---
  if(step===4 && MODE==="apoderado"){
    document.querySelectorAll("input[name=pay]").forEach(r=>{
      r.onchange = ()=>{ d.payChoice = r.value; saveDraft(d); };
    });
  }

  // --- Prev ---
  btnPrev && (btnPrev.onclick = ()=>{
    d.step = Math.max(1, Number(d.step||1)-1);
    saveDraft(d);
    render();
  });

  // --- Next / Finalize ---
  btnNext && (btnNext.onclick = async ()=>{
    if(__cursappOnboardingFinalizing) return;
    // Step 1 directiva presidente -> step2
    if(step===1 && MODE==="directiva" && DIRECTIVA_ROLE==="presidente"){
      if(!d.regionId || !d.comunaId || !d.schoolId){ alert("Selecciona región, comuna y colegio."); return; }
      if(!Number(d.estimatedStudents || 0)){ alert("Selecciona la cantidad estimada de alumnos/apoderados del curso."); return; }
      d.step = 2; saveDraft(d); render(); return;
    }

    // Step 2
    if(step===2){
      if(MODE==="apoderado"){ d.step = 3; saveDraft(d); render(); return; }

      if(MODE==="directiva" && DIRECTIVA_ROLE==="presidente"){
        d.jornada = $("onbJornada").value;
        d.year = String($("onbYear").value||"").trim();
        d.level = $("onbLevel").value;
        d.letter = $("onbLetter").value;

        if(!/^\d{4}$/.test(d.year)){ alert("Año inválido."); return; }
        d.step = 3; saveDraft(d); render(); return;
      }
    }

    // Step 3 validations -> step4
    if(step===3){
      d.name = String($("onbName")?.value || "").trim();
      if(!d.name){ alert("Completa el nombre."); return; }

      if(MODE==="directiva"){
        d.pEmail = String($("pEmail")?.value || "").trim().toLowerCase();
        if(!validateEmail(d.pEmail)){ alert("Correo inválido."); return; }
        if(!d.pOtpVerified){ alert("Debes validar el código (OTP) del correo."); return; }

        d.pPass = String($("pPass")?.value || "");
d.pPass2 = String($("pPass2")?.value || "");
        if(d.pPass.length < 6){ alert("La contraseña debe tener al menos 6 caracteres."); return; }
        if(d.pPass !== d.pPass2){ alert("Las contraseñas no coinciden."); return; }
if(d.alsoApoderado){
          d.alumno = String($("dAlumno")?.value || "").trim();
          d.dPhone = String($("dPhone")?.value || "").trim();
          if(!d.alumno){ alert("Completa alumno/a."); return; }
        }else{
          d.alumno = "";
        }

        d.step = 4; saveDraft(d); render(); return;
      }

      if(MODE==="apoderado"){
        d.alumno = String($("onbAlumno")?.value || "").trim();
        if(!d.alumno){ alert("Completa alumno/a."); return; }

        d.email = String($("onbEmail")?.value || "").trim().toLowerCase();
        if(!validateEmail(d.email)){ alert("Correo inválido."); return; }
        if(!d.aOtpVerified){ alert("Debes validar el código (OTP) del correo."); return; }

        d.phone = String($("onbPhone")?.value || "").trim();
        d.pass = String($("onbPass")?.value || "");
        d.pass2 = String($("onbPass2")?.value || "");
        if(d.pass.length < 6){ alert("Password mínimo 6 caracteres."); return; }
        if(d.pass !== d.pass2){ alert("Password no coincide."); return; }

        d.step = 4; saveDraft(d); render(); return;
      }
    }

    // Step 4 finalize
    if(step===4){
      const region = REGIONS.find(r=>r.id===d.regionId);
      const comuna = COMUNAS.find(c=>c.id===d.comunaId);
      const school = SCHOOLS.find(s=>s.id===d.schoolId);

      const courseKey = makeCourseKey(d.schoolId, d.level, d.letter, d.jornada, d.year);

      if(MODE==="directiva" && DIRECTIVA_ROLE==="presidente"){
        // Reutilizar curso/código si ya existe el mismo courseKey (evita cambiar inviteCode)
        const existingCourse = getCourseV1();
        const inviteCode = (existingCourse && String(existingCourse.courseKey||"")===String(courseKey) && existingCourse.inviteCode)
          ? existingCourse.inviteCode
          : generateCode();

        const courseObj = {
          courseKey,
          inviteCode,
          directiva: { presidente: { name: d.name }, tesorero: { name: "" } },
          course: {
            regionId: d.regionId, regionName: region?region.name:"",
            comunaId: d.comunaId, comunaName: comuna?comuna.name:"",
            schoolId: d.schoolId, schoolName: school?school.name:"",
            jornada: d.jornada,
            level: d.level,
            letter: d.letter,
            year: d.year,
            estimatedStudents: Number(d.estimatedStudents || 0),
            estimatedStudentsRange: estimatedStudentsRangeLabel(d.estimatedStudents),
            referralCode: normalizeReferralCode(d.referralCode || ""),
            referralAgentId: (findRefAgent(d.referralCode || "") || {}).id || "",
            referralAgentName: (findRefAgent(d.referralCode || "") || {}).name || ""
          },
          commercialGoal: {
            estimatedStudents: Number(d.estimatedStudents || 0),
            estimatedStudentsRange: estimatedStudentsRangeLabel(d.estimatedStudents),
            commissionThresholdPct: 60,
            commissionExpiresAt: addDaysISO(90),
            incorporationFeePerParent: 990,
            commissionTiers: [
              { key:"basica", thresholdPct:60, amountPerActivatedParent:350 },
              { key:"mejorada", thresholdPct:80, amountPerActivatedParent:450 },
              { key:"premium", thresholdPct:100, amountPerActivatedParent:550 }
            ],
            basis: "directiva_registrada_mas_apoderados_activados"
          },
          referral: {
            code: normalizeReferralCode(d.referralCode || ""),
            agentId: (findRefAgent(d.referralCode || "") || {}).id || "",
            agentName: (findRefAgent(d.referralCode || "") || {}).name || "",
            status: normalizeReferralCode(d.referralCode || "") ? "pendiente_validacion" : ""
          },
          createdAt: (existingCourse && String(existingCourse.courseKey||"")===String(courseKey) && existingCourse.createdAt) ? existingCourse.createdAt : nowISO(),
          createdByRole: "presidente"
        };

        const finalReferralCode = normalizeReferralCode(d.referralCode || "");
        if(finalReferralCode){
          const existingReferral = activeReferralForCourse(courseKey);
          if(existingReferral && normalizeReferralCode(existingReferral.referralCode) !== finalReferralCode){
            showModal({
              title: "Curso ya asociado",
              bodyHtml: `Este curso ya tiene un código de recomendación asociado.<br><br><span class="muted">Por seguridad comercial no se puede cambiar desde el onboarding. Si corresponde, debe revisarlo el administrador Cursapp.</span>`,
              actions: [
                { label:"Volver", variant:"ghost", onClick:(close)=>close() }
              ]
            });
            return;
          }
        }

        __cursappOnboardingFinalizing = true;
        try{ if(btnNext) btnNext.disabled = true; }catch(e){}

        try{
          const pEmailNorm = String(d.pEmail||"").trim().toLowerCase();
          const db = await registerPresidentSupabaseOnly(courseObj, {
            email: pEmailNorm,
            name: d.name,
            phone: d.dPhone || "",
            alsoApoderado: !!d.alsoApoderado,
            alumno: d.alumno || ""
          });
          // Sesión mínima; los datos operativos ya están en Supabase.
          setMinimalSession({
            userId: db.usuario.id,
            email: pEmailNorm,
            role: "presidente",
            roles: d.alsoApoderado ? ["presidente","apoderado"] : ["presidente"],
            courseKey
          });
          clearDraft();
          alert("Curso creado ✅\n\nUsuario y miembros creados directamente en Supabase.");
          window.location.href = "/presidente.html";
          return;
        }catch(e){
          __cursappOnboardingFinalizing = false;
          try{ if(btnNext) btnNext.disabled = false; }catch(_e){}
          alert("Supabase ERROR ❌\n" + (e && e.message ? e.message : String(e)));
          return;
        }
      }

      if(MODE==="apoderado"){
        const payChoice = d.payChoice || "now";
        const activationStatus = (payChoice === "later") ? "unpaid" : "paid";
        __cursappOnboardingFinalizing = true;
        try{ if(btnNext) btnNext.disabled = true; }catch(e){}

        try{
          const courseObj = {
            courseKey: d.courseKey || courseKey,
            inviteCode: d.inviteCode || "",
            course: {
              regionId: d.regionId, regionName: region?region.name:"",
              comunaId: d.comunaId, comunaName: comuna?comuna.name:"",
              schoolId: d.schoolId, schoolName: school?school.name:(d.schoolName||"Colegio"),
              jornada: d.jornada,
              level: d.level,
              letter: d.letter,
              year: d.year
            }
          };
          await registerApoderadoSupabaseOnly(d.courseKey || courseKey, courseObj, {
            email: String(d.email||"").trim().toLowerCase(),
            name: d.name,
            phone: d.phone || "",
            alumno: d.alumno,
            activationStatus
          });
          clearDraft();
          alert("Solicitud enviada ✅\n\nLa directiva debe aprobar tu registro para poder ingresar.");
          window.location.href = "/index.html?pending=1";
          return;
        }catch(e){
          __cursappOnboardingFinalizing = false;
          try{ if(btnNext) btnNext.disabled = false; }catch(_e){}
          alert("Supabase ERROR ❌\n" + (e && e.message ? e.message : String(e)));
          return;
        }
      }

      alert("Acción no válida.");
    }
  });
}

  // Init
  const d = loadDraft();
  if(!d.step){ d.step = 1; saveDraft(d); }
  render();
})();

/* Supabase Bridge retirado de onboarding.js.
   La sincronización híbrida vive únicamente en /assets/core.js. */
