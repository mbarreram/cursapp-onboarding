/* =========================================================
   Cursapp · Onboarding (Wizard) — Opción 1
   - Presidente: crea el curso (genera inviteCode + treasurerCode)
   - Tesorero: NO crea curso, se une con treasurerCode
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

  const DEBUG = localStorage.getItem("cursapp_onb_debug") === "1";

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
    { id: "r1", name: "Región Metropolitana" },
    { id: "r2", name: "Valparaíso" },
  ];
  const COMUNAS = [
    { id: "c1", regionId: "r1", name: "Santiago" },
    { id: "c2", regionId: "r1", name: "Providencia" },
    { id: "c3", regionId: "r2", name: "Valparaíso" },
    { id: "c4", regionId: "r2", name: "Viña del Mar" },
  ];
  const SCHOOLS = [
    { id: "sch1", comunaId: "c1", name: "Colegio X (Demo)" },
    { id: "sch2", comunaId: "c1", name: "Liceo Central (Demo)" },
    { id: "sch3", comunaId: "c2", name: "Colegio Providencia (Demo)" },
    { id: "sch4", comunaId: "c3", name: "Colegio Puerto (Demo)" },
    { id: "sch5", comunaId: "c4", name: "Colegio Viña (Demo)" },
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

    // defaults (solo presidente crea curso)
    const regionId = d.regionId || REGIONS[0].id;
    const comunas = COMUNAS.filter(c=>c.regionId===regionId);
    const comunaId = d.comunaId || (comunas[0]?.id||"");
    const schools = SCHOOLS.filter(s=>s.comunaId===comunaId);
    const schoolId = d.schoolId || (schools[0]?.id||"");

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
    const treasurerCodeInput = (d.treasurerCodeInput || "").toUpperCase(); // tesorero join
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


// --- premium copy ---
let stepTitle = "";
let stepDesc = "";
let stepNote = "";
if (MODE === "directiva") {
  const role = (DIRECTIVA_ROLE === "tesorero") ? "Tesorería" : "Directiva";
  const isTesorero = (DIRECTIVA_ROLE === "tesorero");
  const roleLabel = isTesorero ? "Tesorero" : "Presidente";
  if (step === 1) { stepTitle = `Configura tu curso`; stepDesc = `Selecciona región, comuna y colegio. Esto define el contexto del curso.`; }
  if (step === 2) { stepTitle = `Datos del curso`; stepDesc = `Año, nivel y letra. Puedes cambiarlo después si es necesario.`; }
  if (step === 3) { stepTitle = `Tu directiva`; stepDesc = `Identifica al ${roleLabel} para generar los códigos de unión.`; stepNote = `Al finalizar se crearán un código para apoderados y otro para tesorería.`; }
  if (step === 4) { stepTitle = `Listo para crear`; stepDesc = `Revisa y crea el curso. Luego comparte los códigos con tu comunidad.`; }
} else {
  if (step === 1) { stepTitle = `Únete a tu curso`; stepDesc = `Ingresa el código del curso (te lo comparte la directiva).`; }
  if (step === 2) { stepTitle = `Datos del estudiante`; stepDesc = `Selecciona el alumno/a y confirma tu relación como apoderado.`; }
  if (step === 3) { stepTitle = `Confirmación`; stepDesc = `Acepta términos y finaliza tu registro.`; }
}

    
    root.innerHTML = `
      <div class="onbPremium">
        <div class="onbHero">
          <div class="onbHeroLeft">
            <div class="onbBadge">${MODE === "directiva" ? "🎓" : "👪"} Onboarding · ${MODE==="directiva" ? (DIRECTIVA_ROLE==="tesorero" ? "Tesorero" : "Presidente") : "Apoderado"}</div>
            <h1>${stepTitle}</h1>
            <p class="onbLead">${stepDesc}</p>
            ${stepNote ? `<div class="softNote">${stepNote}</div>` : ``}
          </div>
          <div class="onbHeroRight">
            <div class="stepper" aria-label="Progreso">
              ${Array.from({length: stepsTotal}, (_, i) => {
                const n = i + 1;
                const cls = n < step ? "stepDot done" : (n === step ? "stepDot active" : "stepDot");
                const label = n < step ? "✓" : String(n);
                return `<div class="${cls}" title="Paso ${n}">${label}</div>${n < stepsTotal ? `<div class="stepLine"></div>` : ``}`;
              }).join("")}
            </div>
            <div class="chips" style="justify-content:flex-end">
              <span class="chip">Paso <b>${step}</b> de <b>${stepsTotal}</b></span>
              ${MODE === "directiva" ? `<span class="chip">Se generan <b>2 códigos</b></span>` : `<span class="chip">Unión con <b>código</b></span>`}
            </div>
            ${debugLine ? `<div style="margin-top:10px">${debugLine}</div>` : ``}
          </div>
        </div>

        ${banner}

        <div class="onbCard onbMain">
          ${content}
        </div>

        <div class="onbBottomBar">
          <div class="onbBottomInner">
            <button id="backBtn" class="btn ghost" ${step <= 1 ? "disabled" : ""}>← Atrás</button>
            <button id="clearBtn" class="btn ghost">Limpiar</button>
            <div class="right"></div>
            <button id="nextBtn" class="btn ${isLast ? "warn" : "primary"}">${isLast ? (MODE === "directiva" ? "Crear curso" : "Unirme") : "Continuar"}</button>
          </div>
        </div>
      </div>
    `;

    wire(step, d, { regionId, comunaId, schoolId });
    saveDraft(d);
  }

  function wire(step, d, ctx){
    const btnPrev = $("btnPrev");
    const btnNext = $("btnNext");

    // Apoderado: validar inviteCode y saltar a step 3
    if(step===1 && MODE==="apoderado"){
      const inv = $("onbInviteCode");
      const btn = $("btnValidateCode");
      const preview = $("coursePreview");

      inv && (inv.oninput = ()=>{ d.inviteCode = String(inv.value||"").trim().toUpperCase(); saveDraft(d); });

      btn && (btn.onclick = ()=>{
        const code = String(d.inviteCode||"").trim().toUpperCase();
        if(!code){ alert("Ingresa el código de invitación."); return; }

        const course = getCourseV1();
        if(!course || !course.inviteCode){ alert("Aún no existe un curso creado por el Presidente."); return; }

        if(code !== String(course.inviteCode||"").toUpperCase()){
          alert("Código de invitación incorrecto.");
          if(preview) preview.innerHTML = "";
          return;
        }

        const c = course.course || {};
        d.regionId = c.regionId;
        d.comunaId = c.comunaId;
        d.schoolId = c.schoolId;
        d.jornada = c.jornada;
        d.level = c.level;
        d.letter = c.letter;
        d.year = c.year;

        d.courseLocked = true;
        d.step = 3;
        saveDraft(d);

        if(preview) preview.innerHTML = courseSummaryHTML(course);
        render();
      });
    }

    // Directiva tesorero: validar treasurerCode y entrar
    if(step===1 && MODE==="directiva" && DIRECTIVA_ROLE==="tesorero"){
      const inp = $("onbTreasurerCode");
      const btn = $("btnValidateTreasurer");
      const prev = $("treasurerPreview");

      inp && (inp.oninput = ()=>{ d.treasurerCodeInput = String(inp.value||"").trim().toUpperCase(); saveDraft(d); });

      btn && (btn.onclick = ()=>{
        const course = getCourseV1();
        if(!course || !course.treasurerCode){
          alert("Aún no existe un curso creado por el Presidente.");
          return;
        }

        const code = String(d.treasurerCodeInput||"").trim().toUpperCase();
        if(!code){ alert("Ingresa el código de tesorero."); return; }

        if(code !== String(course.treasurerCode||"").toUpperCase()){
          alert("Código de tesorero incorrecto.");
          if(prev) prev.innerHTML = "";
          return;
        }

        setActiveCourseKey(course.courseKey);

        localStorage.setItem("cursapp_demo_user", JSON.stringify({
          name: "Tesorero (Demo)",
          role: "tesorero",
          colegio: course.course?.schoolName || "Colegio",
          curso: `${course.course?.level||""}${course.course?.letter||""} ${course.course?.year||""}`,
          jornada: course.course?.jornada || "",
          alumno: "Nombre alumno(a)"
        }));

        // ✅ sesión única (producción-ready)
        try{
          if(window.CURSAPP && typeof window.CURSAPP.setSession==="function"){
            window.CURSAPP.setSession({ userId: "tesorero", role: "tesorero", courseKey: course.courseKey });
          }else{
            localStorage.setItem("cursapp_session_v1", JSON.stringify({ userId: "tesorero", role: "tesorero", courseKey: course.courseKey }));
          }
        }catch(e){}

        if(prev) prev.innerHTML = courseSummaryHTML(course);
        clearDraft();
        window.location.href = "/tesorero.html";
      });

      // El tesorero no usa Continuar
      const next = $("btnNext");
      if(next) next.onclick = ()=> alert("Usa “Validar y entrar”.");
    }

    // Directiva presidente: selección curso (paso 1)
    if(step===1 && MODE==="directiva" && DIRECTIVA_ROLE==="presidente"){
      const r = $("onbRegion"), c = $("onbComuna"), s = $("onbSchool");
      r.onchange = ()=>{ d.regionId=r.value; d.comunaId=""; d.schoolId=""; saveDraft(d); render(); };
      c.onchange = ()=>{ d.comunaId=c.value; d.schoolId=""; saveDraft(d); render(); };
      s.onchange = ()=>{ d.schoolId=s.value; saveDraft(d); };
      d.regionId = ctx.regionId; d.comunaId = ctx.comunaId; d.schoolId = ctx.schoolId;
    }

    // Paso 2 solo presidente
    if(step===2 && MODE==="directiva" && DIRECTIVA_ROLE==="presidente"){
      $("onbJornada").onchange = ()=>{ d.jornada=$("onbJornada").value; saveDraft(d); };
      $("onbYear").oninput = ()=>{ d.year=$("onbYear").value; saveDraft(d); };
      $("onbLevel").onchange = ()=>{ d.level=$("onbLevel").value; saveDraft(d); };
      $("onbLetter").onchange = ()=>{ d.letter=$("onbLetter").value; saveDraft(d); };
    }

    // Paso 3 inputs
    if(step===3){
      $("onbName") && (($("onbName").oninput = ()=>{ d.name = $("onbName").value; saveDraft(d); }));
      $("onbAlumno") && (($("onbAlumno").oninput = ()=>{ d.alumno = $("onbAlumno").value; saveDraft(d); }));

      if(MODE==="directiva"){
        const chk = $("alsoAp");
        chk && (chk.onchange = ()=>{ d.alsoApoderado = !!chk.checked; saveDraft(d); render(); });

        if(d.alsoApoderado){
          $("dAlumno") && (($("dAlumno").oninput = ()=>{ d.alumno = $("dAlumno").value; saveDraft(d); }));
          $("dEmail") && (($("dEmail").oninput = ()=>{ d.dEmail = $("dEmail").value; saveDraft(d); }));
          $("dEmail2") && (($("dEmail2").oninput = ()=>{ d.dEmail2 = $("dEmail2").value; saveDraft(d); }));
          $("dPhone") && (($("dPhone").oninput = ()=>{ d.dPhone = $("dPhone").value; saveDraft(d); }));
          $("dPass") && (($("dPass").oninput = ()=>{ d.dPass = $("dPass").value; saveDraft(d); }));
          $("dPass2") && (($("dPass2").oninput = ()=>{ d.dPass2 = $("dPass2").value; saveDraft(d); }));
        }
      }

      if(MODE==="apoderado"){
        $("onbEmail") && (($("onbEmail").oninput = ()=>{ d.email = $("onbEmail").value; saveDraft(d); }));
        $("onbEmail2") && (($("onbEmail2").oninput = ()=>{ d.email2 = $("onbEmail2").value; saveDraft(d); }));
        $("onbPhone") && (($("onbPhone").oninput = ()=>{ d.phone = $("onbPhone").value; saveDraft(d); }));
        $("onbPass") && (($("onbPass").oninput = ()=>{ d.pass = $("onbPass").value; saveDraft(d); }));
        $("onbPass2") && (($("onbPass2").oninput = ()=>{ d.pass2 = $("onbPass2").value; saveDraft(d); }));
      }
    }

    // Paso 4 apoderado radio
    if(step===4 && MODE==="apoderado"){
      document.querySelectorAll("input[name=pay]").forEach(r=>{
        r.onchange = ()=>{ d.payChoice = r.value; saveDraft(d); };
      });
    }

    // Prev
    btnPrev && (btnPrev.onclick = ()=>{
      d.step = Math.max(1, Number(d.step||1)-1);
      saveDraft(d);
      render();
    });

    // Next
    btnNext && (btnNext.onclick = ()=>{
      // apoderado step1 no usa continuar
      if(step===1 && MODE==="apoderado"){ alert("Primero valida el código de invitación."); return; }

      // presidente step1 -> step2
      if(step===1 && MODE==="directiva" && DIRECTIVA_ROLE==="presidente"){
        if(!d.regionId || !d.comunaId || !d.schoolId){ alert("Selecciona región, comuna y colegio."); return; }
        d.step = 2; saveDraft(d); render(); return;
      }

      // step2
      if(step===2){
        if(MODE==="apoderado"){ d.step = 3; saveDraft(d); render(); return; }

        if(DIRECTIVA_ROLE==="presidente"){
          d.jornada = $("onbJornada").value;
          d.year = String($("onbYear").value||"").trim();
          d.level = $("onbLevel").value;
          d.letter = $("onbLetter").value;

          if(!/^\d{4}$/.test(d.year)){ alert("Año inválido."); return; }
        }
        d.step = 3; saveDraft(d); render(); return;
      }

      // step3 validations
      if(step===3){
        d.name = String($("onbName")?.value || "").trim();
        d.alumno = String($("onbAlumno")?.value || "").trim();
        if(!d.name){ alert("Completa el nombre."); return; }

        if(MODE==="directiva"){
          if(d.alsoApoderado){
            const dAl = String($("dAlumno")?.value || "").trim();
            const e1 = String($("dEmail")?.value || "").trim().toLowerCase();
            const e2 = String($("dEmail2")?.value || "").trim().toLowerCase();
            const p1 = String($("dPass")?.value || "");
            const p2 = String($("dPass2")?.value || "");

            d.dPhone = String($("dPhone")?.value || "").trim();

            if(!dAl){ alert("Completa alumno/a."); return; }
            if(!validateEmail(e1) || e1!==e2){ alert("Correo inválido o no coincide."); return; }
            if(p1.length < 6){ alert("Password mínimo 6 caracteres."); return; }
            if(p1 !== p2){ alert("Password no coincide."); return; }

            d.alumno = dAl;
            d.dEmail = e1;
            d.dEmail2 = e2;
            d.dPass = p1;
            d.dPass2 = p2;
          }
          d.step = 4; saveDraft(d); render(); return;
        }

        // apoderado
        d.email = String($("onbEmail")?.value || "").trim().toLowerCase();
        d.email2 = String($("onbEmail2")?.value || "").trim().toLowerCase();
        d.phone = String($("onbPhone")?.value || "").trim();
        d.pass = String($("onbPass")?.value || "");
        d.pass2 = String($("onbPass2")?.value || "");

        if(!d.alumno){ alert("Completa alumno/a."); return; }
        if(!validateEmail(d.email) || d.email!==d.email2){ alert("Correo inválido o no coincide."); return; }
        if(d.pass.length < 6){ alert("Password mínimo 6 caracteres."); return; }
        if(d.pass !== d.pass2){ alert("Password no coincide."); return; }

        d.step = 4; saveDraft(d); render(); return;
      }

      // step4 finalize
      if(step===4){
        const region = REGIONS.find(r=>r.id===d.regionId);
        const comuna = COMUNAS.find(c=>c.id===d.comunaId);
        const school = SCHOOLS.find(s=>s.id===d.schoolId);

        const courseKey = makeCourseKey(d.schoolId, d.level, d.letter, d.jornada, d.year);

        // directiva: solo presidente finaliza creación
        if(MODE==="directiva" && DIRECTIVA_ROLE==="presidente"){
          const inviteCode = generateCode();
          const treasurerCode = generateCode();

          const courseObj = {
            courseKey,
            inviteCode,
            treasurerCode,
            directiva: { presidente: { name: d.name }, tesorero: { name: "" } },
            course: {
              regionId: d.regionId, regionName: region?region.name:"",
              comunaId: d.comunaId, comunaName: comuna?comuna.name:"",
              schoolId: d.schoolId, schoolName: school?school.name:"",
              jornada: d.jornada,
              level: d.level,
              letter: d.letter,
              year: d.year
            },
            createdAt: nowISO(),
            createdByRole: "presidente"
          };

          localStorage.setItem(KEY_COURSE_V1, JSON.stringify(courseObj));
          setActiveCourseKey(courseKey);

          // Presidente también apoderado (auto-approved) asociado al rol presidente
          if(d.alsoApoderado){
            // upsert user
            let users = loadUsers();
            const existing = users.find(u=>u.email===d.dEmail);
            let userId = existing ? existing.userId : ("u_"+uid("usr"));
            const passHash = hashDemo(d.dPass);

            if(existing){
              existing.passwordHashDemo = passHash;
              existing.updatedAt = nowISO();
            }else{
              users.unshift({ userId, email: d.dEmail, passwordHashDemo: passHash, createdAt: nowISO() });
            }
            saveUsers(users);

            // upsert profile apoderado
            let profiles = loadProfiles();
            profiles = profiles.filter(p=>!(p.userId===userId && p.courseKey===courseKey && p.role==="apoderado"));
            profiles.unshift({
              profileId: "pr_"+uid("p"),
              userId,
              role: "apoderado",
              courseKey,
              course: courseObj.course,
              apoderado: { name: d.name, alumno: d.alumno, phone: d.dPhone || "" },
              activation: { required:true, amount:7990, status:"paid", createdAt: nowISO(), paidAt: nowISO() },
              createdAt: nowISO()
            });
            saveProfiles(profiles);

            // enrollment approved (si existe approveEnrollment)
            if(typeof createEnrollment === "function"){
              const res = createEnrollment({
                apoderadoName: d.name, alumno: d.alumno, email: d.dEmail, phone: d.dPhone || "",
                activationAmount: 7990, activationStatus: "paid"
              });
              if(res && res.ok && typeof approveEnrollment === "function"){
                approveEnrollment(res.enrollment.enrollmentId, "presidente");
              }
            }

            // guardar perfil apoderado asociado al rol presidente
            const map = loadJSON(KEY_DIRECTIVA_AP_BY_ROLE, {});
            map["presidente"] = { email: d.dEmail, apoderadoName: d.name, alumno: d.alumno, courseKey };
            saveJSON(KEY_DIRECTIVA_AP_BY_ROLE, map);
          }

          // sesión presidente
          localStorage.setItem("cursapp_demo_user", JSON.stringify({
            name: (d.name || "Presidente") + " (Demo)",
            role: "presidente",
            colegio: courseObj.course.schoolName,
            curso: `${courseObj.course.level}${courseObj.course.letter} ${courseObj.course.year}`,
            jornada: courseObj.course.jornada,
            alumno: "Nombre alumno(a)"
          }));

          // ✅ sesión única (producción-ready)
          try{
            if(window.CURSAPP && typeof window.CURSAPP.setSession==="function"){
              window.CURSAPP.setSession({ userId: "presidente", role: "presidente", courseKey });
            }else{
              localStorage.setItem("cursapp_session_v1", JSON.stringify({ userId: "presidente", role: "presidente", courseKey }));
            }
          }catch(e){}

          clearDraft();
          alert(
            "Curso creado ✅\n\n" +
            "Código apoderados: " + inviteCode + "\n" +
            "Código tesorero: " + treasurerCode + "\n\n" +
            "Comparte el código tesorero solo con el tesorero."
          );
          window.location.href = "/presidente.html";
          return;
        }

        // apoderado finalize (pending)
        if(MODE==="apoderado"){
          d.payChoice = d.payChoice || "now";

          let users = loadUsers();
          const existing = users.find(u=>u.email===d.email);
          let userId = existing ? existing.userId : ("u_"+uid("usr"));
          const passHash = hashDemo(d.pass);

          if(existing){
            existing.passwordHashDemo = passHash;
            existing.updatedAt = nowISO();
          }else{
            users.unshift({ userId, email: d.email, passwordHashDemo: passHash, createdAt: nowISO() });
          }
          saveUsers(users);

          let profiles = loadProfiles();
          const activation = {
            required:true, amount:7990,
            status: (d.payChoice==="later") ? "pending" : "paid",
            createdAt: nowISO(),
            paidAt: (d.payChoice==="later") ? null : nowISO()
          };

          profiles = profiles.filter(p=>!(p.userId===userId && p.courseKey===courseKey));
          profiles.unshift({
            profileId: "pr_"+uid("p"),
            userId,
            role: "apoderado",
            courseKey,
            course: { regionId: d.regionId, regionName: region?region.name:"", comunaId: d.comunaId, comunaName: comuna?comuna.name:"",
                      schoolId: d.schoolId, schoolName: school?school.name:"", jornada: d.jornada, level: d.level, letter: d.letter, year: d.year },
            apoderado: { name: d.name, alumno: d.alumno, phone: d.phone },
            activation,
            createdAt: nowISO()
          });
          saveProfiles(profiles);

          setActiveCourseKey(courseKey);

          if(typeof createEnrollment !== "function"){
            alert("Falta enrollments.js.\n\nCarga /assets/enrollments.js antes de onboarding.js.");
            return;
          }

          const res = createEnrollment({
            apoderadoName: d.name, alumno: d.alumno, email: d.email, phone: d.phone,
            activationAmount: 7990, activationStatus: activation.status
          });

          if(!res || !res.ok){
            alert((res && res.error) ? res.error : "No se pudo enviar la solicitud.");
            return;
          }

          clearDraft();
          alert("Solicitud enviada ✅\n\nLa directiva debe aprobar tu registro para poder ingresar.");
          window.location.href = "/index.html?pending=1";
          return;
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
