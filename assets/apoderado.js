
// === CURSAPP GLOBAL LOADING ===
window.CURSAPP_LOADING = window.CURSAPP_LOADING || {
 show:(role='')=>{
  try{
   let el=document.getElementById('cursapp-loading-overlay');
   if(el) return;
   const msgs={
    presidente:['📊 Preparando dashboard ejecutivo...','👥 Revisando apoderados...','📈 Actualizando indicadores...'],
    tesorero:['💰 Conciliando pagos...','🧾 Actualizando comprobantes...','📋 Revisando rendiciones...'],
    apoderado:['🎒 Revisando información del curso...','📅 Consultando próximas cuotas...','📣 Actualizando avisos...']
   };
   const arr=msgs[(role||'').toLowerCase()]||['Cargando datos...'];
   el=document.createElement('div');
   el.id='cursapp-loading-overlay';
   el.style.cssText='position:fixed;inset:0;background:#fff;z-index:999999;display:flex;flex-direction:column;align-items:center;justify-content:center';
   el.innerHTML='<div style="font-size:54px;color:#6d28d9;font-weight:700">C</div><div id="ca-msg" style="margin-top:12px;font-weight:600">Cargando datos...</div><div style="width:220px;height:6px;background:#eee;border-radius:8px;overflow:hidden;margin-top:12px"><div style="height:100%;width:100%;background:#6d28d9;animation:caProg 1.4s infinite"></div></div><style>@keyframes caProg{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}</style>';
   document.body.appendChild(el);
   let i=0; el._t=setInterval(()=>{const m=el.querySelector('#ca-msg'); if(m) m.textContent=arr[i++%arr.length];},900);
  }catch(e){}
 },
 hide:()=>{
  const el=document.getElementById('cursapp-loading-overlay');
  if(el){try{clearInterval(el._t);}catch(e){} el.remove();}
 }
};
document.addEventListener('DOMContentLoaded',()=>{try{window.CURSAPP_LOADING.show('apoderado'); setTimeout(()=>window.CURSAPP_LOADING.hide(),1200);}catch(e){}});
// === END LOADING ===





// V10.1 · Contexto de rol robusto para Apoderado.
// No exige courseKey en sesión porque puede venir desde cursapp_active_course_v1
// o desde el perfil activo. Evita el falso "contexto inválido" al cambiar
// Presidente → Apoderado con usuarios multirol.
function __cursappReadJsonV101(key, fallback){
  try{ const raw=localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }catch(_e){ return fallback; }
}
function __cursappWriteJsonV101(key, value){
  try{ localStorage.setItem(key, JSON.stringify(value)); }catch(_e){}
}
function __cursappNormalizeRoleContextV101(expectedRole){
  const role = String(expectedRole || 'apoderado').toLowerCase().trim();
  const session = __cursappReadJsonV101('cursapp_session_v1', null) || {};
  const profile = __cursappReadJsonV101('cursapp_active_profile_v1', null) || {};
  const activeCourse = String(localStorage.getItem('cursapp_active_course_v1') || session.courseKey || profile.courseKey || profile.course_key || '').trim();

  if(!session.userId && (session.email || profile.email)){
    session.userId = String(session.email || profile.email).toLowerCase().trim();
  }

  const roles = Array.isArray(session.roles) ? session.roles.map(r=>String(r).toLowerCase().trim()).filter(Boolean) : [];
  if(!roles.includes(role)) roles.push(role);

  session.roles = roles;
  session.currentRole = role;
  session.activeRole = role;
  session.role = role;
  if(activeCourse){
    session.courseKey = activeCourse;
    localStorage.setItem('cursapp_active_course_v1', activeCourse);
  }
  localStorage.setItem('cursapp_active_role_v1', role);
  __cursappWriteJsonV101('cursapp_session_v1', session);
  document.documentElement.setAttribute('data-role', role);
  return session;
}

const session = __cursappNormalizeRoleContextV101('apoderado');

alert('DEBUG SESSION\n'+JSON.stringify(session,null,2));
try{
 const profile=JSON.parse(localStorage.getItem('cursapp_active_profile_v1')||'{}');
 alert('DEBUG ACTIVE PROFILE\n'+JSON.stringify(profile,null,2));
}catch(e){alert('DEBUG PROFILE ERROR '+e.message);}
alert('DEBUG ACTIVE COURSE\n'+(localStorage.getItem('cursapp_active_course_v1')||'NULL'));


if (!session || !session.userId) {
  console.warn('Cursapp Apoderado: sesión sin userId; se mostrará estado vacío controlado.', session);
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
  const ae = String(p?.apoderadoEmail||p?.email||"").toLowerCase().trim();
  if(ae) return ae === mk;

  const ak = String(p?.apoderadoKey||"").toLowerCase().trim();
  if(ak) return ak === mk;
  if(ae) return ae === mk;

  const aid = String(p?.apoderadoId||"").toLowerCase().trim();
  if(aid) return aid === mk;

  // ✅ Sin identidad fuerte no es 'mío' (evita cruces)
  return false;
}
  // ---- notifier: refrescar cuando se actualiza storage (misma sesión) ----
  (function patchLocalStorageSetItem(){
    try{
      if(window.__cursapp_setItemPatched) return;
      const _orig = localStorage.setItem.bind(localStorage);
      localStorage.setItem = function(k, v){
        _orig(k, v);
        try{ window.dispatchEvent(new CustomEvent('cursapp:dataChanged', { detail: { key: String(k||'') } })); }catch(e){}
      };
      window.__cursapp_setItemPatched = true;
    }catch(e){}
  })();

  const load = (k, def)=>{ try{ return JSON.parse(localStorage.getItem(k) || JSON.stringify(def)); }catch{ return def; } };
  const save = (k, v)=>{
    localStorage.setItem(k, JSON.stringify(v));
    try{ window.dispatchEvent(new CustomEvent('cursapp:dataChanged', { detail: { key: String(k||'') } })); }catch(e){}
  };

  
  // ---- Opt-out campañas no obligatorias (por apoderado) ----
// Estructura: { [courseKey]: { [apoderadoKey]: [taskId, ...] } }
function getOptOutMap(){ return load(KEY_OPTOUT, {}); }

function getCourseKeyForOpt(){
  const p = getActiveProfile && getActiveProfile();
  return (p && p.courseKey) ? String(p.courseKey) : String(localStorage.getItem(KEY_ACTIVE_COURSE)||"default");
}
function getApoderadoKeyForOpt(){
  // Usa identidad de sesión (userId/email) para evitar cruces
  const mk = meKey();
  return mk || "unknown";
}

function isOptedOut(taskId){
  const courseKey = getCourseKeyForOpt();
  const ak = getApoderadoKeyForOpt();
  const m = getOptOutMap();
  const byCourse = m[courseKey] || {};

  // Back-compat: formato antiguo era array por curso
  if(Array.isArray(byCourse)){
    return byCourse.includes(taskId);
  }

  const arr = byCourse[ak] || [];
  return Array.isArray(arr) ? arr.includes(taskId) : false;
}

function setOptedOut(taskId, value){
  const courseKey = getCourseKeyForOpt();
  const ak = getApoderadoKeyForOpt();
  const m = getOptOutMap();
  let byCourse = m[courseKey] || {};

  // Migración suave desde formato antiguo (array)
  if(Array.isArray(byCourse)){
    byCourse = { "_legacy_all": byCourse };
  }

  const set = new Set(Array.isArray(byCourse[ak]) ? byCourse[ak] : []);
  if(value) set.add(taskId); else set.delete(taskId);
  byCourse[ak] = Array.from(set);
  m[courseKey] = byCourse;
  save(KEY_OPTOUT, m);
}

// Aplica opt-out a pagos (para que Presidente descuente "por cobrar" y deudores)
function applyOptOutToPayments(taskId, optedOut){
  try{
    const tasksAll = normalizeTasks(load(KEY_TASKS, []));
    const t = tasksAll.find(x=>String(x.id)===String(taskId));
    if(!t) return;

    // Solo campañas NO obligatorias
    if(t.mandatoryParticipation !== false) return;

    let paysAll = load(KEY_PAYMENTS, []);
    const mine = paysAll.filter(isMinePayment);
    const now = new Date();

    const upd = paysAll.map(p=>{
      if(!isMinePayment(p)) return p;
      const tid = String(p?.fromTaskId || p?.taskId || p?.campaignId || "");
      if(tid !== String(taskId)) return p;

      // No tocar pagos ya pagados / rendidos
      const st = String(p?.status||"").toLowerCase();
      if(st === "paid" || st === "settled" || st === "refunded") return p;

      if(optedOut){
        return { ...p, status: "opted_out", estado: "no_participa", amountRemaining: 0 };
      }else{
        // volver a pendiente o vencida según fecha
        const due = p?.dueDate ? new Date(p.dueDate) : null;
        const nextStatus = (due && due < now) ? "overdue" : "pending";
        // si estaba opted_out lo reactivamos; si ya estaba pending/overdue lo dejamos
        if(st === "opted_out" || st === "no_participa" || st === "no participa") return { ...p, status: nextStatus, estado: "pendiente", amountRemaining: Number(p.amount || p.monto || 0) };
        return p;
      }
    });

    save(KEY_PAYMENTS, upd);
  }catch(e){
    // silencio: no bloquear UI por esto
  }
}

window.openCotizacionesModal = openCotizacionesModal;
window.toggleOptOut = async function(taskId){
  const next = !isOptedOut(taskId);
  setOptedOut(taskId, next);
  applyOptOutToPayments(taskId, next);
  try{
    if(window.CURSAPP && typeof window.CURSAPP.markCampaignOptOutSupabase === "function" && isSupabaseUuid(taskId)){
      await window.CURSAPP.markCampaignOptOutSupabase(taskId, next);
    }
    if(window.CURSAPP_PAYMENTS_V11 && typeof window.CURSAPP_PAYMENTS_V11.refresh === "function"){
      await window.CURSAPP_PAYMENTS_V11.refresh("apoderado-optout");
    }
  }catch(e){
    console.warn("No se pudo actualizar No participo en Supabase", e);
    try{ alert("No se pudo actualizar en Supabase: " + (e.message || e)); }catch(_){}
  }
  renderPayments();
};

  // ---- Helper: pagos excluidos por opt-out (solo campañas NO obligatorias) ----
  // Compat con fixes anteriores: algunos lugares usan isPaymentOptedOut().
  function isPaymentOptedOut(p){
    try{
      const st0 = String(p?.status || p?.estado || "").toLowerCase().trim();
      if(st0 === "opted_out" || st0 === "no_participa" || st0 === "no participa") return true;
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

  const email = String(
    p?.apoderado?.email ||
    p?.email ||
    p?.user?.email ||
    s?.email ||
    s?.userId ||
    ""
  ).toLowerCase().trim();

  const alumnoLabel = String(
    p?.apoderado?.alumno ||
    p?.studentName ||
    s?.alumno ||
    ""
  ).trim();

  const alumnoIdReal = String(
    p?.apoderado?.alumnoId ||
    p?.studentId ||
    p?.alumnoId ||
    ""
  ).trim();

  return {
    courseKey: (p && p.courseKey) ? p.courseKey : (localStorage.getItem(KEY_ACTIVE_COURSE)||""),
    apoderadoId: email || "unknown_apoderado",
    alumnoId: alumnoIdReal || alumnoLabel,
    alumnoLabel,
    realAlumnoId: alumnoIdReal,
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

function inferredInstallmentIndex(p, task){
  const raw = Number(p?.installmentIndex || 0);
  if(raw > 0) return raw;

  const c = String(p?.concept || "");
  let m = c.match(/cuota\s*(\d+)\s*\/\s*\d+/i);
  if(m) return Number(m[1] || 0) || 0;

  m = c.match(/cuota\s*(\d+)/i);
  if(m) return Number(m[1] || 0) || 0;

  if(String(task?.type||"") !== "monthly") return 1;
  return 0;
}

function paymentEquivKey(p, tasksAll){
  const taskId = String(p?.fromTaskId || p?.taskId || p?.campaignId || "");
  const task = (tasksAll||[]).find(t => String(t?.id||"") === taskId);
  const courseKey = String(p?.courseKey || localStorage.getItem(KEY_ACTIVE_COURSE) || "");
  const who = String(p?.apoderadoEmail || p?.apoderadoKey || p?.apoderadoId || p?.email || "").toLowerCase().trim();
  const alumnoId = String(p?.alumnoId || "");
  let inst = inferredInstallmentIndex(p, task);

  if(!inst){
    const per = String(p?.period || ymFromISO(p?.dueDate) || ymFromISO(p?.paidAt) || "");
    inst = per ? `ym:${per}` : "single";
  }

  return [courseKey, taskId, who, alumnoId, String(inst)].join("|");
}

function suppressPendingCoveredByPaid(payments, tasksAll){
  const list = Array.isArray(payments) ? payments.slice() : [];
  const paidKeys = new Set(
    list
      .filter(p => String(p?.status||"").toLowerCase() === "paid")
      .map(p => paymentEquivKey(p, tasksAll))
  );

  return list.filter(p => {
    const st = String(p?.status||"").toLowerCase();
    if(!["pending","partial","overdue"].includes(st)) return true;
    const key = paymentEquivKey(p, tasksAll);
    return !paidKeys.has(key);
  });
}

function hasCoveredPaymentForSlot(out, ident, task, period, installmentIndex){
  const courseKey = String(ident?.courseKey || localStorage.getItem(KEY_ACTIVE_COURSE) || "").trim();
  const email = String(ident?.email||"").toLowerCase().trim();
  const apoderadoId = String(ident?.apoderadoId||email||"").trim();
  const alumnoLabel = String(ident?.alumnoLabel || ident?.studentName || ident?.alumnoName || ident?.alumnoId || "").trim();
  const aidStrong = (email || apoderadoId || "unknown_apoderado");
  const alumnoId = String(ident?.realAlumnoId || ident?.alumnoId || alumnoIdOf(courseKey, aidStrong, alumnoLabel)).trim();

  const wantedTaskId = String(task?.id || "");
  const wantedPeriod = String(period || "");
  const wantedIdx = String(installmentIndex || 1);

  return (out || []).some(p => {
    if(String(p?.status||"").toLowerCase() !== "paid") return false;
    if(String(p?.fromTaskId||"") !== wantedTaskId) return false;

    const pPeriod = String(p?.period || ymFromISO(p?.dueDate) || ymFromISO(p?.paidAt) || "");
    const pIdx = String((p?.installmentIndex==null || p?.installmentIndex==="") ? 1 : p?.installmentIndex);

    if(!(pPeriod === wantedPeriod && pIdx === wantedIdx)) return false;

    const pAid = String(p?.apoderadoKey || p?.apoderadoId || p?.apoderadoEmail || p?.email || "").toLowerCase().trim();
    const pAlu = String(p?.alumnoId || "");
    const pGuardian = String(p?.guardianName || p?.apoderadoName || "").toLowerCase().trim();
    const pStudent = String(p?.studentName || p?.alumno || "").toLowerCase().trim();

    if(pAid && pAid === aidStrong.toLowerCase() && (!pAlu || pAlu === alumnoId)) return true;
    if(pGuardian && pStudent && pGuardian === aidStrong.toLowerCase() && pStudent === alumnoLabel.toLowerCase().trim()) return true;
    return false;
  });
}

function ensurePaymentsForIdentity(ident, tasksAll, paysAll){
    ident = ident || {};
    const courseKey = String(ident.courseKey || localStorage.getItem(KEY_ACTIVE_COURSE) || "").trim();
    if(!courseKey) return paysAll || [];
    const email = String(ident.email||"").toLowerCase().trim();
    const apoderadoId = String(ident.apoderadoId||email||"").trim();
    const alumnoLabel = String(ident.alumnoLabel || ident.studentName || ident.alumnoName || ident.alumnoId || "").trim();
    const aidStrong = (email || apoderadoId || "unknown_apoderado");
    const alumnoId = String(ident.realAlumnoId || ident.alumnoId || alumnoIdOf(courseKey, aidStrong, alumnoLabel)).trim();

    const out = (paysAll||[]).slice();

    // Normaliza claves legacy (sin period / installmentIndex) para evitar duplicados
    const byKey = new Set(out.map(p=>{
      if(p && p.paymentKey) return String(p.paymentKey);
      const ck = String(p.courseKey||"").trim();
      const aid = String(p.apoderadoKey||p.apoderadoId||"").trim() || String(p.apoderadoEmail||p.email||"").toLowerCase().trim();
      const tid = String(p.fromTaskId||"");
      const per = String(p.period||ymFromISO(p.dueDate)||"");
      // ⚠️ si no existe installmentIndex, asumimos 1 (pago único o legacy)
      const idx = String((p.installmentIndex==null || p.installmentIndex==="") ? 1 : p.installmentIndex);
      const alu = String(p.alumnoId||"");
      return paymentKeyOf(ck, tid, aid, alu, per, idx);
    }));

    function pushPay(t, period, installmentIndex, dueDate, concept){
      const pk = paymentKeyOf(courseKey, t.id, aidStrong, alumnoId, period, installmentIndex);
      if(byKey.has(pk)) return;
      if(hasCoveredPaymentForSlot(out, ident, t, period, installmentIndex)) return;

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

  // --- Limpieza global de pagos duplicados (legacy) ---
  function normalizeAndDedupePaymentsFor(ident){
    ident = ident || {};
    const courseKey = String(ident.courseKey || localStorage.getItem(KEY_ACTIVE_COURSE) || "").trim();
    if(!courseKey) return;
    const email = String(ident.email||"").toLowerCase().trim();
    const apoderadoId = String(ident.apoderadoId||"").trim();
    const aidStrong = (apoderadoId || email || "unknown_apoderado");
    const alumnoLabel = String(ident.alumnoId||"").trim();
    const alumnoId = alumnoIdOf(courseKey, aidStrong, alumnoLabel);

    const paysAll = load(KEY_PAYMENTS, []);
    const map = new Map();
    for(const p0 of (paysAll||[])){
      if(!p0) continue;
      const p = { ...p0 };
      // Normaliza campos
      p.courseKey = String(p.courseKey||courseKey).trim();
      p.fromTaskId = String(p.fromTaskId||"");
      p.period = String(p.period||ymFromISO(p.dueDate)||"");
      if(p.installmentIndex==null || p.installmentIndex==="") p.installmentIndex = 1;

      // Si es de este apoderado pero está incompleto, complétalo
      const apEmail = String(p.apoderadoEmail||p.email||"").toLowerCase().trim();
      const apKey = String(p.apoderadoKey||p.apoderadoId||"").trim();
      const looksMine = (apKey && apKey===aidStrong) || (apEmail && apEmail===aidStrong);
      if(looksMine){
        if(!p.apoderadoKey) p.apoderadoKey = aidStrong;
        if(!p.apoderadoId) p.apoderadoId = aidStrong;
        if(!p.apoderadoEmail) p.apoderadoEmail = aidStrong;
        if(!p.alumnoId) p.alumnoId = alumnoId;
      }

      const keyAid = String(p.apoderadoKey||p.apoderadoId||"").trim() || String(p.apoderadoEmail||p.email||"").toLowerCase().trim();
      const keyAlu = String(p.alumnoId||"");
      const pk = paymentKeyOf(p.courseKey, p.fromTaskId, keyAid, keyAlu, p.period, p.installmentIndex);
      p.paymentKey = pk;

      const prev = map.get(pk);
      if(!prev){ map.set(pk, p); continue; }
      // Preferimos el más "completo" y/o pagado
      const score = (x)=>{
        let s=0;
        if(String(x.status||"")==="paid") s+=100;
        if(x.alumnoId) s+=10;
        if(x.apoderadoKey) s+=5;
        if(x.period) s+=2;
        if(x.installmentIndex) s+=1;
        if(x.paymentKey) s+=1;
        return s;
      };
      if(score(p) > score(prev)) map.set(pk, p);
    }
    const cleaned = Array.from(map.values());
    if(JSON.stringify(cleaned) !== JSON.stringify(paysAll)){
      save(KEY_PAYMENTS, cleaned);
    }
  }


  const esc = (s)=> String(s??"").replace(/[&<>'"]/g,c=>({ "&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;" }[c]));
  const clp = (n)=> "$"+Number(n||0).toLocaleString("es-CL");
  // Fase 2B: un pago válido debe venir desde Supabase (UUID de tabla pagos.id).
  // Los IDs legacy tipo pay_xxx son caché local antigua y NO deben abrir pay.html.
  const isSupabaseUuid = (v)=> /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v||""));
  function onlySupabasePayments(list){
    return (Array.isArray(list) ? list : []).filter(p => isSupabaseUuid(p?.id || p?.remoteId));
  }

  // ✅ alias usado en copy (WhatsApp/UI)
  function formatCLP(n){ return clp(n); }
  // ---------------- Cotizaciones (Gira / Graduación) ----------------
  function normStr(x){ return String(x??"").trim(); }
  function normalizeUrl(u){
    const s = normStr(u);
    if(!s) return "";
    if(/^https?:\/\//i.test(s)) return s;
    return "https://" + s;
  }
  function normalizeCotizaciones(task){
    const raw = [];
    try{
      if(Array.isArray(task?.cotizaciones)) raw.push(...task.cotizaciones);
      if(Array.isArray(task?.quotes)) raw.push(...task.quotes);
      if(task?.cotizacion && typeof task.cotizacion === "object") raw.push(task.cotizacion);
    }catch(e){}
    const out = [];
    const seen = new Set();
    for(const it of raw){
      if(!it) continue;
      const nombre = normStr(it.nombre || it.name || it.titulo || it.item);
      const descripcion = normStr(it.descripcion || it.desc || it.texto || it.comentario || it.comment);
      const url = normalizeUrl(it.url || it.link);
      const monto = Number(it.montoTotal ?? it.monto_total ?? it.total ?? it.monto ?? 0) || 0;
      const key = `${nombre.toLowerCase()}|${monto}|${url.toLowerCase()}|${descripcion.toLowerCase()}`;
      if(seen.has(key)) continue;
      seen.add(key);
      out.push({ nombre, descripcion, url, monto });
    }
    return out;
  }

  function openModalSheet(title, subtitle, bodyHtml){
    if(!modalRoot){ alert("Falta #modalRoot"); return; }
    modalRoot.innerHTML = `
      <div style="position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:10000;display:flex;align-items:flex-end;justify-content:center;padding:14px;">
        <div class="card" style="width:min(820px,100%);max-height:calc(100vh - 28px);overflow:auto;-webkit-overflow-scrolling:touch;margin-bottom:12px;">
          <div class="row" style="align-items:flex-start;gap:12px;">
            <div>
              <div style="font-weight:950;font-size:22px;">${esc(title)}</div>
              <div class="muted" style="margin-top:6px;">${esc(subtitle||"")}</div>
            </div>
            <button class="btnx" onclick="closeModal()">Cerrar</button>
          </div>
          <div style="margin-top:12px;">${bodyHtml}</div>
        </div>
      </div>
    `;
  }

  function openCotizacionesModal(taskId){
    const tasksAll = normalizeTasks(load(KEY_TASKS, []));
    const t = tasksAll.find(x=>String(x.id)===String(taskId));
    if(!t){ toast("No se encontró la campaña", false); return; }
    const items = normalizeCotizaciones(t);
    if(!items.length){ toast("No hay cotizaciones", false); return; }
    const total = items.reduce((a,it)=>a+Number(it.monto||0),0);
    const body = `
      <div class="card" style="padding:12px 14px;margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
          <div style="font-weight:950;">Total cotizado</div>
          <div style="font-weight:950;">${formatCLP(total)}</div>
        </div>
      </div>
      ${items.map(it=>`
        <div class="card" style="padding:12px 14px;margin-bottom:10px;">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
            <div style="font-weight:950;">${esc(it.nombre||"Ítem")}</div>
            <div style="font-weight:950;">${formatCLP(it.monto||0)}</div>
          </div>
          ${it.descripcion ? `<div class="muted" style="margin-top:6px;"><b>Descripción:</b> ${esc(it.descripcion)}</div>` : ``}
          ${it.url ? `<div class="muted" style="margin-top:6px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
              <div style="word-break:break-all;"><b>URL:</b> ${esc(it.url)}</div>
              <a class="btnx" style="padding:8px 10px;border:1px solid rgba(0,0,0,.12);" href="${esc(it.url)}" target="_blank" rel="noopener">🔗</a>
            </div>` : ``}
        </div>
      `).join("")}
    `;
    openModalSheet("Cotizaciones", `${t.title||"Campaña"} · ${items.length} ítem(s)`, body);
  }


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

  function normalizePaymentStatus(p){
    const st = String(p?.status || "").toLowerCase();
    if(st === "paid" || st === "partial" || st === "overdue" || st === "credit" || st==="credit_used") return st;
    const due = String(p?.dueDate || "").slice(0,10);
    const today = new Date().toISOString().slice(0,10);
    if(due && due < today) return "overdue";
    return "pending";
  }

  function dashboardFinancieroApoderado(pays){
    const list = Array.isArray(pays) ? pays.slice() : [];
    let pagado = 0;
    let pendiente = 0;
    let vencido = 0;
    let parcial = 0;
    let saldoFavor = 0;

    list.forEach(p=>{
      const st = normalizePaymentStatus(p);
      const amt = Number(p?.amount ?? 0);
      const rem = Number(p?.amountRemaining ?? amt ?? 0);
      const paidAmt = Number(
        st === "paid"
          ? (p?.amount ?? p?.amountPaid ?? 0)
          : (p?.amountPaid ?? Math.max(0, amt - rem))
      );

      if(st === "paid") pagado += paidAmt || amt;
      else if(st === "overdue") vencido += rem || amt;
      else if(st === "partial"){
        parcial += rem;
        pendiente += rem;
      }
      else if(st === "credit" || st === "credit_used") saldoFavor += Number(p?.amount || 0);
      else pendiente += rem || amt;
    });

    const totalGestionado = pagado + pendiente + vencido;
    const cumplimiento = totalGestionado > 0 ? Math.round((pagado / totalGestionado) * 100) : 0;

    return { pagado, pendiente, vencido, parcial, saldoFavor, cumplimiento };
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
    // Cursapp v11-clean: demo seed desactivado.
    // Los estados vacíos se deben mostrar con datos reales del curso.
    return;
  }

  // -------- Modal --------
  function openModal(html){
    const root = modalRoot || document.getElementById("modalRoot");
    if(!root){ alert("Falta #modalRoot"); return; }

    root.innerHTML = `
      <div style="
        position:fixed;
        inset:0;
        background:rgba(15,23,42,.55);
        z-index:99999;
        display:flex;
        align-items:flex-end;
        justify-content:center;
        padding:14px;
      " onclick="closeModal(event)">

        <div id="modalCard" style="
          background:#ffffff;
          width:100%;
          max-width:820px;
          max-height:85vh;
          border-top-left-radius:24px;
          border-top-right-radius:24px;
          box-shadow:0 -10px 40px rgba(0,0,0,.25);
          overflow:auto;
          -webkit-overflow-scrolling:touch;
          padding:0;
          margin-bottom:12px;
        " onclick="event.stopPropagation()">
          ${html}
        </div>

      </div>
    `;

    // Bloquea scroll del body para que el sticky dentro del modal funcione en iOS
    try{ document.body.style.overflow = "hidden"; }catch(e){}
  }

  function closeModal(e){
    // si se hace click dentro del modalCard, no cerrar
    if(e && e.target && e.currentTarget && e.target !== e.currentTarget) return;

    const root = modalRoot || document.getElementById("modalRoot");
    if(root) root.innerHTML = "";

    try{ document.body.style.overflow = ""; }catch(err){}
  }

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
    const activeCourse = String(localStorage.getItem(KEY_ACTIVE_COURSE) || s.courseKey || "").trim();

    function parseMaybeJson(raw){
      if(raw == null) return null;
      if(typeof raw === "object") return raw;
      const str = String(raw || "").trim();
      if(!str) return null;
      try{
        let obj = JSON.parse(str);
        // Soporta JSON doble: "{\"alumno\":...}"
        if(typeof obj === "string" && obj.trim().startsWith("{")) obj = JSON.parse(obj);
        return obj;
      }catch(e){ return null; }
    }

    function norm(v){
      return String(v || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ");
    }

    const alumnoLocal = parseMaybeJson(localStorage.getItem("cursapp_alumno_activo_v1"));
    const alumnoSession = parseMaybeJson(s.alumnoActivo);
    const alumnoActivo = alumnoSession || alumnoLocal || null;

    const idCandidates = [];
    const addId = (v)=>{ const x = String(v || "").trim(); if(x && !idCandidates.includes(x)) idCandidates.push(x); };

    addId(s.profileId);
    addId(s.activeProfile);
    addId(s.activeProfileId);
    addId(localStorage.getItem("cursapp_active_member_profile_v1"));
    addId(alumnoActivo && alumnoActivo.profileId);

    const rawActiveProfile = localStorage.getItem(KEY_ACTIVE_PROFILE) || "";
    const parsedActiveProfile = parseMaybeJson(rawActiveProfile);
    if(parsedActiveProfile){
      addId(parsedActiveProfile.profileId || parsedActiveProfile.id || parsedActiveProfile.activeProfile);
      if(!alumnoActivo && (parsedActiveProfile.alumno || parsedActiveProfile.nombre)){
        try{ localStorage.setItem("cursapp_alumno_activo_v1", JSON.stringify(parsedActiveProfile)); }catch(e){}
      }
    }else{
      addId(rawActiveProfile);
    }

    const miembroCandidates = [];
    const addMiembro = (v)=>{ const x = String(v || "").trim(); if(x && !miembroCandidates.includes(x)) miembroCandidates.push(x); };
    addMiembro(s.activeMiembro);
    addMiembro(s.miembroId);
    addMiembro(localStorage.getItem("cursapp_active_miembro_id_v1"));
    addMiembro(alumnoActivo && alumnoActivo.miembroId);
    addMiembro(parsedActiveProfile && parsedActiveProfile.miembroId);

    // 1) Perfiles solo del usuario logueado y, si existe, del curso activo.
    let mine = profiles.filter(p=>{
      const pEmail = String(p?.apoderado?.email || p?.user?.email || "").trim().toLowerCase();
      const pUserId = String(p?.userId || p?.user?.userId || "");
      const okUser = (sessionEmail && pEmail === sessionEmail) || (s.userId && pUserId === String(s.userId));
      const okCourse = !activeCourse || String(p?.courseKey || "") === String(activeCourse);
      return okUser && okCourse;
    });

    // Fallback: si no encontró por usuario, al menos respeta curso.
    if(!mine.length && activeCourse){
      mine = profiles.filter(p => String(p?.courseKey || "") === String(activeCourse));
    }
    if(!mine.length) mine = profiles.slice();

    // 2) Match estricto por profileId/id.
    for(const id of idCandidates){
      const byId = mine.find(p => String(p?.profileId || p?.id || "") === id);
      if(byId){
        try{ localStorage.setItem(KEY_ACTIVE_PROFILE, String(byId.profileId || byId.id || id)); }catch(e){}
        return byId;
      }
    }

    // 3) Match por miembro_id de Supabase.
    for(const mid of miembroCandidates){
      const byMid = mine.find(p => String(p?.supabase?.miembro_id || p?.miembro_id || "") === mid);
      if(byMid){
        try{ localStorage.setItem(KEY_ACTIVE_PROFILE, String(byMid.profileId || byMid.id || "")); }catch(e){}
        return byMid;
      }
    }

    // 4) Match por alumno seleccionado + curso + email.
    const alumnoName = norm(alumnoActivo && (alumnoActivo.alumno || alumnoActivo.nombre || alumnoActivo.name));
    if(alumnoName){
      const byAlumno = mine.find(p => norm(p?.apoderado?.alumno || p?.alumno || p?.nombre_alumno) === alumnoName);
      if(byAlumno){
        try{
          localStorage.setItem(KEY_ACTIVE_PROFILE, String(byAlumno.profileId || byAlumno.id || ""));
          localStorage.setItem("cursapp_active_member_profile_v1", String(byAlumno.profileId || byAlumno.id || ""));
          if(byAlumno?.supabase?.miembro_id) localStorage.setItem("cursapp_active_miembro_id_v1", String(byAlumno.supabase.miembro_id));
          const fixedAlumno = Object.assign({}, alumnoActivo || {}, {
            nombre: byAlumno?.apoderado?.alumno || alumnoActivo?.nombre || "",
            alumno: byAlumno?.apoderado?.alumno || alumnoActivo?.alumno || "",
            email: byAlumno?.apoderado?.email || sessionEmail || "",
            courseKey: byAlumno?.courseKey || activeCourse || "",
            profileId: byAlumno?.profileId || byAlumno?.id || "",
            miembroId: byAlumno?.supabase?.miembro_id || alumnoActivo?.miembroId || ""
          });
          localStorage.setItem("cursapp_alumno_activo_v1", JSON.stringify(fixedAlumno));
        }catch(e){}
        return byAlumno;
      }
    }

    // 5) Último fallback: perfil activo por curso.
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
      whoCourseLine.textContent = "Curso no seleccionado";
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
  function receiptAmountPaid(p){
    const amt = Number(
      p?.amountPaid ??
      p?.amount ??
      ((Number(p?.amountOriginal ?? p?.amount ?? 0) - Number(p?.amountRemaining ?? 0)) || 0)
    );
    return Math.max(0, amt || 0);
  }

  function receiptSortDate(p){
    const raw = p?.paidAt || p?.createdAt || p?.updatedAt || "";
    const d = raw ? new Date(raw) : null;
    return d && !isNaN(d.getTime()) ? d.getTime() : 0;
  }

  function sameReceiptOwner(a,b){
    const ae = String(a?.apoderadoEmail || a?.email || a?.apoderadoKey || a?.apoderadoId || "").toLowerCase().trim();
    const be = String(b?.apoderadoEmail || b?.email || b?.apoderadoKey || b?.apoderadoId || "").toLowerCase().trim();
    const aa = String(a?.alumnoId || "").trim();
    const ba = String(b?.alumnoId || "").trim();
    const as = String(a?.studentName || a?.alumno || "").toLowerCase().trim();
    const bs = String(b?.studentName || b?.alumno || "").toLowerCase().trim();

    if(ae && be && ae !== be) return false;
    if(aa && ba && aa !== ba) return false;
    if(as && bs && as !== bs) return false;
    return true;
  }

  function resolveReceiptPayment(id){
    const pays = load(KEY_PAYMENTS, []);
    const base = pays.find(x=>String(x.id)===String(id));
    if(!base) return null;

    // Si por datos legacy el id apunta a un registro antiguo con monto 0,
    // buscamos el pago pagado más reciente de la misma campaña/apoderado/alumno.
    const candidates = pays
      .filter(p=>String(p?.status||"").toLowerCase()==="paid")
      .filter(p=>String(p?.fromTaskId||"")===String(base?.fromTaskId||""))
      .filter(p=>sameReceiptOwner(p, base))
      .sort((a,b)=> receiptSortDate(b) - receiptSortDate(a));

    const better = candidates.find(p=>receiptAmountPaid(p)>0);
    return better || base;
  }

  window.openReceipt = function(id){
    const p = resolveReceiptPayment(id);
    if(!p) return;

    const task = load(KEY_TASKS,[]).find(t=>String(t.id||"")===String(p.fromTaskId||""));
    const campaign = task?.title || p.campaignTitle || p.concept || "Pago";
    const amountPaid = receiptAmountPaid(p);
    const amountPending = Math.max(0, Number(p.amountRemaining ?? 0));

    const paidAtDate = p.paidAt ? new Date(p.paidAt) : null;
    const paidAtFull = (paidAtDate && !isNaN(paidAtDate.getTime())) ? paidAtDate.toLocaleString("es-CL") : "—";
    const paidDateShort = (paidAtDate && !isNaN(paidAtDate.getTime()))
      ? paidAtDate.toLocaleDateString("es-CL", { day:"2-digit", month:"short", year:"numeric" })
      : "—";
    const paidTimeShort = (paidAtDate && !isNaN(paidAtDate.getTime()))
      ? paidAtDate.toLocaleTimeString("es-CL", { hour:"2-digit", minute:"2-digit" })
      : "";

    const rawMethod = String(p.paymentMethod || p.paidWith || "—").toLowerCase();
    const methodLabel = ({
      transbank:"💳 Transbank",
      transferencia:"🏦 Transferencia",
      efectivo:"💵 Efectivo",
      saldo_favor:"🔁 Saldo a favor",
      credit:"🔁 Saldo a favor"
    })[rawMethod] || (p.paymentMethod || p.paidWith || "—");

    const auth = p.webpay?.authorizationCode || p.webpay?.authorization_code || "—";
    const resp = p.webpay?.responseCode || p.webpay?.response_code || "—";
    const op = p.transactionId || p.webpay?.buyOrder || p.receiptId || p.id || "—";
    const folioBase = String(p.receiptId || p.transactionId || p.id || "0").replace(/[^a-zA-Z0-9]/g,"").slice(-8).toUpperCase() || "00000000";
    const folio = `CP-${new Date().getFullYear()}-${folioBase}`;

    const isManual = String(p.source||"").toLowerCase()==="manual";
    const isConciliated = String(p.conciliationStatus||"").toLowerCase()==="conciliado";
    const statusLabel = isManual || isConciliated ? "✔ Registrado por tesorería" : "✔ Pago confirmado";

    openModal(`
      <div style="background:#fff;border-radius:28px;overflow:hidden;">
        <div style="padding:18px 18px 12px;border-bottom:1px solid rgba(0,0,0,.08);display:flex;justify-content:space-between;gap:12px;align-items:flex-start;">
          <div>
            <div style="font-weight:950;font-size:12px;letter-spacing:.08em;color:#64748b;">CURSAPP</div>
            <div style="font-weight:950;font-size:26px;margin-top:4px;">🧾 Comprobante de pago</div>
            <div class="muted" style="margin-top:6px;">${esc(isManual ? "Pago manual registrado correctamente" : "Pago procesado correctamente")}</div>
          </div>
          <button class="btnx" onclick="closeModal()">Cerrar</button>
        </div>

        <div style="padding:18px;">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;">
            <span style="display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border-radius:999px;background:#ecfdf5;border:1px solid #bbf7d0;color:#166534;font-weight:900;">● PAGADO</span>
            <span class="muted" style="font-weight:900;">Folio ${esc(folio)}</span>
          </div>

          <div style="margin-top:14px;border:1px solid rgba(0,0,0,.08);border-radius:22px;padding:20px;background:linear-gradient(180deg,#f8fafc,#ffffff);text-align:center;">
            <div class="muted" style="font-weight:900;font-size:12px;letter-spacing:.05em;">MONTO PAGADO</div>
            <div style="font-size:38px;font-weight:950;margin-top:6px;line-height:1;">${clp(amountPaid)}</div>
            <div class="muted" style="margin-top:8px;">${amountPending>0 ? `Saldo pendiente ${clp(amountPending)}` : `Sin saldo pendiente`}</div>
          </div>

          <div style="margin-top:14px;border:1px solid rgba(0,0,0,.08);border-radius:18px;overflow:hidden;background:#fff;">
            ${[
              ["Campaña", campaign],
              ["Concepto", p.concept || "—"],
              ["Alumno", p.studentName || p.alumno || "—"],
              ["Apoderado", p.guardianName || p.apoderadoName || p.apoderadoEmail || p.email || "—"],
              ["Fecha", paidDateShort !== "—" ? `${paidDateShort}${paidTimeShort ? " · " + paidTimeShort : ""}` : "—"],
              ["Método", methodLabel],
              ["Operación", op],
              ["Autorización", auth],
              ["Resp. code", resp],
            ].map((row, idx)=>`
              <div style="display:flex;justify-content:space-between;gap:16px;padding:13px 14px;${idx<8?'border-bottom:1px solid rgba(0,0,0,.06);':''}">
                <div class="muted" style="font-weight:800;">${esc(row[0])}</div>
                <div style="font-weight:900;text-align:right;max-width:62%;">${esc(row[1])}</div>
              </div>
            `).join("")}
          </div>

          <div style="margin-top:14px;padding:12px 14px;border-radius:16px;background:#f8fafc;border:1px solid rgba(0,0,0,.06);display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;">
            <div style="font-weight:900;color:#0f766e;">${esc(statusLabel)}</div>
            <div class="muted" style="font-size:12px;">Emitido ${esc(paidAtFull)}</div>
          </div>
        </div>
      </div>
    `);
  };


// -------- Reports --------
  function reports(){ return load(KEY_REPORTS, []); }
  function latestReport(){ const r = reports(); return r.length ? r[0] : null; }

  function reportSummaryCard(){
    const r = latestReport();
    try{ if(window.runAutoAvisosContext) window.runAutoAvisosContext({ payments: paysAll, tasks: tasks0, reports: reports() }); }catch(e){}
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

  const currentYM = ()=>{
    const d=new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
  };
  const pct = (a,b)=>{
    const A=Number(a||0), B=Number(b||0);
    if(B<=0) return 0;
    return Math.max(0, Math.min(100, Math.round((A/B)*100)));
  };

  
  const isExcludedStatus = (p)=>{
    const st = String(p?.status||"").toLowerCase();
    return st==="opted_out" || st==="void" || st==="cancelled";
  };
const ym = currentYM();
  const tasks = load(KEY_TASKS, []);
  const pays = load(KEY_PAYMENTS, []);

  // Totales del mes (proyección y cobrado) + deudores únicos
  let cobradoMes=0, proyeccionMes=0;
  const deudoresSet = new Set();

  (pays||[]).forEach(p=>{
    if(!p) return;
    if(isExcludedStatus(p)) return;

    const dueYM = String(p.dueDate||"").slice(0,7);
    const perYM = String(p.period||"").slice(0,7);
    const matchYM = (dueYM===ym) || (perYM===ym);
    if(!matchYM) return;

    const amt = Number(p.amount || p.amountRemaining || 0);
    proyeccionMes += amt;

    if(String(p.status||"")==="paid"){
      cobradoMes += Number(p.amount||0);
    }else{
      const pid = String(p.payerProfileId || p.profileId || p.userId || "");
      if(pid) deudoresSet.add(pid);
    }
  });

  const cursoPct = pct(cobradoMes, proyeccionMes);
  const sem = (cursoPct>=80) ? "🟢" : (cursoPct>=45 ? "🟡" : "🔴");
  const semMsg = (cursoPct>=80)
    ? "Vamos muy bien este mes"
    : (cursoPct>=45 ? "Vamos avanzando, aún falta un poco" : "Atención: queda bastante por pagar este mes");

  // Agrupar pagos por campaña
  const byTask = {};
  (pays||[]).forEach(p=>{
    const tid = String((p && p.fromTaskId) || "");
    if(!tid) return;
    if(isExcludedStatus(p)) return;
    (byTask[tid] ||= []).push(p);
  });

  const cardStyle = "background:#fff;border:1px solid rgba(0,0,0,.08);border-radius:18px;padding:14px;";

  const kpi = (icon, label, val)=>`
    <div style="${cardStyle}">
      <div style="font-size:13px;opacity:.75;">${icon} ${esc(label)}</div>
      <div style="font-size:22px;font-weight:950;margin-top:6px;">${val}</div>
    </div>
  `;

  const campRows = (tasks||[])
    .filter(t=>t && !t.closed)
    .map(t=>{
      const tid = String(t.id);
      const title = String(t.title || "Campaña");
      const type = String(t.type || "single");
      const months = Number(t.months || 1);
      const amount = Number(t.amount || 0);
      const meta = Number(t.goalTotal || 0);

      const ps = (byTask[tid] || []);

      const recaudado = ps
        .filter(x=>String(x.status||"")==="paid")
        .reduce((a,x)=>a+Number(x.amount||0),0);

      const pendienteMes = ps
        .filter(x=>String(x.status||"")!=="paid")
        .filter(x=>{
          const dym = String(x.dueDate||"").slice(0,7);
          const pym = String(x.period||"").slice(0,7);
          return (dym===ym)||(pym===ym);
        })
        .reduce((a,x)=>a+Number(x.amountRemaining||x.amount||0),0);

      // Objetivo (total curso):
      // - Si el usuario definió goalTotal/meta => lo respetamos como total de curso.
      // - Si no, lo calculamos como (monto por apoderado) x (participantes) x (cuotas si mensual)
      //   Esto evita el bug de ver 100% con 1 pago cuando hay 2 apoderados.
      let objetivo;
      if(meta>0){
        objetivo = meta;
      }else{
        const base = (type==="monthly" ? (amount*months) : amount);
        const mandatory = (t.mandatoryParticipation !== undefined) ? !!t.mandatoryParticipation : true;
        let n = 0;

        if(!mandatory){
          // voluntaria: contamos participantes reales (excluye opted_out)
          const s = new Set();
          for(const x of ps){
            if(!x) continue;
            if(isExcludedStatus(x)) continue;
            const k = String(x.apoderadoKey||x.apoderadoEmail||x.payerProfileId||x.profileId||x.userId||x.email||"").toLowerCase().trim();
            if(k) s.add(k);
          }
          n = s.size;
        }
        if(!n){
          // fallback: apoderados del curso (evita 0 / y cubre obligatorias)
          n = apoderadosCountInCourse ? apoderadosCountInCourse() : 0;
        }
        if(!n) n = 1;
        objetivo = base * n;
      }
      const p = pct(recaudado, objetivo);

      return `
        <div style="${cardStyle}">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
            <div style="font-weight:950;">${esc(title)}</div>
            <div style="font-weight:950;">${p}%</div>
          </div>

          <div style="margin-top:8px;height:10px;background:#eef2ff;border-radius:999px;overflow:hidden;">
            <div style="height:100%;width:${p}%;background:#4f46e5;border-radius:999px;"></div>
          </div>

          <div style="margin-top:10px;display:flex;gap:10px;flex-wrap:wrap;font-size:13px;opacity:.9;">
            <div>💰 Recaudado: <b>${clp(recaudado)}</b></div>
            <div>⏳ Pendiente mes: <b>${clp(pendienteMes)}</b></div>
            <div>🎯 Objetivo: <b>${clp(objetivo)}</b></div>
          </div>
        </div>
      `;
    }).join("");

  openModal(`
    <div style="max-width:900px;margin:auto;">
      <div style="
        background:#ffffff;
        border-radius:22px;
        border:1px solid rgba(0,0,0,.10);
        box-shadow:0 20px 60px rgba(0,0,0,.25);
        padding:0;
        overflow:hidden;
      ">

        <div style="
          position:sticky;
          top:0;
          z-index:20;
          background:#ffffff;
          padding:12px 16px;
          border-bottom:1px solid rgba(0,0,0,.08);
        ">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
            <div>
              <div style="font-weight:950;font-size:18px;line-height:1.1;">Informe del curso</div>
              <div style="opacity:.65;font-size:13px;margin-top:4px;line-height:1.2;">
                Resumen de cómo va el curso (montos globales, no personales)
              </div>
            </div>
            <button onclick="closeModal()"
              style="
                border:1px solid rgba(0,0,0,.12);
                background:#fff;
                border-radius:999px;
                padding:8px 14px;
                font-weight:800;
                cursor:pointer;
                flex:0 0 auto;
              ">
              Cerrar
            </button>
          </div>
        </div>

        <div style="padding:16px;">

          <div style="margin-top:2px;${cardStyle}background:#f8fafc;">
            <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
              <div>
                <div style="font-weight:950;font-size:16px;">${sem} Cumplimiento del mes</div>
                <div style="font-size:13px;opacity:.75;margin-top:2px;">${esc(semMsg)} · <b>${esc(ym)}</b></div>
              </div>
              <div style="font-weight:950;font-size:18px;">${cursoPct}%</div>
            </div>

            <div style="margin-top:10px;height:12px;background:#e5e7eb;border-radius:999px;overflow:hidden;">
              <div style="height:100%;width:${cursoPct}%;background:#16a34a;border-radius:999px;"></div>
            </div>

            <div style="margin-top:8px;font-size:13px;opacity:.9;">
              💵 Cobrado mes: <b>${clp(cobradoMes)}</b> · ⏳ Proyección mes: <b>${clp(proyeccionMes)}</b> · 👥 Deudores mes: <b>${deudoresSet.size}</b>
            </div>
          </div>

          <div style="margin-top:14px;display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            ${kpi("💰","Recaudado total", clp(r.recaudadoCurso||0))}
            ${kpi("🧾","Gastado total", clp(r.gastadoCurso||0))}
            ${kpi("🏦","Saldo disponible", clp(r.disponibleCurso||0))}
            ${kpi("⏳","Por cobrar este mes", clp(proyeccionMes - cobradoMes))}
          </div>

          <div style="margin-top:16px;">
            <div style="font-weight:950;font-size:16px;margin-bottom:10px;">📌 Indicadores por campaña</div>
            <div style="display:grid;gap:10px;">
              ${campRows || `<div style="opacity:.7;font-size:13px;">No hay campañas activas.</div>`}
            </div>
          </div>

          <div class="muted" style="margin-top:14px;font-size:12px;">
            Emitido: ${esc(r.generatedAt||"")}
          </div>

        </div>
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


// -------- Deduplicación de pagos (estabilidad) --------
function paymentStableKey(p){
  const cid = String(p.fromTaskId || p.taskId || p.campaignId || "");
  const who = String(p.apoderadoId || p.userId || p.payerId || p.email || p.payerEmail || "").toLowerCase();
  const cuota = String(p.cuotaNumero || p.installment || p.cuota || "");
  const due = String(p.dueDate || "");
  const amt = String(Number(p.amountRemaining ?? p.amount ?? p.monto ?? 0));
  const typ = String(p.type || p.kind || "");
  return [cid, who, cuota, due, amt, typ].join("|");
}

function dedupePaymentsAll(list){
  const map = new Map();
  let changed = false;

  (list || []).forEach(p=>{
    if(!p) return;
    const k = paymentStableKey(p);
    const prev = map.get(k);
    if(!prev){
      map.set(k, p);
      return;
    }
    // Preferimos "paid" sobre "pending" y el que tenga menor amountRemaining
    const prevPaid = String(prev.status||"").toLowerCase()==="paid";
    const curPaid  = String(p.status||"").toLowerCase()==="paid";
    if(curPaid && !prevPaid){
      map.set(k, p); changed = true; return;
    }
    const prevRem = Number(prev.amountRemaining ?? prev.amount ?? 0);
    const curRem  = Number(p.amountRemaining ?? p.amount ?? 0);
    if(curRem < prevRem){
      map.set(k, p); changed = true; return;
    }
    // si son iguales, mantenemos el primero
    changed = true;
  });

  return { list: Array.from(map.values()), changed };
}


// --- FIX v11: dedupe canónico para cambio Presidente -> Apoderado sin cerrar sesión ---
function paymentCanonicalKeyV11(p, tasksAll){
  const taskId = String(p?.fromTaskId || p?.taskId || p?.campaignId || "").trim();
  const task = (tasksAll||[]).find(t => String(t?.id||"") === taskId);
  const courseKey = String(p?.courseKey || localStorage.getItem(KEY_ACTIVE_COURSE) || "").trim();
  const owner = String(p?.apoderadoKey || p?.apoderadoEmail || p?.apoderadoId || p?.email || meKey() || "").toLowerCase().trim();
  const ident = (typeof getActiveIdentity==="function") ? getActiveIdentity() : {};
  const alumno = String(p?.alumnoId || p?.studentId || p?.studentName || p?.alumno || ident?.realAlumnoId || ident?.alumnoId || ident?.alumnoLabel || "").toLowerCase().trim();
  const period = String(p?.period || ymFromISO(p?.dueDate) || "").trim();
  let idx = String(p?.installmentIndex || p?.cuotaNumero || p?.installment || p?.cuota || "").trim();

  if(!idx){
    const c = String(p?.concept || "");
    const m = c.match(/cuota\s*(\d+)\s*\/\s*\d+/i) || c.match(/cuota\s*(\d+)/i);
    if(m) idx = String(Number(m[1]||1));
  }
  if(!idx) idx = String(String(task?.type||"single")==="monthly" ? (period || "ym") : "1");

  return [courseKey, taskId, owner, alumno, period, idx].join("|");
}

function preferPaymentRecordV11(a,b){
  const score = (x)=>{
    const st = String(x?.status||"").toLowerCase();
    let s = 0;
    if(st === "paid") s += 1000;
    if(st === "partial") s += 600;
    if(st === "pending" || st === "overdue") s += 400;
    if(x?.paymentKey) s += 40;
    if(x?.apoderadoKey || x?.apoderadoEmail || x?.apoderadoId) s += 30;
    if(x?.alumnoId) s += 20;
    if(x?.period) s += 10;
    if(x?.installmentIndex) s += 10;
    if(x?.createdAt) s += 1;
    return s;
  };
  return score(b) > score(a) ? b : a;
}

function dedupePaymentsCanonicalV11(list, tasksAll){
  const out = new Map();
  let changed = false;
  (list || []).forEach(p=>{
    if(!p) return;
    const k = paymentCanonicalKeyV11(p, tasksAll);
    const prev = out.get(k);
    if(!prev){ out.set(k,p); return; }
    out.set(k, preferPaymentRecordV11(prev,p));
    changed = true;
  });
  return { list:Array.from(out.values()), changed };
}

function cleanVisiblePaymentsV11(pays, tasksAll){
  let list = Array.isArray(pays) ? pays.slice() : [];
  let changed = false;
  const d1 = dedupePaymentsAll(list);
  if(d1.changed){ list = d1.list; changed = true; }
  const d2 = dedupePaymentsCanonicalV11(list, tasksAll || []);
  if(d2.changed){ list = d2.list; changed = true; }
  list = suppressPendingCoveredByPaid(list, tasksAll || []);
  return { list, changed };
}

  // -------- Pages --------
  
  function cpV5DaysText(dueDate){
    const s = String(dueDate||"").slice(0,10);
    if(!s) return "";
    const today = new Date(new Date().toISOString().slice(0,10)+"T00:00:00");
    const due = new Date(s+"T00:00:00");
    if(isNaN(due.getTime())) return "";
    const days = Math.round((due.getTime()-today.getTime())/86400000);
    if(days < 0) return `Vencida hace ${Math.abs(days)} día(s)`;
    if(days === 0) return "Vence hoy";
    return `Quedan ${days} día(s)`;
  }

  function cpV5DateShort(iso){
    const s = String(iso||"").slice(0,10);
    if(!s) return "—";
    const d = new Date(s+"T00:00:00");
    if(isNaN(d.getTime())) return s;
    return d.toLocaleDateString("es-CL",{day:"2-digit",month:"short",year:"numeric"});
  }

  function cpV5DueItems(){
    try{
      const tasks = normalizeTasks(load(KEY_TASKS, []));
      let list = load(KEY_PAYMENTS, []);
      try{ list = cleanVisiblePaymentsV11(list, tasks).list; }catch(e){}
      // Fase 2B: Home no debe usar cobros locales legacy tipo pay_xxx.
      // Solo los pagos con UUID real de Supabase pueden abrir pay.html.
      list = onlySupabasePayments(list);
      return list
        .filter(isMinePayment)
        .filter(p=>!isPaymentOptedOut(p))
        .filter(p=>["pending","partial","overdue"].includes(String(p.status||"").toLowerCase()))
        .map(p=>{
          const task = tasks.find(t=>String(t.id||"")===String(p.fromTaskId||""));
          return { id:p.id, title: task?.title || p.campaignTitle || p.concept || "Pago", amount:Number(p.amountRemaining ?? p.amount ?? 0), dueDate:p.dueDate || task?.dueDate || "", raw:p };
        })
        .filter(x=>x.amount>0)
        .sort((a,b)=>String(a.dueDate||"9999").localeCompare(String(b.dueDate||"9999")));
    }catch(e){ return []; }
  }

  function cpV5OpenPayment(paymentId){
    try{
      if(typeof go === "function") go("payments");

      // Guardar pago seleccionado para que la vista de pagos pueda resaltarlo/abrirlo si aplica.
      try{ localStorage.setItem("cursapp_selected_payment", String(paymentId||"")); }catch(_){}

      setTimeout(()=>{
        try{
          const pid = String(paymentId||"");
          const escId = (window.CSS && CSS.escape) ? CSS.escape(pid) : pid.replace(/["\\]/g,"\\$&");
          const btn =
            document.querySelector(`[data-pay-id="${escId}"]`) ||
            document.querySelector(`[data-payment-id="${escId}"]`) ||
            document.querySelector(`[onclick*="${escId}"]`) ||
            document.querySelector(".payBtn,[onclick*='openPay'],[onclick*='pay']");
          if(btn) btn.click();
        }catch(e){}
      },160);
    }catch(e){
      try{ if(typeof go === "function") go("payments"); }catch(_){}
    }
  }
  window.cpV5OpenPayment = cpV5OpenPayment;

  function cpV5NextDues(){
    const items = cpV5DueItems();
    if(!items.length){
      return `<section class="cpV5Next"><div class="cpV5NextHead"><div class="cpV5Icon">📅</div><div class="cpV5Kicker">Próxima cuota</div></div><div style="padding:0 18px 18px;"><div class="cpV5DueCard" style="min-width:100%;"><div class="cpV5DueTitle">Todo al día</div><div class="cpV5DueMeta">No tienes pagos urgentes por ahora.</div><div class="cpV5Actions"><button class="cpV5Pay" onclick="go('payments')">Ver pagos</button></div></div></div></section>`;
    }
    return `<section class="cpV5Next"><div class="cpV5NextHead"><div class="cpV5Icon">📅</div><div class="cpV5Kicker">Próxima cuota</div></div><div class="cpV5Carousel">${items.slice(0,6).map((x,i)=>`<article class="cpV5DueCard"><div class="cpV5DueIndex">${i+1} de ${items.length}</div><div class="cpV5DueTitle">${esc(x.title)}</div><div class="cpV5DueMeta">Vence el ${esc(cpV5DateShort(x.dueDate))} <span class="cpV5Badge">${esc(cpV5DaysText(x.dueDate))}</span></div><div class="cpV5Amount">${clp(x.amount)}</div><div class="cpV5Actions"><button class="cpV5Pay" onclick="cpV5OpenPayment('${esc(x.id)}')">💳 Pagar ahora</button><button class="cpV5Detail" onclick="go('payments')">Ver detalle ›</button></div></article>`).join("")}</div>${items.length>1 ? `<div class="cpV5Dots">${items.slice(0,6).map((_,i)=>`<span class="cpV5Dot ${i===0?'active':''}"></span>`).join("")}</div>` : ""}</section>`;
  }

  function cpV5QuickAccess(){
    return `<div class="cpV5QuickTitle">Accesos rápidos</div><div class="cpV5QuickGrid"><button class="cpV5Quick" onclick="go('payments')"><span>📄</span>Mis pagos</button><button class="cpV5Quick" onclick="go('payments')"><span>🧾</span>Comprobantes</button><button class="cpV5Quick" onclick="go('payments')"><span>💳</span>Medios</button><button class="cpV5Quick" onclick="alert('Centro de ayuda próximamente')"><span>❔</span>Ayuda</button></div><div data-monetization-slot="apoderado"></div>`;
  }


  function enhanceApoderadoHomeProgressive(){
    try{
      const wrapCard = (card, title, subtitle, icon, count, tone)=>{
        if(!card || card.closest("details.cpV5Section")) return;
        const det = document.createElement("details");
        det.className = "cpV5Section";
        const sum = document.createElement("summary");
        const countHtml = count ? `<span class="cpV5Count ${tone||''}">${count}</span>` : "";
        sum.innerHTML = `<span class="cpV5SecLeft"><span class="cpV5SecIcon ${tone||''}">${icon}</span><span><span class="cpV5SecTitle">${title}</span><span class="cpV5SecSub">${subtitle}</span></span></span><span class="cpV5SecRight">${countHtml}<span class="cpV5Chevron">⌄</span></span>`;
        const body = document.createElement("div");
        body.className = "cpV5Body";
        card.parentNode.insertBefore(det, card);
        det.appendChild(sum);
        det.appendChild(body);
        body.appendChild(card);
      };
      const cards = Array.from(app.querySelectorAll(".card"));
      cards.forEach(card=>{
        const txt = (card.textContent||"").replace(/\s+/g," ").trim();
        if(txt.includes("Próxima cuota") && !card.closest(".cpV5Next")){ card.style.display = "none"; return; }
        if(txt.includes("Avisos del curso")){
          const m = txt.match(/(\d+)\s+aviso/);
          wrapCard(card, "Avisos del curso", "Información importante", "📣", m ? m[1] : "", "info");
          return;
        }
        if(txt.includes("Pagos pendientes")){
          const m = txt.match(/(\d+)\s+pagos?/);
          wrapCard(card, "Pagos pendientes", "Tienes pagos por revisar", "💳", m ? m[1] : "", "pay");
          return;
        }
        if(txt.includes("Estado del curso")){
          wrapCard(card, "Estado del curso", "Recaudado, gastado y disponible", "📊", "Ver", "chart");
          return;
        }
      });
    }catch(e){}
  }

function renderHome(){
    // datos para home
    let paysAll = load(KEY_PAYMENTS, []);
    const dd0 = dedupePaymentsAll(paysAll);
    if(dd0.changed) save(KEY_PAYMENTS, dd0.list);
    paysAll = dd0.list;
    const ident0 = (typeof getActiveIdentity==="function") ? getActiveIdentity() : null;
    // Limpieza extra: normaliza claves legacy y elimina duplicados por cambios de rol
    try { normalizeAndDedupePaymentsFor(ident0); } catch(e) {}
    paysAll = load(KEY_PAYMENTS, []);
    const tasks0 = normalizeTasks(load(KEY_TASKS, []));
    // Fase 2B: no crear pagos locales en Apoderado. Los pagos nacen en Supabase.
    // paysAll = ensurePaymentsForIdentity(ident0, tasks0, paysAll);

    // FIX v11: limpiar duplicados persistentes antes de renderizar Home.
    try{
      const clean = cleanVisiblePaymentsV11(paysAll, tasks0);
      if(clean.changed) save(KEY_PAYMENTS, clean.list);
      paysAll = clean.list;
    }catch(e){}

    // Fase 2B: descartar pagos legacy locales pay_xxx; solo Supabase pagos.id UUID.
    paysAll = onlySupabasePayments(paysAll);

    // scope a este apoderado
    paysAll = paysAll.filter(isMinePayment);
    try{ paysAll = cleanVisiblePaymentsV11(paysAll, tasks0).list; }catch(e){ paysAll = suppressPendingCoveredByPaid(paysAll, tasks0); }

    const pending = paysAll.filter(p => ["pending","partial","overdue"].includes(String(p.status||"").toLowerCase()) && !isPaymentOptedOut(p));
    const pendingTotal = pending.reduce((a,p)=> a + Number(p.amountRemaining ?? p.amount ?? 0), 0);

    const thisYM = (()=>{ const d=new Date(); const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,"0"); return `${y}-${m}`; })();

    const dueSorted = pending
      .filter(p=>p.dueDate && !isPaymentOptedOut(p))
      .sort((a,b)=>daysTo(a.dueDate)-daysTo(b.dueDate));

    const nextDue = dueSorted[0];

    const dueThisMonth = dueSorted.filter(p=>String(p.dueDate||"").startsWith(thisYM));
    // Agrupar por campaña (para mostrar varias campañas venciendo en el mes)
    const taskTitleById = (tid)=>{
      const t = tasks0.find(x=>String(x.id)===String(tid));
      return (t?.title || t?.name || "").trim();
    };
    const dueMonthByCampaignMap = {};
    for(const p of dueThisMonth){
      const tid = String(p.fromTaskId || p.taskId || "no_task");
      const title = taskTitleById(tid) || String(p.title || p.taskTitle || p.campaignTitle || "Campaña");
      if(!dueMonthByCampaignMap[tid]){
        dueMonthByCampaignMap[tid] = { taskId: tid, title, amount:0, dueDate: p.dueDate, payId: p.id };
      }
      dueMonthByCampaignMap[tid].amount += Number(p.amountRemaining ?? p.amount ?? 0);
      // mantener la fecha más próxima y el pago más próximo para el botón
      if(p.dueDate && daysTo(p.dueDate) < daysTo(dueMonthByCampaignMap[tid].dueDate || p.dueDate)){
        dueMonthByCampaignMap[tid].dueDate = p.dueDate;
        dueMonthByCampaignMap[tid].payId = p.id;
      }
    }
    const dueMonthByCampaign = Object.values(dueMonthByCampaignMap).sort((a,b)=>daysTo(a.dueDate)-daysTo(b.dueDate));
    const multipleDueCampaigns = dueMonthByCampaign.length > 1;

    const thisMonthTotal = dueThisMonth.reduce((a,p)=> a + Number(p.amountRemaining ?? p.amount ?? 0), 0);

    const resumenFin = dashboardFinancieroApoderado(paysAll);

    // Desglose por campaña (con ID para no mezclar títulos)
    const perCampaignMap = {};
    for(const p of pending){
      const tid = String(p.fromTaskId || p.taskId || "no_task");
      const title = taskTitleById(tid) || String(p.title || p.taskTitle || p.campaignTitle || "Campaña");
      if(!perCampaignMap[tid]) perCampaignMap[tid] = { taskId:tid, title, thisMonth:0, total:0 };
      perCampaignMap[tid].total += Number(p.amountRemaining ?? p.amount ?? 0);
    }
    for(const p of dueThisMonth){
      const tid = String(p.fromTaskId || p.taskId || "no_task");
      if(!perCampaignMap[tid]){
        const title = taskTitleById(tid) || String(p.title || p.taskTitle || p.campaignTitle || "Campaña");
        perCampaignMap[tid] = { taskId:tid, title, thisMonth:0, total:0 };
      }
      perCampaignMap[tid].thisMonth += Number(p.amountRemaining ?? p.amount ?? 0);
    }
    const perCampaignRows = Object.values(perCampaignMap)
      .sort((a,b)=>(b.thisMonth - a.thisMonth) || (b.total - a.total));

    const lastSeen = localStorage.getItem(KEY_LAST_SEEN_PAYMENTS) || "1970-01-01T00:00:00.000Z";
    const hasNew = paysAll.some(p => (p.createdAt || "1970-01-01T00:00:00.000Z") > lastSeen);

    const r = latestReport();

    app.innerHTML = `
      <div class="cpHomeV5">${cpV5NextDues()}

      <!-- 1) Próxima cuota -->
      <div class="card" id="cardNextDue" style="border:1px solid rgba(91,92,226,.25);background:rgba(91,92,226,.06);">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
          <div class="kTitle">⏰ Próxima cuota <button class="helpBtn" data-help="proxima" type="button" aria-label="Ayuda próxima cuota">?</button></div>
          <span class="tag warn" id="homeDuePill">Vence pronto</span>
        </div>

        ${multipleDueCampaigns ? `
          <div class="muted" style="margin-top:8px;font-weight:900;">Varias campañas vencen este mes. Elige cuál pagar:</div>

          <div style="margin-top:10px;display:grid;gap:10px;">
            ${dueMonthByCampaign.map((c, idx)=>`
              <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;border:1px solid rgba(0,0,0,.08);border-radius:12px;padding:10px;">
                <div style="min-width:0;">
                  <div style="font-weight:950;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(c.title)}</div>
                  <div class="muted" style="font-size:12px;">Vence en <b>${daysTo(c.dueDate)}</b> días · ${esc(c.dueDate || "")}</div>
                </div>
                <div style="text-align:right;white-space:nowrap;">
                  <div style="font-weight:950;font-size:18px;">${formatCLP(c.amount)}</div>
                  <button class="btnx primary" id="btnPayCamp_${esc(c.taskId)}" type="button" style="margin-top:6px;">Pagar ahora</button>
                </div>
              </div>
            `).join("")}
          </div>
        ` : `
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
        `}
      </div>
      ${typeof renderAvisosCursoCard === 'function' ? renderAvisosCursoCard(3) : ``}

      <!-- 2) Pendientes -->
      <div class="card" id="cardPending" style="margin-top:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
          <div class="kTitle">💳 Pagos pendientes <button class="helpBtn" data-help="pendientes" type="button" aria-label="Ayuda pagos pendientes">?</button></div>
          ${hasNew ? `<span class="tag" style="font-weight:950;">🆕 Nuevo</span>` : ``}
        </div>

        <div class="muted" style="margin-top:6px;font-weight:900;" id="homePendingText">
          En total tienes <b id="homePendingCount">${pending.length}</b> pagos pendientes
        </div>

        <div style="margin-top:12px;">
          <div class="muted" style="font-weight:900;">Este mes</div>
          <div style="margin-top:6px;font-size:28px;font-weight:950;" id="homeThisMonthTotal">${formatCLP(thisMonthTotal)}</div>
          <div class="muted" style="margin-top:4px;font-size:12px;">(${esc(thisYM)})</div>
        </div>

        <div class="muted" style="margin-top:10px;font-size:12px;">Total pendiente anual (todas las campañas): <b>${formatCLP(pendingTotal)}</b></div>

        ${perCampaignRows.length ? `
          <div style="margin-top:10px;border-top:1px solid rgba(0,0,0,.06);padding-top:10px;">
            ${perCampaignRows.map(row=>`
              <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin:8px 0;">
                <div style="max-width:68%;">
                  <div style="font-weight:950;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(row.title)}</div>
                  <div class="muted" style="font-size:12px;">Total pendiente: <b>${formatCLP(row.total)}</b></div>
                </div>
                <div style="text-align:right;white-space:nowrap;">
                  <div class="muted" style="font-size:12px;">Este mes</div>
                  <div style="font-weight:950;">${formatCLP(row.thisMonth)}</div>
                </div>
              </div>
            `).join("")}
          </div>
        `: ``}

        <div style="margin-top:12px;display:flex;justify-content:space-between;align-items:center;">
          <div class="muted">Total pendiente</div>
          <div style="font-weight:950;opacity:.75;" id="homePendingTotal">${formatCLP(pendingTotal)}</div>
        </div>

        <div class="muted" style="margin-top:6px;font-size:12px;">
          Resto otros meses: <b>${formatCLP(Math.max(0,pendingTotal - thisMonthTotal))}</b>
        </div>

        <div class="actions" style="margin-top:12px;justify-content:flex-end;">
          <button class="btnx" id="btnGoPending" type="button">Ver detalle</button>
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
    
      ${cpV5QuickAccess()}</div>
`;

    try{ enhanceApoderadoHomeProgressive(); }catch(e){}

    // comportamiento botones
    const goPending = document.getElementById("btnGoPending");
    if(goPending) goPending.onclick = ()=> go("payments");

    // botón pagar ahora (caso 1 campaña)
    const payNext = document.getElementById("btnPayNext");
    if(payNext){
      payNext.onclick = ()=>{
        if(nextDue?.id) payNow(nextDue.id);
        else go("payments");
      };
    }

    // botones pagar por campaña (cuando hay varias venciendo este mes)
    if(multipleDueCampaigns){
      for(const c of dueMonthByCampaign){
        const b = document.getElementById(`btnPayCamp_${c.taskId}`);
        if(!b) continue;
        b.onclick = ()=>{
          // ir directo a pagos de esa campaña (y permitir pagar)
          try{ window.__apoTaskFilter = c.taskId; }catch(e){}
          try{ if(typeof window.setPayFilter === "function") window.setPayFilter("pending"); }catch(e){}
          if(c.payId) payNow(c.payId);
          else go("payments");
        };
      }
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
    const ddP = dedupePaymentsAll(paysAll);
    if(ddP.changed) save(KEY_PAYMENTS, ddP.list);
    paysAll = ddP.list;
    const tasksAll = normalizeTasks(load(KEY_TASKS, []));
    // pago recién efectuado (para banner por campaña)
    let justPaidId = "";
    try{ justPaidId = sessionStorage.getItem("justPaidPaymentId") || ""; }catch(e){}


    const ident = (typeof getActiveIdentity==="function") ? getActiveIdentity() : null;
    // Fase 2B: no crear pagos locales en Apoderado. Los pagos nacen en Supabase.
    // paysAll = ensurePaymentsForIdentity(ident, tasksAll, paysAll);

    // FIX v11: dedupe real antes de pintar pagos/campañas.
    try{
      const clean = cleanVisiblePaymentsV11(paysAll, tasksAll);
      if(clean.changed) save(KEY_PAYMENTS, clean.list);
      paysAll = clean.list;
    }catch(e){}

    // Fase 2B: descartar pagos legacy locales pay_xxx; solo Supabase pagos.id UUID.
    paysAll = onlySupabasePayments(paysAll);

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
    try{ paysAll = cleanVisiblePaymentsV11(paysAll, tasksAll).list; }catch(e){ paysAll = suppressPendingCoveredByPaid(paysAll, tasksAll); }

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

      const amount = isPaidRow ? Number(r.amountPaid ?? r.amount ?? 0) : Number(r.amountRemaining ?? r.amount ?? 0);

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



        function uniquePayments(arr){
      const out = [];
      const seen = new Set();
      for(const r of (arr||[])){
        if(!r) continue;
        const k = `${r.fromTaskId||""}|${r.dueDate||""}|${Number(r.amountRemaining ?? r.amount ?? 0)}|${String(r.typeTag||"")}|${String(r.status||"")}`;
        if(seen.has(k)) continue;
        seen.add(k);
        out.push(r);
      }
      return out;
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
            ${t.mandatoryParticipation===false ? "Esta campaña es voluntaria. Se generarán cobros pendientes para quienes participen; también puedes marcar No participo." : "Aún no hay cobros generados para ti en esta campaña. Si acabas de ingresar, vuelve a abrir Pagos para que se creen automáticamente."}
          </div>
          ${t.mandatoryParticipation===false ? `
            <div class="actions" style="margin-top:12px;justify-content:flex-end;">
              <button class="btnx" onclick="toggleOptOut('${esc(t.id)}')">${isOptedOut(t.id) ? "Participar" : "No participo"}</button>
            </div>
          ` : ``}
        </div>
      `;
    }

    const campaignCards = tasksAll
      .slice()
      .sort((a,b)=>String(a.dueDate||"").localeCompare(String(b.dueDate||"")))
      .map(t=>{
        const rows = uniquePayments(paysByTask[t.id] || []);
        if(!rows.length){
          const hasAny = paysAll.some(p=>p.fromTaskId===t.id);
          return hasAny
            ? (()=>{
                const oo = (t.mandatoryParticipation===false) ? isOptedOut(t.id) : false;
                return `
                  <div class="card" style="margin-top:12px;">
                    <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;">
                      <div style="font-weight:950;">${esc(t.title||"Campaña")}</div>
                      ${oo ? `
                        <button class="btnx" style="border:1px solid rgba(0,0,0,.14);" onclick="toggleOptOut('${esc(t.id)}')">Participar</button>
                      ` : ``}
                    </div>
                    <div class="muted" style="margin-top:6px;">
                      ${oo ? `Marcaste <b>No participo</b>. Puedes volver a participar aquí.` : `No hay pagos para este filtro en esta campaña.`}
                    </div>
                  </div>
                `;
              })()
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
                ${t.mandatoryParticipation===false ? `
                  <button class="btnx" style="border:1px solid rgba(0,0,0,.14);" onclick="toggleOptOut('${esc(t.id)}')">
                    ${isOptedOut(t.id) ? "Participar" : "No participo"}
                  </button>
                ` : ``}
              </div>
${(justPaidId && rows.some(x=>String(x.id)===String(justPaidId))) ? `<div style="margin-top:10px;padding:10px 12px;border-radius:14px;background: rgba(34,197,94,.12);border: 1px solid rgba(34,197,94,.22);font-weight: 900;">✅ Pago registrado. Gracias 🙌</div>` : ``}
                            <div class="muted" style="margin-top:6px;">Pendiente ${formatCLP(totalPend)}</div>
              <div style="margin-top:10px;">
                ${rows.map(r=>renderPaymentRow(r)).join("")}
              </div>
            </div>
              ${(()=>{
                const items = normalizeCotizaciones(t);
                if(!items.length) return ``;
                const totalC = items.reduce((a,it)=>a+Number(it.monto||0),0);
                return `
                  <div style="margin-top:12px;border-top:1px solid rgba(0,0,0,.08);padding-top:12px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
                      <div>
                        <div style="font-weight:950;">Información</div>
                        <div class="muted" style="margin-top:4px;">Cotizaciones referenciales (no es cobro).</div>
                      </div>
                      <button class="btnx" onclick="openCotizacionesModal('${esc(t.id)}')">Ver cotizaciones</button>
                    </div>
                    <div class="muted" style="margin-top:8px;font-weight:900;">
                      Cotizaciones · ${items.length} ítem(s) · Total ${formatCLP(totalC)}
                    </div>
                  </div>
                `;
              })()}

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
              ${(()=>{
                const items = normalizeCotizaciones(t);
                if(!items.length) return ``;
                const totalC = items.reduce((a,it)=>a+Number(it.monto||0),0);
                return `
                  <div style="margin-top:12px;border-top:1px solid rgba(0,0,0,.08);padding-top:12px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
                      <div>
                        <div style="font-weight:950;">Información</div>
                        <div class="muted" style="margin-top:4px;">Cotizaciones referenciales (no es cobro).</div>
                      </div>
                      <button class="btnx" onclick="openCotizacionesModal('${esc(t.id)}')">Ver cotizaciones</button>
                    </div>
                    <div class="muted" style="margin-top:8px;font-weight:900;">
                      Cotizaciones · ${items.length} ítem(s) · Total ${formatCLP(totalC)}
                    </div>
                  </div>
                `;
              })()}

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


window.payNow = async function(id){
    if(!id){ alert("Pago no disponible."); return; }
    const sid = String(id || "").trim();
    if(!isSupabaseUuid(sid)){
      // Este caso corresponde a IDs legacy tipo pay_xxx. No existen en tabla pagos.
      try{
        if(window.CURSAPP_PAYMENTS_V11 && typeof window.CURSAPP_PAYMENTS_V11.refresh === "function"){
          await window.CURSAPP_PAYMENTS_V11.refresh("payNow-legacy-id");
        }else if(window.CURSAPP && typeof window.CURSAPP.hydrateOperationalFromSupabase === "function"){
          await window.CURSAPP.hydrateOperationalFromSupabase("payNow-legacy-id");
        }
      }catch(e){}
      alert("Este pago viene de una referencia antigua del navegador. Actualicé desde Supabase; vuelve a presionar Pagar.");
      try{ renderPayments(); }catch(e){}
      return;
    }
    // Fase 2B: pay.html recibe exclusivamente pagos.id UUID de Supabase.
    location.href = `/pay.html?pago=${encodeURIComponent(sid)}`;
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
    try{ if(window.renderAvisosBell) window.renderAvisosBell(); }catch(e){}
  }
  window.go = go; // <-- esto elimina el error "Can't find variable: go"

  // Menu
  function initMenu(){
    if(menuBtn && menuDropdown){
      if (!window.CURSAPP_MENU_HANDLED) menuBtn.onclick = (e)=>{e.stopPropagation(); menuDropdown.style.display=(menuDropdown.style.display==="block"?"none":"block");};
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


  // FIX v11: si storage cambia varias veces al cambiar rol, renderizar una sola vez.
  let __apoRerenderTimer = null;
  window.addEventListener("cursapp:dataChanged", function(ev){
    try{
      const k = String(ev?.detail?.key || "");
      if(!k.includes("payments") && !k.includes("tasks")) return;
      clearTimeout(__apoRerenderTimer);
      __apoRerenderTimer = setTimeout(()=>{
        const active = (Array.from(document.querySelectorAll(".navItem")).find(b=>b.classList.contains("active"))||{}).dataset?.tab || "home";
        if(active === "home") renderHome();
        else if(active === "payments") renderPayments();
      }, 120);
    }catch(e){}
  });

  // Bottom nav
  navItems.forEach(b=> b.onclick=()=> go(b.dataset.tab));
// Boot
// ✅ Solo sembrar demo si está activado explícitamente
const DEMO_MODE = !!(window.CURSAPP && window.CURSAPP.DEMO_MODE);

if (DEMO_MODE) {
  ensureDemo();
}


  // --- Multi-rol (Apoderado/Tesorero): mostrar selector al entrar (1 vez por sesión) ---
  function __profilesHasRole(roleKey){
    roleKey = String(roleKey||"").toLowerCase();
    try{
      var raw = localStorage.getItem("cursapp_profiles_v1");
      if(!raw) return false;
      var p = JSON.parse(raw);
      var arr = Array.isArray(p) ? p : Object.values(p||{});
      for(var i=0;i<arr.length;i++){
        var r = (arr[i] && arr[i].role) ? String(arr[i].role).toLowerCase() : "";
        if(roleKey==="tesorero" && r.indexOf("tesor")>=0) return true;
        if(roleKey==="presidente" && (r.indexOf("pres")>=0 || r.indexOf("direct")>=0)) return true;
        if(roleKey==="apoderado" && r.indexOf("apod")>=0) return true;
      }
    }catch(e){}
    return false;
  }

  function __hideLegacyTesoreroBanner(){
    try{
      // Oculta tarjeta antigua "Tienes permisos de Tesorero"
      var nodes = Array.from(document.querySelectorAll("div,section,article,button"));
      for(var i=0;i<nodes.length;i++){
        var t = (nodes[i].innerText||"").trim();
        if(t.indexOf("Tienes permisos de Tesorero")>=0){
          // esconder el contenedor principal
          nodes[i].style.display="none";
          if(nodes[i].parentElement) nodes[i].parentElement.style.display="none";
          break;
        }
      }
    }catch(e){}
  }

  function __openRoleChooser(){
    // Usamos openModal si existe (misma UI de ayudas). Fallback: alert.
    if(typeof openModal !== "function"){
      alert("Selecciona perfil: Apoderado o Tesorero");
      return;
    }
    var canTesorero = __profilesHasRole("tesorero");
    var body = `
      <div class="card helpModalCard" style="max-width:520px">
        <div class="helpHeader">
          <div>
            <div class="kTitle">Cambiar perfil</div>
            <div class="muted" style="margin-top:6px;font-weight:800;">Selecciona cómo ingresar</div>
          </div>
          <button class="btn small" onclick="closeModal()">Cerrar</button>
        </div>
        <div style="margin-top:14px">
          <button class="btn wide" style="display:flex;gap:10px;align-items:center;justify-content:flex-start;" onclick="window.__setRole('apoderado')">
            <span style="font-size:20px">👥</span>
            <div style="text-align:left">
              <div style="font-weight:900">Apoderado</div>
              <div class="muted">Aprobado automáticamente</div>
            </div>
          </button>
          ${canTesorero ? `
          <div style="height:10px"></div>
          <button class="btn wide" style="display:flex;gap:10px;align-items:center;justify-content:flex-start;" onclick="window.__setRole('tesorero')">
            <span style="font-size:20px">💼</span>
            <div style="text-align:left">
              <div style="font-weight:900">Tesorero</div>
              <div class="muted">Rendiciones e informes</div>
            </div>
          </button>` : ``}
        </div>
      </div>`;
    openModal(body);
  }

  window.__setRole = function(r){
    const nextRole = String(r)==="tesorero" ? "tesorero" : "apoderado";
    try{
      localStorage.setItem("cursapp_role_prompted_v1","1");
      localStorage.setItem("cursapp_active_role_v1", nextRole);
      const s = __cursappReadJsonV101('cursapp_session_v1', {}) || {};
      const roles = Array.isArray(s.roles) ? s.roles.map(x=>String(x).toLowerCase().trim()).filter(Boolean) : [];
      if(!roles.includes(nextRole)) roles.push(nextRole);
      s.roles = roles;
      s.currentRole = nextRole;
      s.activeRole = nextRole;
      s.role = nextRole;
      __cursappWriteJsonV101('cursapp_session_v1', s);
    }catch(e){}
    try{ closeModal(); }catch(e){}
    if(nextRole==="tesorero"){
      location.href="/tesorero.html";
    }else{
      // quedarse en apoderado
      try{ __cursappNormalizeRoleContextV101('apoderado'); }catch(e){}
      try{ __hideLegacyTesoreroBanner(); }catch(e){}
    }
  };

  function __maybePromptRole(){
    // V11.14: no mostrar selector automático dentro de Apoderado.
    // El selector debe resolverse antes de entrar a esta pantalla (login / cambio de rol).
    // Esto evita el bug Presidente -> Apoderado donde se renderizaba Home/banner
    // y luego aparecía nuevamente el selector de perfil, dejando el banner de fondo.
    try{
      localStorage.setItem("cursapp_role_prompted_v1","1");
      localStorage.setItem("cursapp_active_role_v1","apoderado");
      __cursappNormalizeRoleContextV101('apoderado');
    }catch(e){}
    return;
  }

async function __bootApoderadoSupabaseFirst(){
  try{
    if(window.CURSAPP && typeof window.CURSAPP.clearOperationalCache === "function") window.CURSAPP.clearOperationalCache();
    if(window.CURSAPP && typeof window.CURSAPP.hydrateOperationalFromSupabase === "function"){
      await window.CURSAPP.hydrateOperationalFromSupabase("apoderado-boot");
    }
    // Fase 2B: antes de pintar, pedir a Supabase que cree los pagos pendientes faltantes
    // para campañas obligatorias y luego rehidratar. Evita mostrar pagos locales pay_xxx.
    if(window.CURSAPP && typeof window.CURSAPP.refreshPagosSupabase === "function"){
      await window.CURSAPP.refreshPagosSupabase("apoderado-boot-before-render");
      if(typeof window.CURSAPP.hydrateOperationalFromSupabase === "function"){
        await window.CURSAPP.hydrateOperationalFromSupabase("apoderado-boot-after-payments-refresh");
      }
    }
  }catch(e){
    console.warn("Apoderado: no se pudo hidratar/crear pagos Supabase antes del render", e);
  }

  initMenu();
  __hideLegacyTesoreroBanner();
  __maybePromptRole();

  const hash = (location.hash || "").replace("#","");
  if(hash==="payments_paid"){
    try{ window.__apoForcePaid = true; }catch(e){}
    go("payments");
  }else if(hash==="payments") go("payments");
  else go("home");
}
__bootApoderadoSupabaseFirst();
})();

/* Re-render banners después de cada render de Apoderado */
(function(){
  if(window.__CURSAPP_APODERADO_MONETIZATION_RERENDER__) return;
  window.__CURSAPP_APODERADO_MONETIZATION_RERENDER__ = true;
  function rerender(){ try{ if(window.CursappMonetization) setTimeout(()=>window.CursappMonetization.render(), 120); }catch(e){} }
  window.addEventListener("cursapp:dataChanged", rerender);
  window.addEventListener("cursapp:dataUpdated", rerender);
  window.addEventListener("pageshow", rerender);
  const timer = setInterval(rerender, 1500);
  setTimeout(()=>clearInterval(timer), 12000);
})();

/* __CURSAPP_APODERADO_V11_14_NO_ROLE_PROMPT_ON_PAGE__ */

/* __CURSAPP_V10_1_ROLE_CONTEXT_APODERADO__ */
