



const session = JSON.parse(localStorage.getItem("cursapp_session_v1") || "null");

if (!session || !session.userId || !session.courseKey) {
  alert(
    "❌ CONTEXTO INVÁLIDO EN APODERADO\n\n" +
    JSON.stringify(session, null, 2)
  );
  throw new Error("Contexto apoderado inválido");
}

(function(){
  const app = document.getElementById("app");
  const modalRoot = document.getElementById("modalRoot");

  const navItems = Array.from(document.querySelectorAll(".navItem"));
  const menuBtn = document.getElementById("menuBtn");
  const menuDropdown = document.getElementById("menuDropdown");
  const goOnboarding = document.getElementById("goOnboarding");
  const logoutBtn = document.getElementById("logoutBtn");
  const whoCourseLine = document.getElementById("whoCourseLine");
// ===== Active profile (Fase 2) =====
const KEY_ACTIVE_PROFILE = 'cursapp_active_profile_v1';
  const sk = (base)=> (window.CURSAPP && window.CURSAPP.scopedKey) ? window.CURSAPP.scopedKey(base) : `cursapp_${base}`;
  const KEY_TASKS = sk("tasks_v1");
  const KEY_PAYMENTS = sk("payments_v1");
  const KEY_REPORTS = sk("monthly_reports_v1");
  const KEY_PROFILES = "cursapp_profiles_v1";
  const KEY_ACTIVE_COURSE = "cursapp_active_course_v1";
  const KEY_CHECKOUTS = sk("checkouts_v1");
  const KEY_LAST_SEEN_PAYMENTS = sk("last_seen_payments_v1");
  const KEY_OPTOUT = sk("optout_tasks_v1");

  function getSession(){
    return (window.CURSAPP && typeof window.CURSAPP.getSession === "function")
      ? window.CURSAPP.getSession()
      : (function(){ try{ return JSON.parse(localStorage.getItem("cursapp_session_v1")||"null"); }catch(e){ return null; } })();
  }
  function meKey(){
    const s = getSession();
    return String(s?.userId||"").toLowerCase().trim();
  }

  

  function apoderadosCountInCourse(){
    try{
      const profiles = load(KEY_PROFILES, []);
      const courseKey = localStorage.getItem(KEY_ACTIVE_COURSE) || "";
      // contamos solo perfiles apoderado del curso (no importa email) para saber si hay multi-apoderado
      return profiles.filter(p => String(p?.courseKey||"")===String(courseKey) && String(p?.role || p?.user?.role || "")==="apoderado").length;
    }catch(e){
      return 0;
    }
  }

function isMinePayment(p){
  const mk = meKey();
  if(!mk) return true;

  // Prefer explicit identity fields
  const ak = String(p?.apoderadoKey||"").toLowerCase().trim();
  if(ak) return ak === mk;

  const ae = String(p?.apoderadoEmail||p?.email||"").toLowerCase().trim();
  if(ae) return ae === mk;

  const aid = String(p?.apoderadoId||"").toLowerCase().trim();
  if(aid) return aid === mk;

  // ✅ Sin identidad fuerte no es 'mío' (evita cruces)
  return false;
}
  const load = (k, def)=>{ try{ return JSON.parse(localStorage.getItem(k) || JSON.stringify(def)); }catch{ return def; } };
  const save = (k, v)=> localStorage.setItem(k, JSON.stringify(v));

  
  // ---- Opt-out campañas no obligatorias (por curso) ----
  function getOptOutMap(){ return load(KEY_OPTOUT, {}); }
  function isOptedOut(taskId){
    const p = getActiveProfile();
    const courseKey = (p && p.courseKey) ? p.courseKey : (localStorage.getItem(KEY_ACTIVE_COURSE)||"default");
    const m = getOptOutMap();
    const arr = m[courseKey] || [];
    return arr.includes(taskId);
  }
  function setOptedOut(taskId, value){
    const p = getActiveProfile();
    const courseKey = (p && p.courseKey) ? p.courseKey : (localStorage.getItem(KEY_ACTIVE_COURSE)||"default");
    const m = getOptOutMap();
    const arr = new Set(m[courseKey] || []);
    if(value) arr.add(taskId); else arr.delete(taskId);
    m[courseKey] = Array.from(arr);
    save(KEY_OPTOUT, m);
  }
  window.toggleOptOut = function(taskId){
    const next = !isOptedOut(taskId);
    setOptedOut(taskId, next);
    renderPayments();
  };

  // ---- Helper: pagos excluidos por opt-out (solo campañas NO obligatorias) ----
  // Compat con fixes anteriores: algunos lugares usan isPaymentOptedOut().
  function isPaymentOptedOut(p){
    try{
      const tid = (p && (p.fromTaskId || p.taskId || p.campaignId)) || "";
      if(!tid) return false;
      const ts = normalizeTasks(load(KEY_TASKS, []));
      const t = ts.find(x=>String(x.id)===String(tid));
      if(!t) return false;
      if(t.mandatoryParticipation === false){
        return isOptedOut(String(t.id));
      }
      return false;
    }catch(e){
      return false;
    }
  }
  window.isPaymentOptedOut = isPaymentOptedOut;

// ---- Safe init post-reset (no pisa datos reales) ----
  function initSafeStorage(){
    if(localStorage.getItem(KEY_TASKS)===null) save(KEY_TASKS, []);
    if(localStorage.getItem(KEY_PAYMENTS)===null) save(KEY_PAYMENTS, []);
    if(localStorage.getItem(KEY_REPORTS)===null) save(KEY_REPORTS, []);
    if(localStorage.getItem(KEY_PROFILES)===null) save(KEY_PROFILES, []);
  }
  initSafeStorage();


// -------- Normalizar campañas (compat presidente/apoderado) --------
function normalizeTask(t){
  t = t || {};
  const title = t.title || t.name || t.nombre || "Campaña";
  const startDate = t.startDate || t.inicio || t.start || t.from || todayISO();
  const dueDate = t.dueDate || t.endDate || t.fin || t.end || t.to || "";
  const partRaw = (t.participation ?? t.participacion ?? (t.mandatoryParticipation===false ? "no" : "si"));
  const mandatoryParticipation = (t.mandatoryParticipation !== undefined)
    ? !!t.mandatoryParticipation
    : (String(partRaw).toLowerCase().includes("oblig") || String(partRaw).toLowerCase()==="mandatory" || String(partRaw).toLowerCase()==="si");

  const status = String(t.status || t.estado || "").toLowerCase();
  const closed = (t.closed !== undefined) ? !!t.closed : (status==="closed" || status==="cerrada" || status==="canceled" || status==="cancelada");

  const typeRaw = String(t.type || t.tipo || "single").toLowerCase();
  const type = (typeRaw.includes("mens") || typeRaw==="monthly") ? "monthly" : "single";

  const months = Number(t.months || t.cuotas || t.meses || 1) || 1;
  const amount = Number(t.amount || t.monto || 0) || 0;

  return {
    ...t,
    id: t.id || t.taskId || t.campaignId,
    title,
    startDate,
    dueDate,
    endDate: dueDate,
    mandatoryParticipation,
    type,
    months,
    amount,
    closed
  };
}

function normalizeTasks(list){
  return (list || []).map(normalizeTask).filter(t=>t && t.id);
}

// Identidad activa (para instanciar cobros de forma estable)
function getActiveIdentity(){
  const p = getActiveProfile();
  const s = getSession();
  const email = String(s?.userId || s?.email || "").toLowerCase().trim();

  return {
    courseKey: (p && p.courseKey) ? p.courseKey : (localStorage.getItem(KEY_ACTIVE_COURSE)||""),
    apoderadoId: email || "unknown_apoderado",
    alumnoId: String(p?.apoderado?.alumno || s?.alumno || "").trim(),
    email
  };
}

  // -------- Auto-cobros: instanciar pagos pendientes para el apoderado --------
  function ymFromISO(iso){
    if(!iso) return "";
    const s = String(iso);
    return s.length>=7 ? s.slice(0,7) : "";
  }
  function endOfMonthISO(ym){
    const [y,m] = String(ym||"").split("-").map(x=>parseInt(x,10));
    if(!y || !m) return "";
    const d = new Date(y, m, 0);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const dd = String(d.getDate()).padStart(2,'0');
    return `${yyyy}-${mm}-${dd}`;
  }
  function addMonthsYM(ym, add){
    const y = parseInt(String(ym).slice(0,4),10);
    const m = parseInt(String(ym).slice(5,7),10);
    if(!y || !m) return ym;
    const base = (y*12 + (m-1)) + add;
    const ny = Math.floor(base/12);
    const nm = (base%12)+1;
    return `${ny}-${String(nm).padStart(2,'0')}`;
  }

  

// -------- Identity helpers (Fase 2: no cruce) --------
function hash32(str){
  let h = 5381;
  const s = String(str||"");
  for(let i=0;i<s.length;i++) h = ((h<<5)+h) + s.charCodeAt(i);
  return (h>>>0).toString(16);
}
function alumnoIdOf(courseKey, apoderadoEmail, alumnoLabel){
  return "alu_" + hash32([courseKey, apoderadoEmail, alumnoLabel].join("|"));
}
function paymentKeyOf(courseKey, taskId, apoderadoEmail, alumnoId, period, installmentIndex){
  return [courseKey, taskId, apoderadoEmail, alumnoId, (period||""), String(installmentIndex||"")].join("|");
}
function ensurePaymentsForIdentity(ident, tasksAll, paysAll){
    ident = ident || {};
    const courseKey = String(ident.courseKey || localStorage.getItem(KEY_ACTIVE_COURSE) || "").trim();
    if(!courseKey) return paysAll || [];
    const apoderadoId = String(ident.apoderadoId||"").trim();
    const alumnoLabel = String(ident.alumnoId||"").trim();
    const email = String(ident.email||"").toLowerCase().trim();
    const aidStrong = (apoderadoId || email || "unknown_apoderado");
    const alumnoId = alumnoIdOf(courseKey, aidStrong, alumnoLabel);

    const out = (paysAll||[]).slice();

    const byKey = new Set(out.map(p=>{
      if(p && p.paymentKey) return String(p.paymentKey);
      const ck = String(p.courseKey||"").trim();
      const aid = String(p.apoderadoKey||p.apoderadoId||"").trim() || String(p.apoderadoEmail||p.email||"").toLowerCase().trim();
      const tid = String(p.fromTaskId||"");
      const per = String(p.period||ymFromISO(p.dueDate)||"");
      const idx = String(p.installmentIndex||"");
      const alu = String(p.alumnoId||"");
      return paymentKeyOf(ck, tid, aid, alu, per, idx);
    }));

    function pushPay(t, period, installmentIndex, dueDate, concept){
      const pk = paymentKeyOf(courseKey, t.id, aidStrong, alumnoId, period, installmentIndex);
      if(byKey.has(pk)) return;

      out.unshift({
        id: uid("pay"),
        paymentKey: pk,
        courseKey,
        apoderadoKey: aidStrong,
        apoderadoId: aidStrong,
        alumnoId: alumnoId,
        apoderadoEmail: aidStrong,
        fromTaskId: t.id,
        concept,
        amount: Number(t.amount||0),
        status: "pending",
        dueDate,
        period,
        installmentIndex,
        createdAt: nowISO()
      });
      byKey.add(pk);
    }

    (tasksAll||[]).forEach(t=>{
      if(!t) return;
      if(t.closed) return;

      const type = String(t.type||"single").toLowerCase();
      if(type==="monthly"){
        const startYM = ymFromISO(t.startDate||t.dueDate||todayISO());
        const months = Math.max(1, Number(t.months||1));
        for(let i=0;i<months;i++){
          const period = addMonthsYM(startYM, i);
          const dueDate = endOfMonthISO(period);
          const idx = i+1;
          pushPay(t, period, idx, dueDate, `${t.title} · Cuota ${idx}/${months}`);
        }
      }else{
        const period = ymFromISO(t.dueDate||t.startDate||todayISO());
        const dueDate = t.dueDate || endOfMonthISO(period);
        pushPay(t, period, 1, dueDate, t.title);
      }
    });

    if(out.length !== (paysAll||[]).length){
      save(KEY_PAYMENTS, out);
    }
    return out;
  }


  const esc = (s)=> String(s??"").replace(/[&<>'"]/g,c=>({ "&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;" }[c]));
  const clp = (n)=> "$"+Number(n||0).toLocaleString("es-CL");

  // ✅ alias usado en copy (WhatsApp/UI)
  function formatCLP(n){ return clp(n); }

  function uid(p="id"){ return `${p}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`; }


  function nowISO(){ return new Date().toISOString(); }
  function todayISO(){
    const d=new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }
  function daysTo(iso){
    if(!iso) return null;
    const d = new Date(iso+"T23:59:59");
    const now = new Date();
    return Math.ceil((d.getTime()-now.getTime())/(1000*60*60*24));
  }
  // 🔹 Badge de vencimiento (helper faltante)
function dueBadge(iso){
  const d = daysTo(iso);
  if(d === null) return "";
  if(d < 0) return `<span class="tag danger">Vencida</span>`;
  if(d === 0) return `<span class="tag warn">Vence hoy</span>`;
  return `<span class="tag warn">Quedan ${d} días</span>`;
}
  function dueLabelFromDays(d){
    if(d==null) return "";
    if(d<0) return "Vencida";
    if(d===0) return "Vence hoy";
    return `Quedan ${d} días`;
  }
  function monthNameFromISO(iso){
    if(!iso) return "";
    const d = new Date(iso+"T12:00:00");
    if(isNaN(d.getTime())) return "";
    const months = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
    return months[d.getMonth()];
  }

  // Nunca más pantalla en blanco: muestra error arriba
  window.onerror = function(msg, src, line){
    if(app){
      app.innerHTML = `
        <div class="card">
          <div class="kTitle">Error en Apoderado</div>
          <div class="muted" style="margin-top:6px;">${esc(msg)}</div>
          <div class="muted" style="margin-top:6px;font-size:12px;">${esc(src||"")} : ${esc(line||"")}</div>
        </div>
      `;
    }
  };

  // -------- Demo seed (si no hay data) --------
  function ensureDemo(){
    const hasTasks = load(KEY_TASKS,[]).length;
    const hasPays = load(KEY_PAYMENTS,[]).length;
    if(hasTasks && hasPays) return;

    save(KEY_TASKS,[
      {id:"t1", title:"Prueba apoderado", startDate:"2026-01-10", dueDate:"2026-01-20", closed:false, mandatoryParticipation:true, type:"single", amount:20000},
      {id:"t2", title:"Cuota paseo", startDate:"2026-04-01", dueDate:"2026-05-31", closed:false, mandatoryParticipation:true, type:"monthly", amount:20000},
      {id:"t3", title:"Regalo profe", startDate:"2026-01-10", dueDate:"2026-01-21", closed:false, mandatoryParticipation:false, type:"single", amount:1500},
    ]);

    save(KEY_PAYMENTS,[
      // pago único (pero el data puede venir duplicado desde antes: lo manejamos igual)
      {id:"p1", fromTaskId:"t1", concept:"Pago único", amount:20000, status:"pending", dueDate:"2026-01-20", createdAt: nowISO()},

      // mensual (2 cuotas)
      {id:"p2", fromTaskId:"t2", concept:"Cuota mes Abril", amount:20000, status:"pending", dueDate:"2026-04-30", createdAt: nowISO()},
      {id:"p3", fromTaskId:"t2", concept:"Cuota mes Mayo", amount:20000, status:"pending", dueDate:"2026-05-31", createdAt: nowISO()},

      // otro pago único
      {id:"p4", fromTaskId:"t3", concept:"Pago único", amount:1500, status:"pending", dueDate:"2026-01-21", createdAt: nowISO()},

      // saldo a favor
      {id:"c1", fromTaskId:"tX", concept:"Saldo a favor", amount:10000, status:"credit", createdAt: nowISO(), note:"Saldo a favor"}
    ]);

    if(!load(KEY_REPORTS,[]).length){
      save(KEY_REPORTS,[{
        id:"rep_demo",
        period:"2026-01",
        generatedAt:new Date().toLocaleString("es-CL"),
        recaudadoCurso:137500,
        gastadoCurso:75700,
        disponibleCurso:61800
      }]);
    }
  }

  // -------- Modal --------
  function openModal(html){
    modalRoot.innerHTML = `
      <div style="position:fixed;inset:0;background:rgba(15,23,42,.55);
           z-index:99999;display:flex;align-items:flex-end;justify-content:center;padding:14px;">
        <div style="width:min(820px,100%);margin-bottom:12px;">${html}</div>
      </div>
    `;
  }
  function closeModal(){ modalRoot.innerHTML=""; }
  window.closeModal = closeModal;
  // ===== Ayuda (Apoderado) =====
  const HELP_TOPICS = {
    proxima: {
      title: "Próxima cuota",
      body: "Es el pago pendiente con la fecha más cercana. Puedes pagar cuotas vencidas junto con la del mes."
    },
    pendientes: {
      title: "Pagos pendientes",
      body: "Es la suma de campañas obligatorias + campañas no obligatorias en las que participas. Si eliges “No participo” en una campaña no obligatoria, ese cobro se excluye de tu pendiente."
    },
    vencida: {
      title: "Vencida vs Pendiente",
      body: "Pendiente incluye todo lo que falta por pagar. Vencida es una cuota que ya pasó su fecha."
    },
    optout: {
      title: "No participo",
      body: "Solo disponible en campañas NO obligatorias. Si eliges “No participo”, esa campaña se excluye de tu pendiente."
    },
    saldo: {
      title: "Saldo a favor",
      body: "Se descuenta automáticamente en tus próximos pagos."
    },
    general: {
      title: "Ayuda Apoderado",
      body: ""
    }
  };

  window.openHelp = function(topic){
    const t = HELP_TOPICS[topic] || HELP_TOPICS.general;

    const qa = `
      <div class="helpQA" id="help_obligatoria">
        <div class="helpQ">¿Qué es una campaña obligatoria?</div>
        <div class="helpA">Es un cobro del curso en el que todos participan. No puedes excluirte.</div>
      </div>

      <div class="helpQA" id="help_no_obligatoria">
        <div class="helpQ">¿Qué es una campaña no obligatoria?</div>
        <div class="helpA">Puedes elegir Participar o No participo. Si eliges No participo, ese cobro se excluye de tu pendiente.</div>
      </div>

      <div class="helpQA" id="help_cuotas">
        <div class="helpQ">¿Puedo pagar cuotas atrasadas juntas?</div>
        <div class="helpA">Sí. Puedes pagar cuotas vencidas y la del mes en una sola transacción.</div>
      </div>

      <div class="helpQA" id="help_vencida">
        <div class="helpQ">¿Qué significa Vencida vs Pendiente?</div>
        <div class="helpA">Pendiente incluye todo lo que falta por pagar. Vencida es una cuota que ya pasó su fecha.</div>
      </div>

      <div class="helpQA" id="help_saldo">
        <div class="helpQ">¿Qué es “Saldo a favor”?</div>
        <div class="helpA">Se descuenta automáticamente en tus próximos pagos.</div>
      </div>

      <div class="helpQA" id="help_contacto">
        <div class="helpQ">¿A quién contacto si tengo un problema?</div>
        <div class="helpA">Contacta al presidente o tesorero del curso.</div>
      </div>
    `;

    openModal(`
      <div class="card helpModalCard">
        <div class="helpHeader">
          <div>
            <div class="kTitle">❓ ${esc(t.title||"Ayuda")}</div>
            ${t.body ? `<div class="muted" style="margin-top:6px;font-weight:800;line-height:1.45;">${esc(t.body)}</div>` : ``}
          </div>
        </div>

        <div class="helpBody">
          ${qa}
        </div>

        <div class="helpFooter">
          <button class="btnx primary" onclick="closeModal()">Cerrar</button>
        </div>
      </div>
    `);

    // Scroll a sección según topic (si aplica)
    try{
      const map = {
        proxima: null,
        pendientes: null,
        vencida: "help_vencida",
        optout: "help_no_obligatoria",
        saldo: "help_saldo",
      };
      const id = map[topic];
      if(id){
        const el = document.getElementById(id);
        if(el && el.scrollIntoView) el.scrollIntoView({behavior:"smooth", block:"start"});
      }
    }catch(e){}
  };

  // Click handler para botones "?"
  document.addEventListener("click", (ev)=>{
    const btn = ev.target && ev.target.closest ? ev.target.closest(".helpBtn") : null;
    if(!btn) return;
    const topic = btn.getAttribute("data-help") || "general";
    window.openHelp(topic);
  }, true);


  // -------- Profile / Header --------
  function getActiveProfile(){
    const profiles = load(KEY_PROFILES, []);
    if(!profiles.length) return null;

    const s = getSession() || {};
    const sessionEmail = String(s.userId || s.email || "").trim().toLowerCase();
    const activeCourse = localStorage.getItem(KEY_ACTIVE_COURSE) || "";
    const activeProfileId = localStorage.getItem(KEY_ACTIVE_PROFILE) || "";

    // 1) Perfiles SOLO del usuario logueado (evita cruces entre apoderados del mismo curso)
    let mine = profiles.filter(p=>{
      const pEmail = String(p?.apoderado?.email || p?.user?.email || "").trim().toLowerCase();
      const pUserId = String(p?.userId || p?.user?.userId || "");
      return (sessionEmail && pEmail === sessionEmail) || (s.userId && pUserId === String(s.userId));
    });

    // Fallback legacy
    if(!mine.length) mine = profiles.slice();

    // 2) Si hay profileId activo guardado, úsalo
    if(activeProfileId){
      const byId = mine.find(p => String(p?.profileId || p?.id || "") === String(activeProfileId));
      if(byId) return byId;
    }

    // 3) Si no, cae por courseKey pero dentro de mis perfiles
    if(activeCourse){
      const byCourse = mine.find(p => String(p?.courseKey || "") === String(activeCourse));
      if(byCourse) return byCourse;
    }

    return mine[0] || null;
  }

  ensureAlumnoActivo();

  function setHeader(){
    if(!whoCourseLine) return;
    const p = getActiveProfile();
    if(!p || !p.course){
      whoCourseLine.textContent = "Curso Demo · Colegio Demo";
      return;
    }
    const c = p.course;

    // --- FIX alumno faltante al volver desde Presidente ---
    try {
      if (!p?.apoderado?.alumno) {
        const profiles = load(KEY_PROFILES, []);
        const s = getSession() || {};
        const sessionEmail = String(s.userId || s.email || "").trim().toLowerCase();
        const activeCourse = localStorage.getItem(KEY_ACTIVE_COURSE) || "";
        const pEmail = String(p?.apoderado?.email || p?.user?.email || "").trim().toLowerCase();
        const pUserId = String(p?.userId || p?.user?.userId || "");
        const mine = (profiles || []).filter(x=>{
          const xEmail = String(x?.apoderado?.email || x?.user?.email || "").trim().toLowerCase();
          const xUserId = String(x?.userId || x?.user?.userId || "");
          return (sessionEmail && xEmail === sessionEmail) || (s.userId && xUserId === String(s.userId)) || (pEmail && xEmail === pEmail) || (pUserId && xUserId === pUserId);
        });

        const donor = (mine || []).find(x =>
          String(x?.apoderado?.alumno || "").trim() &&
          String(x?.courseKey || "") === String(p?.courseKey || activeCourse || "")
        );

        if (donor) {
          p.apoderado = p.apoderado || {};
          p.apoderado.alumno = donor.apoderado.alumno;

          // Persistir perfil activo para que no vuelva a fallar
          const pid = String(p?.profileId || p?.id || "");
          const idx = profiles.findIndex(x => String(x?.profileId || x?.id || "") === pid);
          if (idx >= 0) {
            profiles[idx] = p;
            save(KEY_PROFILES, profiles);
          }
        }
      }
    } catch (e) {}

    const ap = p.apoderado || {};
    whoCourseLine.innerHTML = `
      <div style="font-weight:950;color:#111827;">${esc((ap.name||"Apoderado")+" · Apoderado")}</div>
      <div class="muted" style="margin-top:2px;font-weight:900;">${esc(ap.alumno||"Alumno/a")}</div>
      <div class="muted" style="margin-top:2px;font-weight:900;font-size:12px;">
        ${esc((c.schoolName||"Colegio")+" · "+(c.level||"")+(c.letter||"")+" "+(c.year||"")+" · "+(c.jornada||""))}
      </div>
    `;
  }

  function ensureAlumnoActivo() {
  // 1) Si ya hay alumno en sesión/UI, no tocar
  try {
    const headerAlumno = document.querySelector("#studentName, .studentName, [data-student-name]");
    if (headerAlumno && headerAlumno.textContent && headerAlumno.textContent.trim()) return;
  } catch(e){}

  // 2) Buscar alumno guardado (si existe)
  let alumno = null;
  try { alumno = JSON.parse(localStorage.getItem("cursapp_alumno_activo_v1") || "null"); } catch(e){}

  // 3) Si no existe, intenta tomar el primero desde datos del apoderado (si los tienes)
  if (!alumno) {
    try {
      const kids = JSON.parse(localStorage.getItem("cursapp_kids_v1") || "[]");
      if (Array.isArray(kids) && kids.length) alumno = kids[0];
    } catch(e){}
  }

  // 4) Si lo encontró, guardarlo y pintarlo
  if (alumno) {
    try { localStorage.setItem("cursapp_alumno_activo_v1", JSON.stringify(alumno)); } catch(e){}
    // Ajusta selector a tu header real:
    const el = document.querySelector("#studentName") || document.querySelector(".studentName");
    if (el) el.textContent = alumno.nombre || alumno.name || "Alumno/a";
  }
}


  


  // -------- Activation gate --------
  function isActivationPending(){
    const p = getActiveProfile();
    if(!p) return false;
    if((p.role || p.user?.role) !== "apoderado") return false;
    return !!(p.activation?.required && p.activation.status !== "paid");
  }

  function showActivation(){
    app.innerHTML = `
      <div class="card">
        <div class="kTitle">Activación pendiente</div>
        <div class="muted" style="margin-top:6px;">
          Debes completar la activación de <b>$990</b> para operar en este curso.
          <br><span style="font-weight:900;">Este monto es del sistema, no del curso.</span>
        </div>
        <div class="actions" style="margin-top:14px;justify-content:flex-end;">
          <button class="btnx" onclick="location.href='/index.html'">Cerrar sesión</button>
          <button class="btnx primary" onclick="payActivation()">Pagar $990</button>
        </div>
      </div>
    `;

    openModal(`
      <div class="card">
        <div class="kTitle">Activación pendiente</div>
        <div class="muted" style="margin-top:6px;">
          Para operar en este curso debes completar la activación de <b>$990</b>.
          <br><span style="font-weight:900;">Este monto es del sistema, no del curso.</span>
        </div>
        <div class="actions" style="margin-top:14px;justify-content:flex-end;">
          <button class="btnx" onclick="location.href='/index.html'">Cerrar sesión</button>
          <button class="btnx primary" onclick="payActivation()">Pagar $990</button>
        </div>
      </div>
    `);
  }

  window.payActivation = function(){
    try{
      const profiles = load(KEY_PROFILES, []);
      const s = getSession() || {};
      const sessionEmail = String(s.userId || s.email || "").trim().toLowerCase();
      const activeCourse = localStorage.getItem(KEY_ACTIVE_COURSE) || "";
      let activeProfileId = localStorage.getItem(KEY_ACTIVE_PROFILE) || "";

      // Si el activeProfileId se corrompió (por ejemplo guardaron JSON), intenta reparar
      if(activeProfileId && String(activeProfileId).trim().startsWith("{")){
        try{
          const obj = JSON.parse(activeProfileId);
          const pid = String(obj.profileId || obj.id || "").trim();
          if(pid){
            localStorage.setItem(KEY_ACTIVE_PROFILE, pid);
            activeProfileId = pid;
          }else{
            localStorage.removeItem(KEY_ACTIVE_PROFILE);
            activeProfileId = "";
          }
        }catch(e){
          localStorage.removeItem(KEY_ACTIVE_PROFILE);
          activeProfileId = "";
        }
      }

      const markPaid = (p)=>{
        if(!p.activation || typeof p.activation !== "object"){
          p.activation = { required:true, status:"pending" };
        }
        p.activation.required = true;
        p.activation.status = "paid";
        p.activation.paidAt = nowISO();
      };

      let touched = false;

      // 1) Si hay perfil activo id, se prioriza
      if(activeProfileId){
        const ix = profiles.findIndex(p => String(p.profileId || p.id || "") === String(activeProfileId));
        if(ix>=0){
          markPaid(profiles[ix]);
          touched = true;
        }
      }

      // 2) Si no tocamos nada, buscamos por curso + email de sesión
      if(!touched && activeCourse && sessionEmail){
        profiles.forEach(p=>{
          const pEmail = String(p?.apoderado?.email || p?.user?.email || "").trim().toLowerCase();
          if(String(p.courseKey||"")===String(activeCourse) && pEmail===sessionEmail){
            markPaid(p);
            touched = true;
          }
        });
      }

      // 3) Fallback: curso + rol apoderado (último recurso)
      if(!touched && activeCourse){
        const ix = profiles.findIndex(p => String(p.courseKey||"")===String(activeCourse) && (p.role==="apoderado" || p.user?.role==="apoderado"));
        if(ix>=0){
          markPaid(profiles[ix]);
          touched = true;
        }
      }

      if(touched){
        save(KEY_PROFILES, profiles);
        try{ toast("Activación completada ✅"); }catch(e){ alert("Activación completada ✅"); }
      }else{
        try{ toast("No encontré el perfil para activar"); }catch(e){ alert("No encontré el perfil para activar"); }
      }
    }catch(e){
      console.error(e);
      try{ toast("Error al activar"); }catch(_){ alert("Error al activar"); }
    }

    closeModal();
    go("home");
  };

  
  // -------- Comprobantes --------
  window.openReceipt = function(id){
    const pays = load(KEY_PAYMENTS, []);
    const p = pays.find(x=>x.id===id);
    if(!p) return;

    const amount = Number(p.amountRemaining ?? p.amount ?? 0);
    const paidAt = p.paidAt ? new Date(p.paidAt).toLocaleString("es-CL") : "—";
    const method = p.paidWith || "—";
    const auth = p.webpay?.authorizationCode || p.webpay?.authorization_code || "—";
    const resp = p.webpay?.responseCode || p.webpay?.response_code || "—";
    const op = p.transactionId || p.webpay?.buyOrder || "—";

    openModal(`
      <div class="card">
        <div class="row">
          <div>
            <div class="kTitle">🧾 Comprobante</div>
            <div class="muted" style="margin-top:6px;">Pago ${esc(p.status||"")}</div>
          </div>
          <button class="btnx" onclick="closeModal()">Cerrar</button>
        </div>

        <div class="listLines" style="margin-top:12px;">
          <div class="lineItem"><b>Monto:</b> ${clp(amount)}</div>
          <div class="lineItem"><b>Fecha:</b> ${esc(paidAt)}</div>
          <div class="lineItem"><b>Método:</b> ${esc(method)}</div>
          <div class="lineItem"><b>Operación:</b> ${esc(op)}</div>
          <div class="lineItem"><b>Autorización:</b> ${esc(auth)}</div>
          <div class="lineItem"><b>Resp. code:</b> ${esc(resp)}</div>
        </div>
      </div>
    `);
  };

// -------- Reports --------
  function reports(){ return load(KEY_REPORTS, []); }
  function latestReport(){ const r = reports(); return r.length ? r[0] : null; }

  function reportSummaryCard(){
    const r = latestReport();
    if(!r){
      return `
        <div class="card">
          <div class="kTitle">Resumen del curso</div>
          <div class="muted" style="margin-top:6px;">Aún no hay informes publicados.</div>
        </div>
      `;
    }
    return `
      <div class="card">
        <div class="kTitle">Resumen del curso · ${esc(r.period||"")}</div>
        <div class="muted" style="margin-top:6px;">Montos del curso (no personales)</div>

        <div style="margin-top:10px;display:flex;gap:10px;flex-wrap:wrap;">
          <span class="pill ok">Recaudado ${clp(r.recaudadoCurso||0)}</span>
          <span class="pill warn">Rendido ${clp(r.gastadoCurso||0)}</span>
          <span class="pill">Saldo ${clp(r.disponibleCurso||0)}</span>
        </div>

        <div class="actions" style="margin-top:12px;justify-content:flex-end;">
          <button class="btnx primary" onclick="openReport('${esc(r.period||"")}')">Ver informe</button>
        </div>
      </div>
    `;
  }

  window.openReport = function(period){
    const reps = reports();
    const r = reps.find(x=>String(x.period||"")===String(period||"")) || reps[0];
    if(!r) return;

    openModal(`
      <div class="card">
        <div class="row">
          <div>
            <div class="kTitle">Informe del curso</div>
            <div class="muted" style="margin-top:6px;">Montos del curso (no personales)</div>
          </div>
          <button class="btnx" onclick="closeModal()">Cerrar</button>
        </div>
        <div class="listLines" style="margin-top:12px;">
          <div class="lineItem"><b>Periodo:</b> ${esc(r.period||"")}</div>
          <div class="lineItem"><b>Recaudado:</b> ${clp(r.recaudadoCurso||0)}</div>
          <div class="lineItem"><b>Gastado:</b> ${clp(r.gastadoCurso||0)}</div>
          <div class="lineItem"><b>Saldo:</b> ${clp(r.disponibleCurso||0)}</div>
          <div class="lineItem"><b>Emitido:</b> ${esc(r.generatedAt||"")}</div>
        </div>
      </div>
    `);
  };

  // -------- Credits apply --------
  function applyCreditsToPayment(pays, paymentIndex){
    const pay = pays[paymentIndex];
    if(!pay || (pay.status!=="pending" && pay.status!=="partial")) return {changed:false};

    let remaining = Number(pay.amountRemaining ?? pay.amount ?? 0);
    if(remaining<=0) return {changed:false};

    const credits = pays
      .map((x, idx)=>({x, idx}))
      .filter(o=>o.x.status==="credit" && Number(o.x.amount||0)>0)
      .sort((a,b)=>{
        const da = a.x.createdAt ? new Date(a.x.createdAt).getTime() : 0;
        const db = b.x.createdAt ? new Date(b.x.createdAt).getTime() : 0;
        return da - db;
      });

    if(!credits.length) return {changed:false};

    let usedTotal=0;

    for(const c of credits){
      if(remaining<=0) break;
      const cAmt = Number(c.x.amount||0);
      if(cAmt<=0) continue;
      const use = Math.min(cAmt, remaining);
      remaining -= use;
      usedTotal += use;

      pays[c.idx].amount = cAmt - use;
      if(pays[c.idx].amount<=0){
        pays[c.idx].amount=0;
        pays[c.idx].status="credit_used";
        pays[c.idx].usedAt=nowISO();
      }
    }

    if(usedTotal>0){
      pays[paymentIndex].amountRemaining = remaining;
      if(remaining<=0){
        pays[paymentIndex].status="paid";
        pays[paymentIndex].paidAt=nowISO();
        pays[paymentIndex].paidWith="credit";
      }else{
        pays[paymentIndex].status="partial";
        pays[paymentIndex].paidWith="credit_partial";
      }
      return {changed:true, usedTotal, remaining};
    }

    return {changed:false};
  }

  // -------- Pages --------
  function renderHome(){
    // datos para home
    let paysAll = load(KEY_PAYMENTS, []);
    const ident0 = (typeof getActiveIdentity==="function") ? getActiveIdentity() : null;
    const tasks0 = normalizeTasks(load(KEY_TASKS, []));
    paysAll = ensurePaymentsForIdentity(ident0, tasks0, paysAll);
    // scope a este apoderado
    paysAll = paysAll.filter(isMinePayment);

    const pending = paysAll.filter(p => ["pending","partial"].includes(String(p.status||"").toLowerCase()) && !isPaymentOptedOut(p));
    const pendingTotal = pending.reduce((a,p)=> a + Number(p.amountRemaining ?? p.amount ?? 0), 0);

    const nextDue = paysAll
      .filter(p=>String(p.status||"").toLowerCase()==="pending" && p.dueDate && !isPaymentOptedOut(p))
      .sort((a,b)=>daysTo(a.dueDate)-daysTo(b.dueDate))[0];

    const lastSeen = localStorage.getItem(KEY_LAST_SEEN_PAYMENTS) || "1970-01-01T00:00:00.000Z";
    const hasNew = paysAll.some(p => (p.createdAt || "1970-01-01T00:00:00.000Z") > lastSeen);

    const r = latestReport();

    app.innerHTML = `
      <!-- 1) Próxima cuota -->
      <div class="card" id="cardNextDue" style="border:1px solid rgba(91,92,226,.25);background:rgba(91,92,226,.06);">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
          <div class="kTitle">⏰ Próxima cuota <button class="helpBtn" data-help="proxima" type="button" aria-label="Ayuda próxima cuota">?</button></div>
          <span class="tag warn" id="homeDuePill">Vence pronto</span>
        </div>

        <div class="muted" style="margin-top:6px;font-weight:900;">
          Vence <b id="homeNextDueDate">${nextDue?.dueDate ? esc(nextDue.dueDate) : "—"}</b>
          · Quedan <b id="homeNextDueDays">${nextDue?.dueDate ? (daysTo(nextDue.dueDate) ?? "—") : "—"}</b> días
        </div>

        <div style="margin-top:12px;font-size:28px;font-weight:950;" id="homeNextDueAmount">
          ${nextDue ? formatCLP(nextDue.amountRemaining ?? nextDue.amount ?? 0) : "$0"}
        </div>

        <div class="actions" style="margin-top:12px;justify-content:flex-end;">
          <button class="btnx primary" id="btnPayNext" type="button">${nextDue ? "Pagar ahora" : "Ver pagos"}</button>
        </div>
      </div>

      <!-- 2) Pendientes -->
      <div class="card" id="cardPending" style="margin-top:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
          <div class="kTitle">💳 Pagos pendientes <button class="helpBtn" data-help="pendientes" type="button" aria-label="Ayuda pagos pendientes">?</button></div>
          ${hasNew ? `<span class="tag" style="font-weight:950;">🆕 Nuevo</span>` : ``}
        </div>

        <div class="muted" style="margin-top:6px;font-weight:900;" id="homePendingText">
          Tienes <b id="homePendingCount">${pending.length}</b> pagos pendientes
        </div>

        <div style="margin-top:10px;display:flex;justify-content:space-between;align-items:center;">
          <div class="muted">Total pendiente</div>
          <div style="font-weight:950;" id="homePendingTotal">${formatCLP(pendingTotal)}</div>
        </div>

        <div class="actions" style="margin-top:12px;justify-content:flex-end;">
          <button class="btnx" id="btnGoPending" type="button">Ver todos</button>
        </div>
      </div>

      <!-- 3) Estado del curso (más humano) -->
      <div class="card" style="margin-top:12px;">
           <div class="kTitle">📊 Estado del curso</div>
        <div class="muted" style="margin-top:6px;line-height:1.45;">
          Así va el fondo del curso. Estos montos son del curso completo, no personales.
        </div>

        ${
          r ? `
          <div style="margin-top:12px;">
            <div style="display:flex;justify-content:space-between;"><span>💰 Recaudado</span><b>${clp(r.recaudadoCurso||0)}</b></div>
            <div style="display:flex;justify-content:space-between;margin-top:6px;"><span>🧾 Gastado</span><b>${clp(r.gastadoCurso||0)}</b></div>
            <div style="display:flex;justify-content:space-between;margin-top:6px;"><span>📦 Disponible</span><b>${clp(r.disponibleCurso||0)}</b></div>
          </div>
          <div class="actions" style="margin-top:12px;justify-content:flex-end;">
            <button class="btnx" onclick="openReport('${esc(r.period||"")}')">Ver informe</button>
          </div>
          ` : `
          <div class="muted" style="margin-top:10px;font-weight:900;">Aún no hay informes publicados.</div>
          <div class="actions" style="margin-top:12px;justify-content:flex-end;">
            <button class="btnx" onclick="go('informes')">Ver informes</button>
          </div>
          `
        }
      </div>
    `;

    // comportamiento botones
    const goPending = document.getElementById("btnGoPending");
    if(goPending) goPending.onclick = ()=> go("payments");

    const payNext = document.getElementById("btnPayNext");
    if(payNext){
      payNext.onclick = ()=>{
        if(nextDue?.id) payNow(nextDue.id);
        else go("payments");
      };
    }

    // Si está al día: copy divertido
    const upcoming = paysAll.filter(p => String(p.status||"").toLowerCase()==="pending" && p.dueDate && daysTo(p.dueDate) >= 1 && daysTo(p.dueDate) <= 7 && !isPaymentOptedOut(p));
    if(pending.length===0 && upcoming.length===0){
      const title = document.querySelector("#cardNextDue .kTitle");
      if(title) title.innerHTML = "🥳 ¡Todo al día!";
      const pill = document.getElementById("homeDuePill");
      if(pill){ pill.className="tag ok"; pill.textContent="Todo en orden"; }
      const amt = document.getElementById("homeNextDueAmount");
      if(amt){ amt.textContent="No tienes pagos por ahora 😄"; amt.style.fontSize="20px"; }
      const txt = document.getElementById("homePendingText");

      // ocultar línea de vencimiento cuando está al día
      const metaLine = document.querySelector("#cardNextDue .muted");
      if(metaLine) metaLine.style.display = "none";

      // botón menos "ansioso" cuando está al día
      const btn = document.querySelector("#cardNextDue .btnx");
      if(btn){
        btn.classList.remove("primary");
        btn.textContent = "Revisar pagos";
      }
      if(txt) txt.innerHTML = "¡Cero pendientes! 🙌 Disfruta la tranquilidad";
    }
  }

  let payFilter="pending";
  window.setPayFilter=(f)=>{ payFilter=f; renderPayments(); };

  function renderPayments(){
    let paysAll = load(KEY_PAYMENTS, []);
    const tasksAll = normalizeTasks(load(KEY_TASKS, []));
    // pago recién efectuado (para banner por campaña)
    let justPaidId = "";
    try{ justPaidId = sessionStorage.getItem("justPaidPaymentId") || ""; }catch(e){}


    const ident = (typeof getActiveIdentity==="function") ? getActiveIdentity() : null;
    paysAll = ensurePaymentsForIdentity(ident, tasksAll, paysAll);

    // ✅ Scope por apoderado (evita cruce entre usuarios):
    // - Si el pago ya tiene apoderadoKey, se filtra por ese usuario
    // - Si viene "legacy" sin apoderadoKey, se asocia por alumno elegido en sesión
    const mk = meKey();
    let patched = false;
    if(mk){
      for(const p of paysAll){
        if(!p) continue;
        if(!p.apoderadoKey && isMinePayment(p)){
          p.apoderadoKey = mk;
          patched = true;
        }
      }
    }
    if(patched) save(KEY_PAYMENTS, paysAll);

    paysAll = paysAll.filter(isMinePayment);


    try{
      if(window.__apoForcePaid){
        payFilter = "paid";
        window.__apoForcePaid = false;
      }
    }catch(e){}

  const selectedTask = window.__apoTaskFilter || "all";

    

    const lastSeen = localStorage.getItem(KEY_LAST_SEEN_PAYMENTS) || "1970-01-01T00:00:00.000Z";
    const hasNew = paysAll.some(p => (p.createdAt || "1970-01-01T00:00:00.000Z") > lastSeen);
    const creditTotal = paysAll.filter(p=>String(p.status||"").toLowerCase()==="credit").reduce((a,p)=>a+Number(p.amount||0),0);


    const chips = `
      <div class="chips">
        <button class="chip ${payFilter==="pending"?"active":""}" onclick="setPayFilter('pending')">Pendientes</button>
        <button class="chip ${payFilter==="upcoming"?"active":""}" onclick="setPayFilter('upcoming')">Próximas</button>
        <button class="chip ${payFilter==="paid"?"active":""}" onclick="setPayFilter('paid')">Pagadas</button>
        <button class="chip ${payFilter==="credit"?"active":""} ${creditTotal>0?"":"disabled"}" ${creditTotal>0?`onclick="setPayFilter(\'credit\')"`:""}>${creditTotal>0?"💰 Saldo a favor":"Saldo a favor"}</button>
      </div>
    `;

    const taskOptions = (tasksAll.length>1 || (paysAll||[]).some(p=>!p.fromTaskId)) ? `
      <div style="margin-top:12px;">
        <div class="muted" style="font-weight:900;margin-bottom:6px;">🔍 Campaña</div>
        <select id="taskFilter" style="width:100%;padding:12px;border-radius:12px;border:1px solid rgba(0,0,0,.12);font-weight:900;">
          <option value="all">Todas las campañas</option>
          ${tasksAll.map(t=>`<option value="${esc(t.id)}" ${selectedTask===t.id?"selected":""}>${esc(t.title||"Campaña")}</option>`).join("")}
          <option value="no_task" ${selectedTask==="no_task"?"selected":""}>Otros (sin campaña)</option>
        </select>
      </div>
    ` : ``;


    function renderPaymentRow(r){
      let justPaidId="";
      try{ justPaidId = sessionStorage.getItem("justPaidPaymentId")||""; }catch(e){}
      const st = String(r.status||"").toLowerCase();
      const isPend = (st==="pending" || st==="partial");
      const isPaidRow = (st==="paid");
      const isCred = (st==="credit");
      const task = tasksAll.find(t=>t.id===r.fromTaskId);
      const isMonthlyTask = String(task?.type||"") === "monthly";
      const optedOut = task ? isOptedOut(task.id) : false;

      const mName = r.dueDate ? monthNameFromISO(r.dueDate) : "";
      const monthTag = (mName && !isCred && isMonthlyTask) ? `<span class="tag">${esc("Mes " + mName)}</span>` : "";

      const badge = isPaidRow ? `<span class="tag ok">Pagada</span>`
                  : isCred ? `<span class="tag">Saldo a favor</span>`
                  : `<span class="tag warn">Pendiente</span>`;

      const paidJust = (justPaidId && justPaidId===String(r.id)) ? `<span class="tag ok">✅ Pago efectuado</span>` : ``;

      const badges = `<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">${paidJust}
        ${badge}${monthTag}${r.typeTag?`<span class="tag">${esc(r.typeTag)}</span>`:""}
      </div>`;

      const due = r.dueDate ? dueBadge(r.dueDate) : ``;
      const paidInfo = isPaidRow ? (()=>{ const dt = r.paidAt ? new Date(r.paidAt).toLocaleDateString("es-CL") : "—"; const op = r.transactionId || r.webpay?.buyOrder || "—"; return `<div class="muted" style="margin-top:6px;">Pagada ${esc(dt)} · Op ${esc(op)}</div>`; })() : ``;
      const dueTxt = r.dueDate ? `<div class="muted" style="margin-top:6px;">Vence ${esc(r.dueDate)} · ${due}</div>` : ``;

      const amount = Number(r.amountRemaining ?? r.amount ?? 0);

      return `
        <div class="payRow payRowSep" id="pay_${esc(r.id)}">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;">
            <div style="min-width:200px;">
              ${badges}
              <div style="margin-top:8px;font-weight:950;font-size:18px;">${formatCLP(amount)}</div>
              ${isPaidRow ? paidInfo : dueTxt}
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;">
              ${
                (isPend && !optedOut)
                  ? `<button class="btnx primary" onclick="payNow('${esc(r.id)}')">Pagar</button>`
                  : (isPaidRow
                      ? `<button class="btnx" onclick="openReceipt('${esc(r.id)}')">🧾 Comprobante</button>`
                      : (optedOut ? `<span class="tag">No participo</span>` : `<span class="muted">—</span>`))
              }
            </div>
          </div>
        </div>
      `;
    }

    // filtro de pagos
    let paysFiltered = [];
    if(payFilter==="pending") paysFiltered = paysAll.filter(p=>["pending","partial"].includes(String(p.status||"").toLowerCase()) && !isPaymentOptedOut(p));
    else if(payFilter==="upcoming") paysFiltered = paysAll.filter(p=>String(p.status||"").toLowerCase()==="pending" && p.dueDate && daysTo(p.dueDate) >= 1 && daysTo(p.dueDate) <= 7 && !isPaymentOptedOut(p));
    else if(payFilter==="paid") paysFiltered = paysAll.filter(p=>String(p.status||"").toLowerCase()==="paid");
    else if(payFilter==="credit") paysFiltered = paysAll.filter(p=>String(p.status||"").toLowerCase()==="credit");
    else paysFiltered = paysAll.slice();

    // próxima cuota destacada (solo si hay pendiente con fecha)
    const nextDueBase = (selectedTask && selectedTask!=="all")
      ? paysAll.filter(p => (p.fromTaskId || "no_task") === selectedTask)
      : paysAll;

    const nextDue = nextDueBase
      .filter(p=>String(p.status||"").toLowerCase()==="pending" && p.dueDate && !isPaymentOptedOut(p))
      .sort((a,b)=>daysTo(a.dueDate)-daysTo(b.dueDate))[0];

    const nextCard = nextDue ? `
      <div class="card" style="margin-top:12px;border:1px solid rgba(91,92,226,.22);background:rgba(91,92,226,.06);">
        <div style="font-weight:950;">Próxima cuota</div>
        <div class="muted" style="margin-top:6px;font-weight:900;">Campaña: <b>${esc((tasksAll.find(t=>t.id===nextDue.fromTaskId)?.title)||"—")}</b></div>
        <div class="muted" style="margin-top:6px;font-weight:800;">
          Vence ${esc(nextDue.dueDate)} · ${dueBadge(nextDue.dueDate)}
        </div>
        <div style="margin-top:10px;display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap;">
          <div style="font-weight:950;font-size:18px;">${formatCLP(nextDue.amountRemaining ?? nextDue.amount ?? 0)}</div>
          <button class="btnx primary" onclick="payNow('${esc(nextDue.id)}')">Pagar</button>
        </div>
      </div>
    ` : ``;
    // Aplicar filtro por campaña (si no es "all")
    if(selectedTask !== "all"){
      paysFiltered = paysFiltered.filter(p => (p.fromTaskId || "no_task") === selectedTask);
    }



    // agrupar pagos por campaña
    const paysByTask = {};
    paysFiltered.forEach(p=>{
      const tid = p.fromTaskId || "no_task";
      paysByTask[tid] = paysByTask[tid] || [];
      paysByTask[tid].push(p);
    });

    function campaignMeta(t){
      const type = (String(t.type||"") === "monthly") ? `Mensual · ${Number(t.months||1)} cuota(s)` : "Pago único";
      const part = (t.mandatoryParticipation===false) ? "No obligatoria" : "Obligatoria";
      return { type, part, amount:Number(t.amount||0), range:(t.startDate&&t.dueDate)?`${t.startDate} → ${t.dueDate}`:"" };
    }

    function emptyCampaignCard(t){
      const m = campaignMeta(t);
      return `
        <div class="card" style="margin-top:12px;">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                  <div style="font-weight:950;font-size:18px;">${esc(t.title||"Campaña")}</div>
                  <span class="tag">Campaña</span>
                </div>
          ${m.range?`<div class="muted" style="margin-top:6px;">${esc(m.range)}</div>`:""}
          <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">
            <span class="tag">Monto ${formatCLP(m.amount)}</span>
            <span class="tag">${esc(m.type)}</span>
            <span class="tag">${esc(m.part)}</span>
          </div>
          <div class="muted" style="margin-top:10px;font-weight:800;line-height:1.45;">
            Aún no hay cobros generados para ti en esta campaña. Si acabas de ingresar, vuelve a abrir Pagos para que se creen automáticamente.
          </div>
        </div>
      `;
    }

    const campaignCards = tasksAll
      .slice()
      .sort((a,b)=>String(a.dueDate||"").localeCompare(String(b.dueDate||"")))
      .map(t=>{
        const rows = paysByTask[t.id] || [];
        if(!rows.length){
          const hasAny = paysAll.some(p=>p.fromTaskId===t.id);
          return hasAny
            ? `<div class="card" style="margin-top:12px;"><div style="font-weight:950;">${esc(t.title||"Campaña")}</div><div class="muted" style="margin-top:6px;">No hay pagos para este filtro en esta campaña.</div></div>`
            : emptyCampaignCard(t);
        }

        rows.sort((a,b)=>{
          const da = a.dueDate ? daysTo(a.dueDate) : 99999;
          const db = b.dueDate ? daysTo(b.dueDate) : 99999;
          return da-db;
        });

        const m = campaignMeta(t);
        const isMonthly = String(t.type||"") === "monthly";

        // Resumen simple para single (paga todo)
        if(!isMonthly){
          const pend = rows.filter(r=>["pending","partial"].includes(String(r.status||"").toLowerCase()));
          const totalPend = pend.reduce((a,r)=>a+Number(r.amountRemaining ?? r.amount ?? 0),0);
          return `
            <div class="card" style="margin-top:12px;">
              <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;">
                <div>
                  <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                  <div style="font-weight:950;font-size:18px;">${esc(t.title||"Campaña")}</div>
                  <span class="tag">Campaña</span>
                </div>
                  <div class="muted" style="margin-top:6px;">${esc(m.type)} · ${esc(m.part)}</div>
                </div>
              </div>
${(justPaidId && rows.some(x=>String(x.id)===String(justPaidId))) ? `<div style="margin-top:10px;padding:10px 12px;border-radius:14px;background: rgba(34,197,94,.12);border: 1px solid rgba(34,197,94,.22);font-weight: 900;">✅ Pago registrado. Gracias 🙌</div>` : ``}
                            <div class="muted" style="margin-top:6px;">Pendiente ${formatCLP(totalPend)}</div>
              <div style="margin-top:10px;">
                ${rows.map(r=>renderPaymentRow(r)).join("")}
              </div>
            </div>
          `;
        }

        // Mensual
        const total = rows.length;
        const paidCount = rows.filter(r=>String(r.status||"").toLowerCase()==="paid").length;
        const pendCount = rows.filter(r=>["pending","partial"].includes(String(r.status||"").toLowerCase())).length;
        const progressPct = total ? Math.round((paidCount/total)*100) : 0;
        const campId = `camp_${t.id}`;
        const isOpen = !!window.__apoCampOpen?.[campId];
        const visibleRows = isOpen ? rows : rows.slice(0,2);


        return `
          <div class="card" style="margin-top:12px;">
            <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;">
              <div>
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                  <div style="font-weight:950;font-size:18px;">${esc(t.title||"Campaña")}</div>
                  <span class="tag">Campaña</span>
                </div>
                <div class="muted" style="margin-top:6px;">${esc(m.type)} · ${esc(m.part)}</div>
              </div>
              <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end;">
              <div class="muted" style="font-weight:950;">${paidCount}/${total} pagadas</div>
              ${t.mandatoryParticipation===false ? `
                <button class="btnx" style="border:1px solid rgba(0,0,0,.14);" onclick="toggleOptOut(\'${esc(t.id)}\')">
                  ${isOptedOut(t.id) ? "Participar" : "No participo"}
                </button>
              ` : ``}
            </div>
            </div>

            ${(justPaidId && rows.some(x=>String(x.id)===String(justPaidId))) ? `<div style="margin-top:10px;padding:10px 12px;border-radius:14px;background: rgba(34,197,94,.12);border: 1px solid rgba(34,197,94,.22);font-weight: 900;">✅ Pago registrado. Gracias 🙌</div>` : ``}

            <div style="margin-top:10px;">
              <div style="height:10px;border-radius:999px;background:rgba(17,24,39,.08);overflow:hidden;">
                <div style="height:100%;width:${progressPct}%;background:rgba(91,92,226,.85);"></div>
              </div>
              <div class="muted" style="margin-top:6px;font-weight:900;">
                ${pendCount ? `Quedan ${pendCount} cuota(s) por pagar 😅` : `¡Listo! Campaña al día 🥳`}
              </div>
            </div>

            <div class="kCampRail" style="margin-top:10px;">
              ${visibleRows.map(r=>renderPaymentRow(r)).join("")}
            </div>
            ${rows.length>2 ? `
              <div class="actions" style="margin-top:10px;justify-content:flex-end;">
                <button class="btnx" onclick="toggleCamp('${esc(campId)}')">${isOpen ? "Contraer" : `Ver todas (${rows.length})`}</button>
              </div>
            ` : ``}
          </div>
        `;
}).join("");

    const others = (paysByTask["no_task"]||[]).length ? `
      <div class="card" style="margin-top:12px;">
        <div style="font-weight:950;">Otros (sin campaña)</div>
        <div class="muted" style="margin-top:6px;">Cobros no asociados a una campaña</div>
        ${(paysByTask["no_task"]||[]).map(r=>renderPaymentRow(r)).join("")}
      </div>
    ` : ``;

    const emptyAll = (!tasksAll.length && !paysAll.length);

    // Toast post-pago (no intrusivo)
    let toastHtml = ``;
    try{
      if(sessionStorage.getItem("justPaid")==="1"){
        sessionStorage.removeItem("justPaid");
        toastHtml = `
          <div class="toastOk">✅ Pago registrado. Gracias 🙌</div>
        `;
      }
    }catch(e){}

    app.innerHTML = `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
          <div class="kTitle">Pagos <button class="helpBtn" data-help="vencida" type="button" aria-label="Ayuda pagos">?</button></div>
          ${hasNew ? `<span class="tag" style="font-weight:950;">🆕 Nuevo</span>` : ``}
        </div>
                <div class="muted" style="margin-top:6px;">💡 El saldo a favor se descuenta automáticamente.</div>
        ${chips}
      </div>

      ${taskOptions}

      ${nextCard}

      ${
        emptyAll
          ? (() => {
            if(payFilter==="pending") return `<div class="card" style="margin-top:12px;"><div class="muted" style="font-weight:900;line-height:1.45;">🎉 No tienes pagos pendientes. Te avisaremos cuando la directiva publique un cobro 😊</div></div>`;
            if(payFilter==="upcoming") return `<div class="card" style="margin-top:12px;"><div class="muted" style="font-weight:900;line-height:1.45;">📅 No hay pagos próximos por ahora.</div></div>`;
            if(payFilter==="paid") return `<div class="card" style="margin-top:12px;"><div class="muted" style="font-weight:900;line-height:1.45;">Aún no tienes pagos registrados.</div></div>`;
            if(payFilter==="credit") return `<div class="card" style="margin-top:12px;"><div class="muted" style="font-weight:900;line-height:1.45;">No tienes saldo a favor por ahora.</div></div>`;
            return `<div class="card" style="margin-top:12px;"><div class="muted" style="font-weight:900;line-height:1.45;">Aún no hay campañas ni cobros publicados. Te avisaremos cuando haya novedades 😊</div></div>`;
          })()
          : (campaignCards || `<div class="card" style="margin-top:12px;"><div class="muted">Sin pagos para este filtro.</div></div>`)
      }

      ${others}
    `;

    // hook filtro campaña
    const sel = document.getElementById("taskFilter");
    if(sel){
      sel.onchange = ()=>{
        window.__apoTaskFilter = sel.value;
        renderPayments();
      };
    }

    // marcar como visto (para badge 🆕)
    localStorage.setItem(KEY_LAST_SEEN_PAYMENTS, nowISO());

    try{
      const pid = sessionStorage.getItem("justPaidPaymentId")||"";
      if(pid){
        const elRow = document.getElementById("pay_"+pid);
        if(elRow && elRow.scrollIntoView){
          elRow.scrollIntoView({behavior:"smooth", block:"center"});
        }
        sessionStorage.removeItem("justPaidPaymentId");
        sessionStorage.removeItem("justPaidTaskId");
      }
    }catch(e){}


    try{ if(sessionStorage.getItem("justPaidPaymentId")) sessionStorage.removeItem("justPaidPaymentId"); }catch(e){}

    // toast simple post-pago
    try{
      if(sessionStorage.getItem("justPaid")==="1"){
        sessionStorage.removeItem("justPaid");
        
      }
    }catch(e){}


  }



  
  // Pagar campaña single: paga todas las filas pendientes de ese taskId
  window.paySingleCampaign = function(taskId){
    const pays = load(KEY_PAYMENTS, []);
    const ids = pays
      .map((p,idx)=>({p,idx}))
      .filter(o=>o.p.fromTaskId===taskId && (o.p.status==="pending" || o.p.status==="partial"))
      .sort((a,b)=>String(a.p.dueDate||"").localeCompare(String(b.p.dueDate||"")));

    if(!ids.length) return;

    let usedCreditTotal = 0;
    let remainingTotal = 0;

    // apply credits/payment for each row
    for(const o of ids){
      const r = applyCreditsToPayment(pays, o.idx);
      if(r.changed){
        usedCreditTotal += Number(r.usedTotal||0);
        remainingTotal += Number(r.remaining||0);
      }else{
        // no credit -> mark paid demo
        pays[o.idx].status="paid";
        pays[o.idx].paidAt=nowISO();
        const mk = meKey();
        pays[o.idx].apoderadoKey = mk;
        pays[o.idx].apoderadoId = mk;
        pays[o.idx].apoderadoEmail = mk;
      }
    }

    save(KEY_PAYMENTS, pays);

    if(usedCreditTotal>0){
      if(remainingTotal<=0) alert(`✅ Pago cubierto con saldo a favor.\nAplicado: ${clp(usedCreditTotal)}`);
      else alert(`✅ Se aplicó saldo a favor: ${clp(usedCreditTotal)}\nRestante por pagar: ${clp(remainingTotal)} (demo)`);
    }else{
      alert("Pago realizado ✅ (demo)");
    }

    renderPayments();
  };

  
  // ---- Camp accordion state (Apoderado) ----
  window.__apoCampOpen = window.__apoCampOpen || {};
  window.toggleCamp = function(campId){
    window.__apoCampOpen[campId] = !window.__apoCampOpen[campId];
    renderPayments();
  };


window.payNow = function(id){
    // Checkout Webpay (Transbank): ir a pantalla de pago
    const pays = load(KEY_PAYMENTS, []);
    const i = pays.findIndex(p=>p.id===id);
    if(i<0) return;

    const mk = meKey();
    const ident = (typeof getActiveIdentity==="function") ? getActiveIdentity() : null;
    const courseKey = ident?.courseKey || localStorage.getItem(KEY_ACTIVE_COURSE) || "";

    // ✅ Bloqueo duro: no pagar cobro de otro apoderado
    const owner = String(pays[i].apoderadoKey || pays[i].apoderadoEmail || pays[i].apoderadoId || "").toLowerCase().trim();
    if(owner && owner !== mk){
      alert("Este cobro no pertenece a este apoderado.");
      return;
    }
    // ✅ Si no tiene dueño, lo sellamos al apoderado actual (solo si ya es visible para él)
    pays[i].courseKey = pays[i].courseKey || courseKey;
    pays[i].apoderadoKey = mk;
    pays[i].apoderadoId = mk;
    pays[i].apoderadoEmail = mk;
    if(!pays[i].alumnoId){
      const alumnoLabel = String(pays[i].alumno || ident?.alumnoId || "");
      pays[i].alumnoId = alumnoIdOf(pays[i].courseKey, mk, alumnoLabel);
    }
    if(!pays[i].paymentKey){
      pays[i].paymentKey = paymentKeyOf(pays[i].courseKey, pays[i].fromTaskId, mk, pays[i].alumnoId, pays[i].period||"", pays[i].installmentIndex||"");
    }

    save(KEY_PAYMENTS, pays);

    const checkouts = load(KEY_CHECKOUTS, []);
    const checkout = {
      id: "ck_" + Math.random().toString(16).slice(2),
      paymentId: id,
      apoderadoKey: mk,
      courseKey: pays[i].courseKey,
      createdAt: nowISO(),
      status: "created"
    };
    checkouts.unshift(checkout);
    save(KEY_CHECKOUTS, checkouts);

    location.href = `/pay.html?pid=${encodeURIComponent(id)}&cid=${encodeURIComponent(checkout.id)}`;
  };

  function renderInformes(){
    const reps = reports();
    app.innerHTML = `
      <div class="card">
        <div class="kTitle">Informes</div>
        <div class="muted" style="margin-top:6px;">Montos del curso (no personales).</div>
      </div>
      ${reps.length ? reps.map(r=>`
        <div class="card accentCard">
          <div class="row">
            <div>
              <div class="kTitle">Informe ${esc(r.period||"")}</div>
              <div class="muted" style="margin-top:6px;font-size:12px;">${esc(r.generatedAt||"")}</div>
            </div>
            <button class="btnx primary" onclick="openReport('${esc(r.period||"")}')">Ver</button>
          </div>
        </div>
      `).join("") : `<div class="card"><div class="muted">Aún no hay informes publicados.</div></div>`}
    `;
  }

  // ✅ Router GLOBAL (y expuesto para que onclick del Home no rompa)
  function go(tab){
    navItems.forEach(b=>b.classList.toggle("active", b.dataset.tab===tab));
    setHeader();

    if(isActivationPending()){
      showActivation();
      return;
    }else{
      closeModal();
    }

    if(tab==="home") renderHome();
    if(tab==="payments") renderPayments();
    if(tab==="informes") renderInformes();
  }
  window.go = go; // <-- esto elimina el error "Can't find variable: go"

  // Menu
  function initMenu(){
    if(menuBtn && menuDropdown){
      menuBtn.onclick=(e)=>{e.stopPropagation(); menuDropdown.style.display=(menuDropdown.style.display==="block"?"none":"block");};
      document.addEventListener("click",()=> menuDropdown.style.display="none");
    }

    const menu = document.getElementById("menuDropdown");
if(menu && !document.getElementById("resetCourseBtn")){
  const b = document.createElement("button");
  b.id = "resetCourseBtn";
  b.className = "btn ghost";
  b.type = "button";
  b.style.width = "100%";
  b.style.textAlign = "left";
  b.textContent = "🧹 Reset curso (solo datos)";
  b.onclick = ()=>{
    if(!confirm("Esto borra campañas/pagos/gastos del curso. ¿Continuar?")) return;
    localStorage.removeItem("cursapp_tasks_v1");
    localStorage.removeItem("cursapp_payments_v1");
    localStorage.removeItem("cursapp_expenses_v1");
    localStorage.removeItem("cursapp_monthly_reports_v1");
    localStorage.removeItem("cursapp_receipts_v1");
    alert("Curso reseteado ✅");
    location.reload();
  };
  // insertar antes de cerrar sesión si existe
  const logout = document.getElementById("logoutBtn") || document.getElementById("logoutMenuItem");
  if(logout && logout.parentElement===menu) menu.insertBefore(b, logout);
  else menu.appendChild(b);
}


    if(goOnboarding){
      goOnboarding.onclick = ()=> location.href="onboarding/dashboard.html?onboarding=1";
    }
    if(logoutBtn){
      logoutBtn.onclick = ()=> location.href="/index.html";
    }
  }

  // Bottom nav
  navItems.forEach(b=> b.onclick=()=> go(b.dataset.tab));
// Boot
// ✅ Solo sembrar demo si está activado explícitamente
const DEMO_MODE = !!(window.CURSAPP && window.CURSAPP.DEMO_MODE);

if (DEMO_MODE) {
  ensureDemo();
}

initMenu();
const hash = (location.hash || "").replace("#","");
if(hash==="payments_paid"){
  try{ window.__apoForcePaid = true; }catch(e){}
  go("payments");
}else if(hash==="payments") go("payments");
else go("home"); // default seguro post-reset
})();
