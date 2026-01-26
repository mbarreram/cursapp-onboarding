/* =========================================================
   Cursapp · Onboarding (Wizard) — con cuenta Apoderado
   - Crea usuario (correo + password)
   - Guarda users[] en localStorage (demo)
   - Guarda profiles[] por curso (activación por curso)
   ========================================================= */


function generateInviteCode(){
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for(let i=0;i<6;i++){
    code += chars[Math.floor(Math.random()*chars.length)];
  }
  return code;
}
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

  const DEBUG = localStorage.getItem("cursapp_onb_debug")==="1";

  // Demo data (reemplazable por JSON real en el futuro)
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
  function todayISO(){
    const d=new Date();
    const yyyy=d.getFullYear();
    const mm=String(d.getMonth()+1).padStart(2,"0");
    const dd=String(d.getDate()).padStart(2,"0");
    return `${yyyy}-${mm}-${dd}`;
  }

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

  // Hash demo (NO seguro, solo demo local)
  function hashDemo(str){
    // DJB2
    let h=5381;
    const s = String(str||"");
    for(let i=0;i<s.length;i++) h = ((h<<5)+h) + s.charCodeAt(i);
    return "h_"+(h>>>0).toString(16);
  }

  function makeCourseKey(schoolId, level, letter, jornada, year){
    return [schoolId, level, letter, jornada, year].join("|");
  }

  function render(){
    const root = $("app");
    if(!root) return;

    const d = loadDraft();
    if(!d.step) d.step = 1;

    const step = Number(d.step||1);
    const progressPct = Math.round((step/4)*100);

    // defaults cascade
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

    const payChoice = d.payChoice || "now"; // now|later

    const debugLine = DEBUG
      ? `<div class="muted" style="margin-top:8px;font-size:12px;">DEBUG · step=${step} region=${regionId} comuna=${comunaId} school=${schoolId}</div>`
      : "";

    function option(list, valueKey, labelKey, selected){
      return list.map(x=>`<option value="${x[valueKey]}" ${x[valueKey]===selected?"selected":""}>${x[labelKey]}</option>`).join("");
    }
    function optionVals(list, selected){
      return list.map(x=>`<option value="${x}" ${x===selected?"selected":""}>${x}</option>`).join("");
    }

    root.innerHTML = `
      <div class="card" style="margin-top:12px;">
        <div style="font-weight:950;font-size:18px;">Onboarding</div>
        <div class="muted" style="margin-top:6px;">Paso ${step} de 4</div>
        <div style="margin-top:8px;height:10px;background:rgba(229,231,235,.9);border-radius:999px;overflow:hidden;">
          <div style="height:100%;width:${progressPct}%;background:rgba(91,92,226,.85)"></div>
        </div>
        ${debugLine}

        ${step===1 ? `
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
        `:""}

        ${step===2 ? `
          <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;">
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
        `:""}

        ${step===3 ? `
          <div style="margin-top:12px;">
            <label style="font-weight:900;">Nombre apoderado</label>
            <input id="onbName" placeholder="Nombre y apellido" value="${escapeHtml(name)}" />
          </div>

          <div style="margin-top:12px;">
            <label style="font-weight:900;">Alumno/a</label>
            <input id="onbAlumno" placeholder="Nombre alumno/a" value="${escapeHtml(alumno)}" />
          </div>

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

          <div style="margin-top:12px;border:1px solid rgba(229,231,235,.75);border-radius:16px;padding:12px;background:rgba(248,250,252,1);">
            <div style="font-weight:950;">📧 Comprobantes</div>
            <div class="muted" style="margin-top:6px;">
              El correo se usará para comprobantes de pago e informes del curso.
            </div>
          </div>
        `:""}

        ${step===4 ? `
          <div style="margin-top:12px;border:1px solid rgba(229,231,235,.75);border-radius:16px;padding:12px;background:rgba(248,250,252,1);">
            <div style="font-weight:950;">Activación por curso</div>
            <div class="muted" style="margin-top:6px;">
              Setup único: <b>$990</b> por apoderado por curso.
            </div>
            <div class="muted" style="margin-top:6px;">
              Si eliges pagar después, se bloqueará el uso al ingresar.
            </div>

            <div style="margin-top:10px;display:flex;gap:10px;flex-wrap:wrap;">
              <label class="tag" style="cursor:pointer;">
                <input type="radio" name="pay" value="now" ${payChoice!=="later"?"checked":""}/> Pagar ahora
              </label>
              <label class="tag" style="cursor:pointer;">
                <input type="radio" name="pay" value="later" ${payChoice==="later"?"checked":""}/> Pagar después
              </label>
            </div>
          </div>
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

    if(step===1){
      const r = $("onbRegion"), c = $("onbComuna"), s = $("onbSchool");
      r.onchange = ()=>{ d.regionId=r.value; d.comunaId=""; d.schoolId=""; saveDraft(d); render(); };
      c.onchange = ()=>{ d.comunaId=c.value; d.schoolId=""; saveDraft(d); render(); };
      s.onchange = ()=>{ d.schoolId=s.value; saveDraft(d); };
      d.regionId = ctx.regionId; d.comunaId = ctx.comunaId; d.schoolId = ctx.schoolId;
    }

    if(step===2){
      $("onbJornada").onchange = ()=>{ d.jornada=$("onbJornada").value; saveDraft(d); };
      $("onbYear").oninput = ()=>{ d.year=$("onbYear").value; saveDraft(d); };
      $("onbLevel").onchange = ()=>{ d.level=$("onbLevel").value; saveDraft(d); };
      $("onbLetter").onchange = ()=>{ d.letter=$("onbLetter").value; saveDraft(d); };
    }

    if(step===3){
      $("onbName").oninput = ()=>{ d.name=$("onbName").value; saveDraft(d); };
      $("onbAlumno").oninput = ()=>{ d.alumno=$("onbAlumno").value; saveDraft(d); };
      $("onbEmail").oninput = ()=>{ d.email=$("onbEmail").value; saveDraft(d); };
      $("onbEmail2").oninput = ()=>{ d.email2=$("onbEmail2").value; saveDraft(d); };
      $("onbPhone").oninput = ()=>{ d.phone=$("onbPhone").value; saveDraft(d); };
      $("onbPass").oninput = ()=>{ d.pass=$("onbPass").value; saveDraft(d); };
      $("onbPass2").oninput = ()=>{ d.pass2=$("onbPass2").value; saveDraft(d); };
    }

    if(step===4){
      document.querySelectorAll("input[name=pay]").forEach(r=>{
        r.onchange = ()=>{ d.payChoice=r.value; saveDraft(d); };
      });
    }

    btnPrev && (btnPrev.onclick = ()=>{
      d.step = Math.max(1, Number(d.step||1)-1);
      saveDraft(d); render();
    });

    btnNext && (btnNext.onclick = ()=>{
      if(step===1){
        if(!d.regionId || !d.comunaId || !d.schoolId){
          alert("Selecciona región, comuna y colegio.");
          return;
        }
        d.step=2; saveDraft(d); render(); return;
      }

      if(step===2){
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
        d.email = String($("onbEmail").value||"").trim().toLowerCase();
        d.email2 = String($("onbEmail2").value||"").trim().toLowerCase();
        d.phone = String($("onbPhone").value||"").trim();
        d.pass = String($("onbPass").value||"");
        d.pass2 = String($("onbPass2").value||"");

        if(!d.name){ alert("Completa tu nombre."); return; }
        if(!d.alumno){ alert("Completa alumno/a."); return; }
        if(!validateEmail(d.email) || d.email!==d.email2){ alert("Correo inválido o no coincide."); return; }
        if(d.pass.length < 6){ alert("Password mínimo 6 caracteres."); return; }
        if(d.pass !== d.pass2){ alert("Password no coincide."); return; }

        d.step=4; saveDraft(d); render(); return;
      }

      if(step===4){
        // --- build courseKey ---
        const region = REGIONS.find(r=>r.id===d.regionId);
        const comuna = COMUNAS.find(c=>c.id===d.comunaId);
        const school = SCHOOLS.find(s=>s.id===d.schoolId);

        const courseKey = makeCourseKey(d.schoolId, d.level, d.letter, d.jornada, d.year);

        // --- upsert user ---
        let users = loadUsers();
        const existing = users.find(u=>u.email===d.email);
        let userId = existing ? existing.userId : ("u_"+uid("usr"));
        const passHash = hashDemo(d.pass);

        if(existing){
          // update password if re-register
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

        // --- create profile for this course + user ---
        let profiles = loadProfiles();

        const activation = {
          required:true,
          amount:990,
          status: (d.payChoice==="later") ? "pending" : "paid",
          createdAt: nowISO(),
          paidAt: (d.payChoice==="later") ? null : nowISO()
        };

        // overwrite if same userId + courseKey exists
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

         // ===== Crear solicitud de inscripción (requiere aprobación) =====
const res = createEnrollment({
  apoderadoName: d.name,
  alumno: d.alumno,
  email: d.email,
  phone: d.phone,
  activationAmount: 7990,
  activationStatus: (d.payChoice === "later") ? "pending" : "paid"
});

if (!res.ok) {
  alert(res.error || "No se pudo enviar la solicitud.");
  return;
}

alert(
  "Solicitud enviada ✅\n\n" +
  "La directiva debe aprobar tu registro para poder ingresar."
);
        clearDraft();
window.location.href = "/index.html?pending=1";
      }
    });
  }

  // Init
  const d = loadDraft();
  if(!d.step){ d.step=1; saveDraft(d); }
  render();

})();
