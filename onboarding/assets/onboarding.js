/* =========================================================
   Cursapp · Onboarding (Wizard) — 2 modos + Código invitación (con validar)
   - mode=directiva&role=presidente|tesorero => crea curso + inviteCode + login directiva
   - mode=apoderado (default) => valida inviteCode con botón, muestra resumen y salta a paso 3
     luego crea user/profile y enrollment pending
   ========================================================= */

// UID simple (demo, estable)
function uid(prefix = "id") {
  return (
    prefix +
    "_" +
    Date.now().toString(36) +
    "_" +
    Math.random().toString(36).slice(2, 8)
  );
}

(function(){
  const KEY_ONB_DRAFT = "cursapp_onb_draft_v1";
  const KEY_USERS = "cursapp_users_v1";
  const KEY_PROFILES = "cursapp_profiles_v1";
  const KEY_ACTIVE_COURSE = "cursapp_active_course_v1";
  const KEY_COURSE_V1 = "cursapp_course_v1";

  const DEBUG = localStorage.getItem("cursapp_onb_debug")==="1";

  const QS = new URLSearchParams(location.search);
  const MODE = (QS.get("mode") || "apoderado").toLowerCase(); // "directiva" | "apoderado"
  const DIRECTIVA_ROLE = (QS.get("role") || "presidente").toLowerCase(); // presidente|tesorero

  // Demo data
  const REGIONS = [
    { id:"r1", name:"Región Metropolitana" },
    { id:"r2", name:"Valparaíso" }
  ];
  const COMUNAS = [
    { id:"c1", regionId:"r1", name:"Santiago" },
    { id:"c2", regionId:"r1", name:"Providencia" },
    { id:"c3", regionId:"r2", name:"Valparaíso" },
    { id:"c4", regionId:"r2", name:"Viña del Mar" }
  ];
  const SCHOOLS = [
    { id:"sch1", comunaId:"c1", name:"Colegio X (Demo)" },
    { id:"sch2", comunaId:"c1", name:"Liceo Central (Demo)" },
    { id:"sch3", comunaId:"c2", name:"Colegio Providencia (Demo)" },
    { id:"sch4", comunaId:"c3", name:"Colegio Puerto (Demo)" },
    { id:"sch5", comunaId:"c4", name:"Colegio Viña (Demo)" }
  ];
  const LEVELS = ["1°","2°","3°","4°","5°","6°","7°","8°","I°","II°","III°","IV°"];
  const LETTERS = ["A","B","C","D","E","F"];
  const JORNADAS = ["Mañana","Tarde"];

  function $(id){ return document.getElementById(id); }
  function nowISO(){ return new Date().toISOString(); }
  function nowYear(){ return new Date().getFullYear(); }

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
  function saveJSON(key, val){
    localStorage.setItem(key, JSON.stringify(val));
  }

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

  function generateInviteCode(){
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for(let i=0;i<6;i++) code += chars[Math.floor(Math.random()*chars.length)];
    return code;
  }

  function getCourseV1(){
    return loadJSON(KEY_COURSE_V1, null);
  }

  function courseSummaryHTML(courseObj){
    const c = courseObj?.course || {};
    return `
      <div class="card" style="padding:12px;border:1px solid rgba(91,92,226,.22);background:rgba(91,92,226,.06);">
        <div style="font-weight:950;">Curso encontrado ✅</div>
        <div class="muted" style="margin-top:6px;font-weight:800;">
          ${c.schoolName} · ${c.level}${c.letter} ${c.year} · ${c.jornada}
        </div>
        <div class="muted" style="margin-top:6px;">
          Si esto no corresponde, pide el código correcto a la directiva.
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

    // Si apoderado ya validó código, forzamos step 3
    if(MODE==="apoderado" && d.courseLocked && Number(d.step) < 3){
      d.step = 3;
      saveDraft(d);
    }

    const step = Number(d.step||1);
    const stepsTotal = 4;
    const progressPct = Math.round((step/stepsTotal)*100);

    // defaults cascade (solo directiva o fallback)
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
    const email = d.email || "";
    const email2 = d.email2 || "";
    const phone = d.phone || "";
    const pass = d.pass || "";
    const pass2 = d.pass2 || "";
    const inviteCode = (d.inviteCode || "").toUpperCase();
    const payChoice = d.payChoice || "now";

    const debugLine = DEBUG
      ? `<div class="muted" style="margin-top:8px;font-size:12px;">DEBUG · mode=${MODE} role=${DIRECTIVA_ROLE} step=${step} locked=${d.courseLocked?"1":"0"}</div>`
      : "";

    function option(list, valueKey, labelKey, selected){
      return list.map(x=>`<option value="${x[valueKey]}" ${x[valueKey]===selected?"selected":""}>${x[labelKey]}</option>`).join("");
    }
    function optionVals(list, selected){
      return list.map(x=>`<option value="${x}" ${x===selected?"selected":""}>${x}</option>`).join("");
    }

    const courseObj = getCourseV1();
    const banner = (MODE==="apoderado" && d.courseLocked && courseObj) ? courseBanner(courseObj) : "";

    root.innerHTML = `
      <div class="card" style="margin-top:12px;">
        <div style="font-weight:950;font-size:18px;">Onboarding · ${MODE==="directiva" ? "Directiva" : "Apoderado"}</div>
        <div class="muted" style="margin-top:6px;">Paso ${step} de ${stepsTotal}</div>

        <div style="margin-top:8px;height:10px;background:rgba(229,231,235,.9);border-radius:999px;overflow:hidden;">
          <div style="height:100%;width:${progressPct}%;background:rgba(91,92,226,.85)"></div>
        </div>

        ${debugLine}
      </div>

      ${banner}

      <div class="card" style="margin-top:12px;">
        ${step===1 ? `
          ${MODE==="apoderado" ? `
            <div>
              <label style="font-weight:900;">Código de invitación</label>
              <input id="onbInviteCode" placeholder="Ej: ABC123" value="${escapeHtml(inviteCode)}" />

              <button class="btn primary" id="btnValidateCode" type="button" style="width:100%;margin-top:10px;">
                Validar código
              </button>

              <div class="muted" style="margin-top:8px;">
                Pídeselo a la directiva del curso. Esto evita registros en cursos equivocados.
              </div>

              <div id="coursePreview" style="margin-top:12px;"></div>
            </div>
          ` : `
            <div style="border:1px solid rgba(229,231,235,.75);border-radius:16px;padding:12px;background:rgba(248,250,252,1);">
              <div style="font-weight:950;">Crear curso como ${DIRECTIVA_ROLE === "tesorero" ? "Tesorero" : "Presidente"}</div>
              <div class="muted" style="margin-top:6px;">Al finalizar se generará un código para invitar apoderados.</div>
            </div>

            <div style="margin-top:12px;">
              <label style="font-weight:900;">Región</label>
              <select id="onbRegion">${option(REGIONS,"id","name",regionId)}</select>
            </div>
            <div style="margin-top:12px;">
              <label style="font-weight:900;">Comuna</label>
              <select id="onbComuna">${option(comunas,"id","name",comunaId)}</select>
            </div>
            <div style="margin-top:12px;">
              <label style="font-weight:900;">Colegio</label>
              <select id="onbSchool">${option(schools,"id","name",schoolId)}</select>
            </div>
          `}
        `:""}

        ${step===2 ? `
          ${MODE==="directiva" ? `
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
            <div class="muted" style="font-weight:900;">
              Paso no usado (validación por código). Volviendo…
            </div>
          `}
        `:""}

        ${step===3 ? `
          <div style="margin-top:0;">
            <label style="font-weight:900;">Nombre ${MODE==="directiva" ? "directiva" : "apoderado"}</label>
            <input id="onbName" placeholder="Nombre y apellido" value="${escapeHtml(name)}" />
          </div>

          <div style="margin-top:12px;">
            <label style="font-weight:900;">Alumno/a ${MODE==="directiva" ? "(opcional)" : ""}</label>
            <input id="onbAlumno" placeholder="Nombre alumno/a" value="${escapeHtml(alumno)}" />
          </div>

          ${MODE==="apoderado" ? `
            <div style="margin-top:12px;">
              <label style="font-weight:900;">Correo (obligatorio)</label>
              <input id="onbEmail" placeholder="correo@dominio.com" value="${escapeHtml(email)}" />
            </div>

            <div style="margin-top:12px;">
              <label style="font-weight:900;">Confirmar correo</label>
              <input id="onbEmail2" placeholder="correo@dominio.com" value="${escapeHtml(email2)}" />
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
            <div style="border:1px solid rgba(229,231,235,.75);border-radius:16px;padding:12px;background:rgba(248,250,252,1);">
              <div style="font-weight:950;">Activación por curso</div>
              <div class="muted" style="margin-top:6px;">
                Setup único: <b>$7.990</b> por apoderado por curso (demo).
              </div>
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
            <div style="border:1px solid rgba(229,231,235,.75);border-radius:16px;padding:12px;background:rgba(248,250,252,1);">
              <div style="font-weight:950;">Confirmar creación del curso</div>
              <div class="muted" style="margin-top:6px;">
                Al finalizar se generará un <b>código de invitación</b> para apoderados.
              </div>
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

    if(step===1 && MODE==="apoderado"){
      const inv = $("onbInviteCode");
      const btn = $("btnValidateCode");
      const preview = $("coursePreview");

      function setPreview(html){
        if(preview) preview.innerHTML = html || "";
      }

      function validateAndLock(){
        const code = String(inv?.value || "").trim().toUpperCase();
        d.inviteCode = code;
        saveDraft(d);

        if(!code){
          alert("Ingresa el código de invitación.");
          return;
        }

        const course = getCourseV1();
        if(!course || !course.inviteCode){
          alert("Aún no existe un curso creado por la directiva. Pide el código a la directiva o crea el curso primero.");
          return;
        }

        if(code !== String(course.inviteCode||"").toUpperCase()){
          alert("Código de invitación incorrecto.");
          setPreview("");
          return;
        }

        // Bloquear curso (copiar datos oficiales)
        const c = course.course || {};
        d.regionId = c.regionId || d.regionId;
        d.comunaId = c.comunaId || d.comunaId;
        d.schoolId = c.schoolId || d.schoolId;
        d.jornada = c.jornada || d.jornada;
        d.level = c.level || d.level;
        d.letter = c.letter || d.letter;
        d.year = c.year || d.year;

        d.courseLocked = true;
        d.step = 3;
        saveDraft(d);

        setPreview(courseSummaryHTML(course));
        render();
      }

      inv && (inv.oninput = ()=>{
        d.inviteCode = String(inv.value||"").trim().toUpperCase();
        saveDraft(d);
      });
      btn && (btn.onclick = validateAndLock);

      // Si ya estaba validado, saltar directo
      if(d.courseLocked && d.inviteCode){
        const course = getCourseV1();
        if(course && String(course.inviteCode||"").toUpperCase() === String(d.inviteCode||"").toUpperCase()){
          d.step = 3;
          saveDraft(d);
          render();
          return;
        } else {
          d.courseLocked = false;
          saveDraft(d);
        }
      }
    }

    if(step===1 && MODE==="directiva"){
      const r = $("onbRegion"), c = $("onbComuna"), s = $("onbSchool");
      r.onchange = ()=>{ d.regionId=r.value; d.comunaId=""; d.schoolId=""; saveDraft(d); render(); };
      c.onchange = ()=>{ d.comunaId=c.value; d.schoolId=""; saveDraft(d); render(); };
      s.onchange = ()=>{ d.schoolId=s.value; saveDraft(d); };
      d.regionId = ctx.regionId; d.comunaId = ctx.comunaId; d.schoolId = ctx.schoolId;
    }

    if(step===2 && MODE==="directiva"){
      $("onbJornada").onchange = ()=>{ d.jornada=$("onbJornada").value; saveDraft(d); };
      $("onbYear").oninput = ()=>{ d.year=$("onbYear").value; saveDraft(d); };
      $("onbLevel").onchange = ()=>{ d.level=$("onbLevel").value; saveDraft(d); };
      $("onbLetter").onchange = ()=>{ d.letter=$("onbLetter").value; saveDraft(d); };
    }

    if(step===3){
      $("onbName").oninput = ()=>{ d.name=$("onbName").value; saveDraft(d); };
      $("onbAlumno").oninput = ()=>{ d.alumno=$("onbAlumno").value; saveDraft(d); };

      if(MODE==="apoderado"){
        $("onbEmail").oninput = ()=>{ d.email=$("onbEmail").value; saveDraft(d); };
        $("onbEmail2").oninput = ()=>{ d.email2=$("onbEmail2").value; saveDraft(d); };
        $("onbPhone").oninput = ()=>{ d.phone=$("onbPhone").value; saveDraft(d); };
        $("onbPass").oninput = ()=>{ d.pass=$("onbPass").value; saveDraft(d); };
        $("onbPass2").oninput = ()=>{ d.pass2=$("onbPass2").value; saveDraft(d); };
      }
    }

    if(step===4 && MODE==="apoderado"){
      document.querySelectorAll("input[name=pay]").forEach(r=>{
        r.onchange = ()=>{ d.payChoice=r.value; saveDraft(d); };
      });
    }

    btnPrev && (btnPrev.onclick = ()=>{
      d.step = Math.max(1, Number(d.step||1)-1);
      saveDraft(d);
      render();
    });

    btnNext && (btnNext.onclick = ()=>{
      if(step===1 && MODE==="apoderado"){
        alert("Primero valida el código de invitación.");
        return;
      }

      if(step===1 && MODE==="directiva"){
        if(!d.regionId || !d.comunaId || !d.schoolId){
          alert("Selecciona región, comuna y colegio.");
          return;
        }
        d.step=2; saveDraft(d); render(); return;
      }

      if(step===2){
        if(MODE==="apoderado"){
          d.step = 3; saveDraft(d); render(); return;
        }

        d.jornada = $("onbJornada").value;
        d.year = String($("onbYear").value||"").trim();
        d.level = $("onbLevel").value;
        d.letter = $("onbLetter").value;

        if(!/^\d{4}$/.test(d.year)){ alert("Año inválido."); return; }
        d.step=3; saveDraft(d); render(); return;
      }

      if(step===3){
        d.name = String($("onbName").value||"").trim();
        d.alumno = String($("onbAlumno").value||"").trim();

        if(!d.name){ alert("Completa el nombre."); return; }
        if(MODE==="apoderado" && !d.alumno){ alert("Completa alumno/a."); return; }

        if(MODE==="apoderado"){
          d.email = String($("onbEmail").value||"").trim().toLowerCase();
          d.email2 = String($("onbEmail2").value||"").trim().toLowerCase();
          d.phone = String($("onbPhone").value||"").trim();
          d.pass = String($("onbPass").value||"");
          d.pass2 = String($("onbPass2").value||"");

          if(!validateEmail(d.email) || d.email!==d.email2){ alert("Correo inválido o no coincide."); return; }
          if(d.pass.length < 6){ alert("Password mínimo 6 caracteres."); return; }
          if(d.pass !== d.pass2){ alert("Password no coincide."); return; }
        }

        d.step=4; saveDraft(d); render(); return;
      }

      if(step===4){
        const region = REGIONS.find(r=>r.id===d.regionId);
        const comuna = COMUNAS.find(c=>c.id===d.comunaId);
        const school = SCHOOLS.find(s=>s.id===d.schoolId);

        const courseKey = makeCourseKey(d.schoolId, d.level, d.letter, d.jornada, d.year);

        if(MODE==="directiva"){
          const inviteCode = generateInviteCode();

          const courseObj = {
            courseKey,
            inviteCode,
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
            createdByRole: DIRECTIVA_ROLE
          };

          localStorage.setItem(KEY_COURSE_V1, JSON.stringify(courseObj));
          setActiveCourseKey(courseKey);

          localStorage.setItem("cursapp_demo_user", JSON.stringify({
            name: (d.name || "Directiva") + " (Demo)",
            role: DIRECTIVA_ROLE,
            colegio: courseObj.course.schoolName,
            curso: `${courseObj.course.level}${courseObj.course.letter} ${courseObj.course.year}`,
            jornada: courseObj.course.jornada,
            alumno: "Nombre alumno(a)"
          }));

          clearDraft();

          alert(
            "Curso creado ✅\n\n" +
            "Código de invitación: " + inviteCode + "\n\n" +
            "Compártelo con los apoderados."
          );

          window.location.href = "/" + DIRECTIVA_ROLE + ".html";
          return;
        }

        // APODERADO
        d.payChoice = d.payChoice || "now";

        let users = loadUsers();
        const existing = users.find(u=>u.email===d.email);
        let userId = existing ? existing.userId : ("u_"+uid("usr"));
        const passHash = hashDemo(d.pass);

        if(existing){
          existing.passwordHashDemo = passHash;
          existing.updatedAt = nowISO();
        }else{
          users.unshift({
            userId,
            email: d.email,
            passwordHashDemo: passHash,
            createdAt: nowISO()
          });
        }
        saveUsers(users);

        let profiles = loadProfiles();

        const activation = {
          required:true,
          amount:7990,
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
          course: {
            regionId: d.regionId, regionName: region?region.name:"",
            comunaId: d.comunaId, comunaName: comuna?comuna.name:"",
            schoolId: d.schoolId, schoolName: school?school.name:"",
            jornada: d.jornada,
            level: d.level,
            letter: d.letter,
            year: d.year
          },
          apoderado: {
            name: d.name,
            alumno: d.alumno,
            phone: d.phone
          },
          activation,
          createdAt: nowISO()
        });
        saveProfiles(profiles);

        setActiveCourseKey(courseKey);

        if(typeof createEnrollment !== "function"){
          alert("Falta enrollments.js.\n\nAsegúrate de cargar /assets/enrollments.js antes de onboarding.js en onboarding/dashboard.html");
          return;
        }

        const res = createEnrollment({
          apoderadoName: d.name,
          alumno: d.alumno,
          email: d.email,
          phone: d.phone,
          activationAmount: 7990,
          activationStatus: activation.status
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
    });
  }

  // Init
  const d = loadDraft();
  if(!d.step){ d.step=1; saveDraft(d); }
  render();

})();
