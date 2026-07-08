
// === CURSAPP GLOBAL LOADING ===
window.CURSAPP_LOADING = window.CURSAPP_LOADING || {
 show:(role='')=>{
  try{
   let el=document.getElementById('cursapp-loading-overlay');
   if(el) return;
   const msgs={
    presidente:['ðŸ“Š Preparando dashboard ejecutivo...','ðŸ‘¥ Revisando apoderados...','ðŸ“ˆ Actualizando indicadores...'],
    tesorero:['ðŸ’° Conciliando pagos...','ðŸ§¾ Actualizando comprobantes...','ðŸ“‹ Revisando rendiciones...'],
    apoderado:['ðŸŽ’ Revisando informaciÃ³n del curso...','ðŸ“… Consultando prÃ³ximas cuotas...','ðŸ“£ Actualizando avisos...']
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
document.addEventListener('DOMContentLoaded',()=>{try{window.CURSAPP_LOADING.show('apoderado'); setTimeout(()=>window.CURSAPP_LOADING.hide(),2200);}catch(e){}});
// === END LOADING ===





// V10.1 Â· Contexto de rol robusto para Apoderado.
// No exige courseKey en sesiÃ³n porque puede venir desde cursapp_active_course_v1
// o desde el perfil activo. Evita el falso "contexto invÃ¡lido" al cambiar
// Presidente â†’ Apoderado con usuarios multirol.
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



if (!session || !session.userId) {
  console.warn('Cursapp Apoderado: sesiÃ³n sin userId; se mostrarÃ¡ estado vacÃ­o controlado.', session);
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

function getActiveMemberIdV584(){
  try{
    const profileRaw = localStorage.getItem("cursapp_active_profile_v1") || "";
    let profile = null;
    try{ profile = profileRaw && profileRaw.trim().startsWith("{") ? JSON.parse(profileRaw) : null; }catch(_e){}
    const ids = [
      profile?.miembroId, profile?.miembro_id, profile?.profileId, profile?.id,
      localStorage.getItem("cursapp_active_miembro_id_v1"),
      localStorage.getItem("cursapp_active_profile_v1")
    ].map(x=>String(x||"").trim()).filter(Boolean);
    return ids[0] || "";
  }catch(_e){ return ""; }
}

function paymentMemberIdV584(p){
  return String(
    p?.miembroId || p?.miembro_id || p?.alumnoId || p?.studentId ||
    p?.supabase?.miembro_id || p?.raw?.miembro_id || ""
  ).trim();
}

function isMinePayment(p){
  const mk = meKey();
  const activeMid = getActiveMemberIdV584();
  const payMid = paymentMemberIdV584(p);

  // V58.4: si existe miembro activo y el pago trae miembro, manda el miembro.
  // Esto evita cruces cuando el mismo correo participa en mÃ¡s de un curso/alumno.
  if(activeMid && payMid) return String(payMid) === String(activeMid);

  if(!mk) return true;

  // Prefer explicit identity fields
  const ae = String(p?.apoderadoEmail||p?.email||"").toLowerCase().trim();
  if(ae) return ae === mk;

  const ak = String(p?.apoderadoKey||"").toLowerCase().trim();
  if(ak) return ak === mk;

  const aid = String(p?.apoderadoId||"").toLowerCase().trim();
  if(aid) return aid === mk || aid === String(activeMid||"").toLowerCase();

  // âœ… Sin identidad fuerte no es 'mÃ­o' (evita cruces)
  return false;
}
  // ---- notifier: refrescar cuando se actualiza storage (misma sesiÃ³n) ----
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

  // V58.4: respaldo de pagos por curso + perfil activo.
  // Evita que una hidrataciÃ³n vacÃ­a al volver desde Mercado Escolar deje el home en 0.
  function __paymentsSnapshotKeyV584(){
    const ck = String(localStorage.getItem(KEY_ACTIVE_COURSE)||"").trim() || "global";
    const mid = (typeof getActiveMemberIdV584 === "function" ? getActiveMemberIdV584() : "") || "perfil";
    return "cursapp_payments_snapshot_v584_" + ck + "_" + mid;
  }
  function __backupPaymentsSnapshotV584(list){
    try{
      const arr = Array.isArray(list) ? list : [];
      const mine = arr.filter(p=>{ try{ return isMinePayment(p); }catch(_e){ return false; } });
      if(mine.length){
        localStorage.setItem(__paymentsSnapshotKeyV584(), JSON.stringify({ at:new Date().toISOString(), payments: arr }));
      }
    }catch(_e){}
  }
  function __restorePaymentsSnapshotIfEmptyV584(list){
    try{
      const arr = Array.isArray(list) ? list : [];
      const mine = arr.filter(p=>{ try{ return isMinePayment(p); }catch(_e){ return false; } });
      if(mine.length) return arr;
      const raw = localStorage.getItem(__paymentsSnapshotKeyV584());
      if(!raw) return arr;
      const snap = JSON.parse(raw);
      const restored = Array.isArray(snap?.payments) ? snap.payments : [];
      const restoredMine = restored.filter(p=>{ try{ return isMinePayment(p); }catch(_e){ return false; } });
      if(restoredMine.length){
        save(KEY_PAYMENTS, restored);
        try{ console.warn("Cursapp V58.4: pagos restaurados desde snapshot", {restored:restoredMine.length}); }catch(_e){}
        return restored;
      }
    }catch(_e){}
    return Array.isArray(list) ? list : [];
  }

  
  // ---- Opt-out campaÃ±as no obligatorias (por apoderado) ----
// Estructura: { [courseKey]: { [apoderadoKey]: [taskId, ...] } }
function getOptOutMap(){ return load(KEY_OPTOUT, {}); }

function getCourseKeyForOpt(){
  const p = getActiveProfile && getActiveProfile();
  return (p && p.courseKey) ? String(p.courseKey) : String(localStorage.getItem(KEY_ACTIVE_COURSE)||"default");
}
function getApoderadoKeyForOpt(){
  // Usa identidad de sesiÃ³n (userId/email) para evitar cruces
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

  // MigraciÃ³n suave desde formato antiguo (array)
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

    // Solo campaÃ±as NO obligatorias
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
        // volver a pendiente o vencida segÃºn fecha
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

  // ---- Helper: pagos excluidos por opt-out (solo campaÃ±as NO obligatorias) ----
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


// -------- Normalizar campaÃ±as (compat presidente/apoderado) --------
function normalizeTask(t){
  t = t || {};
  const title = t.title || t.name || t.nombre || "CampaÃ±a";
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

  const course = p?.course || {};
  const level = String(course.level || course.curso || "").trim();
  const letter = String(course.letter || course.letra || "").trim();
  const year = String(course.year || course.anio || "").trim();
  const courseShort = [level + letter, year].filter(Boolean).join(" ").trim();
  const schoolName = String(course.schoolName || course.colegio || course.school || "").replace(/\s*\((Demo|demo)\)\s*/g, "").trim();
  const guardianName = String(
    p?.apoderado?.name ||
    p?.apoderado?.nombre ||
    p?.user?.name ||
    p?.name ||
    s?.name ||
    s?.nombre ||
    s?.full_name ||
    ""
  ).trim();

  return {
    courseKey: (p && p.courseKey) ? p.courseKey : (localStorage.getItem(KEY_ACTIVE_COURSE)||""),
    apoderadoId: email || "unknown_apoderado",
    alumnoId: alumnoIdReal || alumnoLabel,
    alumnoLabel,
    realAlumnoId: alumnoIdReal,
    email,
    name: guardianName,
    apoderadoName: guardianName,
    studentName: alumnoLabel,
    schoolName,
    courseShort,
    courseLabel: courseShort || [schoolName, level + letter].filter(Boolean).join(" Â· ")
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
      // âš ï¸ si no existe installmentIndex, asumimos 1 (pago Ãºnico o legacy)
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
          pushPay(t, period, idx, dueDate, `${t.title} Â· Cuota ${idx}/${months}`);
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

      // Si es de este apoderado pero estÃ¡ incompleto, complÃ©talo
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
      // Preferimos el mÃ¡s "completo" y/o pagado
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
  // Fase 2B: un pago vÃ¡lido debe venir desde Supabase (UUID de tabla pagos.id).
  // Los IDs legacy tipo pay_xxx son cachÃ© local antigua y NO deben abrir pay.html.
  const isSupabaseUuid = (v)=> /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v||""));
  function onlySupabasePayments(list){
    return (Array.isArray(list) ? list : []).filter(p => isSupabaseUuid(p?.id || p?.remoteId));
  }

  // âœ… alias usado en copy (WhatsApp/UI)
  function formatCLP(n){ return clp(n); }
  // ---------------- Cotizaciones (Gira / GraduaciÃ³n) ----------------
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
    if(!t){ toast("No se encontrÃ³ la campaÃ±a", false); return; }
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
            <div style="font-weight:950;">${esc(it.nombre||"Ãtem")}</div>
            <div style="font-weight:950;">${formatCLP(it.monto||0)}</div>
          </div>
          ${it.descripcion ? `<div class="muted" style="margin-top:6px;"><b>DescripciÃ³n:</b> ${esc(it.descripcion)}</div>` : ``}
          ${it.url ? `<div class="muted" style="margin-top:6px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
              <div style="word-break:break-all;"><b>URL:</b> ${esc(it.url)}</div>
              <a class="btnx" style="padding:8px 10px;border:1px solid rgba(0,0,0,.12);" href="${esc(it.url)}" target="_blank" rel="noopener">ðŸ”—</a>
            </div>` : ``}
        </div>
      `).join("")}
    `;
    openModalSheet("Cotizaciones", `${t.title||"CampaÃ±a"} Â· ${items.length} Ã­tem(s)`, body);
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
  // ðŸ”¹ Badge de vencimiento (helper faltante)
function dueBadge(iso){
  const d = daysTo(iso);
  if(d === null) return "";
  if(d < 0) return `<span class="tag danger">Vencida</span>`;
  if(d === 0) return `<span class="tag warn">Vence hoy</span>`;
  return `<span class="tag warn">Quedan ${d} dÃ­as</span>`;
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
    return `Quedan ${d} dÃ­as`;
  }
  function monthNameFromISO(iso){
    if(!iso) return "";
    const d = new Date(iso+"T12:00:00");
    if(isNaN(d.getTime())) return "";
    const months = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
    return months[d.getMonth()];
  }

  // Nunca mÃ¡s pantalla en blanco: muestra error arriba
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
    // Los estados vacÃ­os se deben mostrar con datos reales del curso.
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
      title: "PrÃ³xima cuota",
      body: "Es el pago pendiente con la fecha mÃ¡s cercana. Puedes pagar cuotas vencidas junto con la del mes."
    },
    pendientes: {
      title: "Pagos pendientes",
      body: "Es la suma de campaÃ±as obligatorias + campaÃ±as no obligatorias en las que participas. Si eliges â€œNo participoâ€ en una campaÃ±a no obligatoria, ese cobro se excluye de tu pendiente."
    },
    vencida: {
      title: "Vencida vs Pendiente",
      body: "Pendiente incluye todo lo que falta por pagar. Vencida es una cuota que ya pasÃ³ su fecha."
    },
    optout: {
      title: "No participo",
      body: "Solo disponible en campaÃ±as NO obligatorias. Si eliges â€œNo participoâ€, esa campaÃ±a se excluye de tu pendiente."
    },
    saldo: {
      title: "Saldo a favor",
      body: "Se descuenta automÃ¡ticamente en tus prÃ³ximos pagos."
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
        <div class="helpQ">Â¿QuÃ© es una campaÃ±a obligatoria?</div>
        <div class="helpA">Es un cobro del curso en el que todos participan. No puedes excluirte.</div>
      </div>

      <div class="helpQA" id="help_no_obligatoria">
        <div class="helpQ">Â¿QuÃ© es una campaÃ±a no obligatoria?</div>
        <div class="helpA">Puedes elegir Participar o No participo. Si eliges No participo, ese cobro se excluye de tu pendiente.</div>
      </div>

      <div class="helpQA" id="help_cuotas">
        <div class="helpQ">Â¿Puedo pagar cuotas atrasadas juntas?</div>
        <div class="helpA">SÃ­. Puedes pagar cuotas vencidas y la del mes en una sola transacciÃ³n.</div>
      </div>

      <div class="helpQA" id="help_vencida">
        <div class="helpQ">Â¿QuÃ© significa Vencida vs Pendiente?</div>
        <div class="helpA">Pendiente incluye todo lo que falta por pagar. Vencida es una cuota que ya pasÃ³ su fecha.</div>
      </div>

      <div class="helpQA" id="help_saldo">
        <div class="helpQ">Â¿QuÃ© es â€œSaldo a favorâ€?</div>
        <div class="helpA">Se descuenta automÃ¡ticamente en tus prÃ³ximos pagos.</div>
      </div>

      <div class="helpQA" id="help_contacto">
        <div class="helpQ">Â¿A quiÃ©n contacto si tengo un problema?</div>
        <div class="helpA">Contacta al presidente o tesorero del curso.</div>
      </div>
    `;

    openModal(`
      <div class="card helpModalCard">
        <div class="helpHeader">
          <div>
            <div class="kTitle">â“ ${esc(t.title||"Ayuda")}</div>
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

    // Scroll a secciÃ³n segÃºn topic (si aplica)
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

    // Fallback: si no encontrÃ³ por usuario, al menos respeta curso.
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

    // 5) Ãšltimo fallback: perfil activo por curso.
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
      const title = document.getElementById("whoRoleTitle");
      if(title) title.textContent = "Apoderado";
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
    const ident = getActiveIdentity();
    const title = document.getElementById("whoRoleTitle");
    const logo = document.querySelector("header .brand .logo");
    const name = ident.name || ap.name || "Apoderado";
    const studentName = ident.studentName || ap.alumno || "Alumno/a";
    const courseText = ident.courseShort || `${c.level || ""}${c.letter || ""} ${c.year || ""}`.trim() || "Curso actual";
    const schoolText = ident.schoolName || c.schoolName || c.colegio || c.school || "Colegio";
    if(title) title.textContent = name;
    if(logo) logo.textContent = String(name).trim().charAt(0).toUpperCase() || "A";
    whoCourseLine.innerHTML = `
      <div class="apoHeaderRole">Apoderado de ${esc(apoFirstName(studentName) || "Alumno/a")}</div>
      <div class="apoHeaderCourse">${esc(schoolText)} · <b>${esc(courseText)}</b></div>
    `;
    try{ keepApoV45BellAlive(); }catch(e){}
    try{ installApoV47FloatingMessages(); }catch(e){}
  }

  function ensureApoV42Bell(){
    const host = document.getElementById("avisosBellHost");
    if(!host) return;
    // V45: mantener SIEMPRE visible la campana de avisos.
    // Scripts legacy pueden reemplazar el host por un sobre o dejarlo vacío; lo corregimos de forma idempotente.
    const current = host.querySelector(".apoV42BellBtn, .apoV44BellBtn, .apoV45BellBtn");
    if(current && /🔔/.test(current.textContent || current.innerHTML || "")){
      current.onclick = (ev)=>{
        ev.stopPropagation();
        try{ if(window.CURSAPP_NOTIFICATIONS && typeof window.CURSAPP_NOTIFICATIONS.open === "function") window.CURSAPP_NOTIFICATIONS.open(); else if(typeof openAvisosInbox === "function") openAvisosInbox(); }catch(_e){}
      };
      return;
    }
    host.innerHTML = "";
    const b = document.createElement("button");
    b.type = "button";
    b.className = "apoV42BellBtn apoV44BellBtn apoV45BellBtn";
    b.setAttribute("aria-label", "Avisos y notificaciones");
    b.innerHTML = `<span class="apoV42BellIcon" aria-hidden="true">🔔</span><span class="apoV42BellDot" aria-hidden="true"></span>`;
    b.onclick = (ev)=>{
      ev.stopPropagation();
      try{ if(window.CURSAPP_NOTIFICATIONS && typeof window.CURSAPP_NOTIFICATIONS.open === "function") window.CURSAPP_NOTIFICATIONS.open(); else if(typeof openAvisosInbox === "function") openAvisosInbox(); }catch(_e){}
    };
    host.appendChild(b);
  }

  function keepApoV45BellAlive(){
    // V46: NO llamar recursivamente a esta misma función.
    // La versión anterior producía recursión infinita y podía provocar recarga/error del navegador.
    const refreshBell = ()=>{ try{ ensureApoV42Bell(); }catch(e){} };
    refreshBell();
    setTimeout(refreshBell, 250);
    setTimeout(refreshBell, 900);
    setTimeout(refreshBell, 1800);
  }


  function ensureApoV47FloatingMessages(unreadText){
    let btn = document.getElementById("apoFloatingMessagesBtn");
    if(!btn){
      btn = document.createElement("button");
      btn.type = "button";
      btn.id = "apoFloatingMessagesBtn";
      btn.className = "apoV47FloatingMessagesBtn";
      btn.setAttribute("aria-label", "Mensajes del curso");
      btn.innerHTML = `<span class="apoV47FloatingMessagesIcon" aria-hidden="true">✉️</span><span class="apoV47FloatingMessagesLabel">Mensajes</span><em class="apoV47FloatingMessagesBadge" aria-hidden="true"></em>`;
      document.body.appendChild(btn);
    }
    const badge = btn.querySelector(".apoV47FloatingMessagesBadge");
    const clean = String(unreadText || "").trim();
    if(badge){
      if(clean && clean !== "0"){
        badge.textContent = clean;
        badge.style.display = "flex";
      }else{
        badge.textContent = "";
        badge.style.display = "none";
      }
    }
    btn.onclick = (ev)=>{
      ev.preventDefault();
      ev.stopPropagation();
      try{ if(typeof openAvisosInbox === "function") openAvisosInbox(); }catch(_e){}
    };
    return btn;
  }

  function installApoV47FloatingMessages(){
    if(window.__APO_V47_FLOATING_MESSAGES_INSTALLED__) return;
    window.__APO_V47_FLOATING_MESSAGES_INSTALLED__ = true;

    const originalRender = (typeof window.renderAvisosBell === "function") ? window.renderAvisosBell : null;
    if(originalRender && !window.__APO_V47_ORIGINAL_RENDER_AVISOS_BELL__){
      window.__APO_V47_ORIGINAL_RENDER_AVISOS_BELL__ = originalRender;
      window.renderAvisosBell = function(){
        let unreadText = "";
        try{
          window.__APO_V47_ORIGINAL_RENDER_AVISOS_BELL__.apply(this, arguments);
          const generated = document.getElementById("avisosBtn");
          const generatedBadge = generated ? generated.querySelector("span") : null;
          unreadText = generatedBadge ? String(generatedBadge.textContent || "").trim() : "";
          if(generated) generated.remove();
        }catch(_e){}
        try{ ensureApoV42Bell(); }catch(_e){}
        try{ ensureApoV47FloatingMessages(unreadText); }catch(_e){}
      };
    }

    const refreshMessages = ()=>{
      try{
        if(typeof window.renderAvisosBell === "function") window.renderAvisosBell();
        else ensureApoV47FloatingMessages("");
      }catch(_e){ try{ ensureApoV47FloatingMessages(""); }catch(__e){} }
    };
    refreshMessages();
    setTimeout(refreshMessages, 300);
    setTimeout(refreshMessages, 1000);
    setTimeout(refreshMessages, 2200);
  }

  function setupApoV44DueCarousel(){
    const root = document.querySelector(".apoV2DueCarousel.next-payment-card");
    if(!root) return;
    const track = root.querySelector(".apoV2DueTrack");
    const slides = Array.from(root.querySelectorAll(".apoV2DueSlide"));
    const dots = Array.from(root.querySelectorAll(".apoV2DueDots span"));
    if(!track || slides.length <= 1 || !dots.length) return;

    const setActive = (idx)=>{
      dots.forEach((d,i)=>d.classList.toggle("active", i === idx));
      root.dataset.activeSlide = String(idx);
    };
    const currentIndex = ()=>{
      const w = track.clientWidth || 1;
      return Math.max(0, Math.min(slides.length - 1, Math.round(track.scrollLeft / w)));
    };
    dots.forEach((dot,idx)=>{
      dot.setAttribute("role", "button");
      dot.setAttribute("tabindex", "0");
      dot.addEventListener("click", ()=>{
        track.scrollTo({ left: idx * track.clientWidth, behavior: "smooth" });
        setActive(idx);
      });
      dot.addEventListener("keydown", (ev)=>{
        if(ev.key === "Enter" || ev.key === " "){ ev.preventDefault(); dot.click(); }
      });
    });
    let t = null;
    track.addEventListener("scroll", ()=>{
      clearTimeout(t);
      t = setTimeout(()=>setActive(currentIndex()), 60);
    }, { passive:true });
    setActive(currentIndex());
  }

  function ensureAlumnoActivo() {
  // 1) Si ya hay alumno en sesiÃ³n/UI, no tocar
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

  // 4) Si lo encontrÃ³, guardarlo y pintarlo
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
        <div class="kTitle">ActivaciÃ³n pendiente</div>
        <div class="muted" style="margin-top:6px;">
          Debes completar la activaciÃ³n de <b>$990</b> para operar en este curso.
          <br><span style="font-weight:900;">Este monto es del sistema, no del curso.</span>
        </div>
        <div class="actions" style="margin-top:14px;justify-content:flex-end;">
          <button class="btnx" onclick="location.href='/index.html'">Cerrar sesiÃ³n</button>
          <button class="btnx primary" onclick="payActivation()">Pagar $990</button>
        </div>
      </div>
    `;

    openModal(`
      <div class="card">
        <div class="kTitle">ActivaciÃ³n pendiente</div>
        <div class="muted" style="margin-top:6px;">
          Para operar en este curso debes completar la activaciÃ³n de <b>$990</b>.
          <br><span style="font-weight:900;">Este monto es del sistema, no del curso.</span>
        </div>
        <div class="actions" style="margin-top:14px;justify-content:flex-end;">
          <button class="btnx" onclick="location.href='/index.html'">Cerrar sesiÃ³n</button>
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

      // Si el activeProfileId se corrompiÃ³ (por ejemplo guardaron JSON), intenta reparar
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

      // 2) Si no tocamos nada, buscamos por curso + email de sesiÃ³n
      if(!touched && activeCourse && sessionEmail){
        profiles.forEach(p=>{
          const pEmail = String(p?.apoderado?.email || p?.user?.email || "").trim().toLowerCase();
          if(String(p.courseKey||"")===String(activeCourse) && pEmail===sessionEmail){
            markPaid(p);
            touched = true;
          }
        });
      }

      // 3) Fallback: curso + rol apoderado (Ãºltimo recurso)
      if(!touched && activeCourse){
        const ix = profiles.findIndex(p => String(p.courseKey||"")===String(activeCourse) && (p.role==="apoderado" || p.user?.role==="apoderado"));
        if(ix>=0){
          markPaid(profiles[ix]);
          touched = true;
        }
      }

      if(touched){
        save(KEY_PROFILES, profiles);
        try{ toast("ActivaciÃ³n completada âœ…"); }catch(e){ alert("ActivaciÃ³n completada âœ…"); }
      }else{
        try{ toast("No encontrÃ© el perfil para activar"); }catch(e){ alert("No encontrÃ© el perfil para activar"); }
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
    // buscamos el pago pagado mÃ¡s reciente de la misma campaÃ±a/apoderado/alumno.
    const candidates = pays
      .filter(p=>String(p?.status||"").toLowerCase()==="paid")
      .filter(p=>String(p?.fromTaskId||"")===String(base?.fromTaskId||""))
      .filter(p=>sameReceiptOwner(p, base))
      .sort((a,b)=> receiptSortDate(b) - receiptSortDate(a));

    const better = candidates.find(p=>receiptAmountPaid(p)>0);
    return better || base;
  }

  window.downloadReceiptPdf = function(){
    try{ window.print(); }catch(_){ alert('Puedes usar compartir o imprimir desde el navegador.'); }
  };

  window.shareReceipt = async function(text){
    const msg = String(text || 'Comprobante de pago Cursapp');
    try{
      if(navigator.share){
        await navigator.share({ title:'Comprobante de pago Cursapp', text: msg });
        return;
      }
    }catch(_){ /* usuario canceló compartir */ return; }
    try{
      await navigator.clipboard.writeText(msg);
      toast('Comprobante copiado');
    }catch(_){ alert(msg); }
  };

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

    const rawMethod = String(p.paymentMethod || p.paidWith || "").toLowerCase();
    const methodPlain = ({
      transbank:"Transbank",
      transferencia:"Transferencia",
      efectivo:"Efectivo",
      saldo_favor:"Saldo a favor",
      credit:"Saldo a favor"
    })[rawMethod] || (p.paymentMethod || p.paidWith || "Transbank");

    const folioBase = String(p.receiptId || p.transactionId || p.id || "0").replace(/[^a-zA-Z0-9]/g,"").slice(-8).toUpperCase() || "00000000";
    const folio = `CP-${new Date().getFullYear()}-${folioBase}`;

    const isManual = String(p.source||"").toLowerCase()==="manual";
    const isConciliated = String(p.conciliationStatus||"").toLowerCase()==="conciliado";
    const statusLabel = isManual || isConciliated ? "Registrado por tesorería" : "Pago confirmado";
    const statusSub = isManual || isConciliated ? "Este comprobante acredita un pago registrado por la directiva del curso." : "Este comprobante acredita el pago registrado por la directiva del curso.";
    const student = p.studentName || p.alumno || "—";
    const guardian = p.guardianName || p.apoderadoName || p.apoderadoEmail || p.email || "—";
    let activeProfileReceipt = {};
    try{ activeProfileReceipt = JSON.parse(localStorage.getItem(KEY_ACTIVE_PROFILE) || "{}"); }catch(_e){ activeProfileReceipt = {}; }
    const course = p.courseLabel || p.courseName || activeProfileReceipt.courseLabel || activeProfileReceipt.courseName || activeProfileReceipt.course || activeProfileReceipt.curso || "Curso";
    const school = p.schoolName || p.colegio || activeProfileReceipt.schoolName || activeProfileReceipt.colegio || activeProfileReceipt.school || "Colegio";
    const shareText = `Comprobante Cursapp ${folio}\nMonto: ${clp(amountPaid)}\nCampaña: ${campaign}\nAlumno/a: ${student}\nEstado: Pagado`;

    openModal(`
      <div class="receiptV51Shell">
        <div class="receiptV51Topbar">
          <button class="receiptV51IconBtn" onclick="closeModal()" aria-label="Volver">←</button>
          <div class="receiptV51Title">Comprobante de pago</div>
          <button class="receiptV51IconBtn" onclick="downloadReceiptPdf()" aria-label="Descargar PDF">⇩</button>
        </div>

        <section class="receiptV51Card">
          <div class="receiptV51Brand">
            <span class="receiptV51BrandIcon">👥</span>
            <span>CURSAPP</span>
          </div>

          <h2>Comprobante de pago</h2>
          <div class="receiptV51Status"><span>✓</span>${esc(statusLabel)}</div>
          <div class="receiptV51Amount">${clp(amountPaid)}</div>
          <div class="receiptV51Date">${esc(paidDateShort)}${paidTimeShort ? " · " + esc(paidTimeShort) : ""}</div>

          <div class="receiptV51Divider"></div>

          <div class="receiptV51Details">
            <div class="receiptV51Watermark" aria-hidden="true">
              <div class="receiptV51StampRing">
                <div class="receiptV51StampTop">DIRECTIVA</div>
                <div class="receiptV51Shield">${esc(String(course).replace(/\s*2026\s*/i,'').trim() || 'Curso')}</div>
                <div class="receiptV51StampYear">2026</div>
                <div class="receiptV51StampBottom">PAGADO</div>
              </div>
            </div>

            ${[
              ["bookmark", "Campaña", campaign],
              ["user", "Alumno", student],
              ["guardian", "Apoderado", guardian],
              ["cap", "Curso", course],
              ["school", "Colegio", school],
              ["card", "Forma de pago", methodPlain],
              ["check", "Estado", "Pagado"],
            ].map(([icon,label,value])=>`
              <div class="receiptV51Row ${label==='Estado'?'is-status':''}">
                <span class="receiptV51RowIcon">${receiptIcon(icon)}</span>
                <span class="receiptV51RowLabel">${esc(label)}</span>
                <strong>${label==='Estado' ? '<span class="receiptV51PaidPill">Pagado</span>' : esc(value)}</strong>
              </div>
            `).join("")}
          </div>

          <div class="receiptV51Divider"></div>

          <div class="receiptV51Folio">
            <span>Folio</span>
            <strong>${esc(folio)}</strong>
          </div>

          <div class="receiptV51Trust">
            <span>🔒</span>
            <div>
              <p>Pago procesado mediante <b>transbank.</b></p>
              <small>${esc(statusSub)}</small>
            </div>
          </div>
        </section>

        <button class="receiptV51Primary" onclick="downloadReceiptPdf()">⇩ Descargar PDF</button>
        <button class="receiptV51Secondary" onclick="shareReceipt(${JSON.stringify(shareText).replace(/"/g,'&quot;')})">⤴ Compartir comprobante</button>
      </div>
    `);
  };

  function receiptIcon(name){
    const icons = {
      bookmark:'<svg viewBox="0 0 24 24"><path d="M7 4h10v16l-5-3-5 3V4Z"/><path d="M10 8h4"/></svg>',
      user:'<svg viewBox="0 0 24 24"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
      guardian:'<svg viewBox="0 0 24 24"><path d="M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M18 8v7"/><path d="M14.5 11.5h7"/></svg>',
      cap:'<svg viewBox="0 0 24 24"><path d="m3 9 9-5 9 5-9 5-9-5Z"/><path d="M7 12v4c2.5 2 7.5 2 10 0v-4"/></svg>',
      school:'<svg viewBox="0 0 24 24"><path d="M4 20h16"/><path d="M6 20V9l6-4 6 4v11"/><path d="M10 20v-6h4v6"/><path d="M9 11h6"/></svg>',
      card:'<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18"/><path d="M7 15h3"/></svg>',
      check:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></svg>'
    };
    return icons[name] || icons.check;
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
          <div class="muted" style="margin-top:6px;">AÃºn no hay informes publicados.</div>
        </div>
      `;
    }
    return `
      <div class="card">
        <div class="kTitle">Resumen del curso Â· ${esc(r.period||"")}</div>
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

  // Totales del mes (proyecciÃ³n y cobrado) + deudores Ãºnicos
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
  const sem = (cursoPct>=80) ? "ðŸŸ¢" : (cursoPct>=45 ? "ðŸŸ¡" : "ðŸ”´");
  const semMsg = (cursoPct>=80)
    ? "Vamos muy bien este mes"
    : (cursoPct>=45 ? "Vamos avanzando, aÃºn falta un poco" : "AtenciÃ³n: queda bastante por pagar este mes");

  // Agrupar pagos por campaÃ±a
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
      const title = String(t.title || "CampaÃ±a");
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
      // - Si el usuario definiÃ³ goalTotal/meta => lo respetamos como total de curso.
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
            <div>ðŸ’° Recaudado: <b>${clp(recaudado)}</b></div>
            <div>â³ Pendiente mes: <b>${clp(pendienteMes)}</b></div>
            <div>ðŸŽ¯ Objetivo: <b>${clp(objetivo)}</b></div>
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
                Resumen de cÃ³mo va el curso (montos globales, no personales)
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
                <div style="font-size:13px;opacity:.75;margin-top:2px;">${esc(semMsg)} Â· <b>${esc(ym)}</b></div>
              </div>
              <div style="font-weight:950;font-size:18px;">${cursoPct}%</div>
            </div>

            <div style="margin-top:10px;height:12px;background:#e5e7eb;border-radius:999px;overflow:hidden;">
              <div style="height:100%;width:${cursoPct}%;background:#16a34a;border-radius:999px;"></div>
            </div>

            <div style="margin-top:8px;font-size:13px;opacity:.9;">
              ðŸ’µ Cobrado mes: <b>${clp(cobradoMes)}</b> Â· â³ ProyecciÃ³n mes: <b>${clp(proyeccionMes)}</b> Â· ðŸ‘¥ Deudores mes: <b>${deudoresSet.size}</b>
            </div>
          </div>

          <div style="margin-top:14px;display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            ${kpi("ðŸ’°","Recaudado total", clp(r.recaudadoCurso||0))}
            ${kpi("ðŸ§¾","Gastado total", clp(r.gastadoCurso||0))}
            ${kpi("ðŸ¦","Saldo disponible", clp(r.disponibleCurso||0))}
            ${kpi("â³","Por cobrar este mes", clp(proyeccionMes - cobradoMes))}
          </div>

          <div style="margin-top:16px;">
            <div style="font-weight:950;font-size:16px;margin-bottom:10px;">ðŸ“Œ Indicadores por campaÃ±a</div>
            <div style="display:grid;gap:10px;">
              ${campRows || `<div style="opacity:.7;font-size:13px;">No hay campaÃ±as activas.</div>`}
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


// -------- DeduplicaciÃ³n de pagos (estabilidad) --------
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


// --- FIX v11: dedupe canÃ³nico para cambio Presidente -> Apoderado sin cerrar sesiÃ³n ---
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
    if(days < 0) return `Vencida hace ${Math.abs(days)} dÃ­a(s)`;
    if(days === 0) return "Vence hoy";
    return `Quedan ${days} dÃ­a(s)`;
  }

  function cpV5DateShort(iso){
    const s = String(iso||"").slice(0,10);
    if(!s) return "â€”";
    const d = new Date(s+"T00:00:00");
    if(isNaN(d.getTime())) return s;
    return d.toLocaleDateString("es-CL",{day:"2-digit",month:"short",year:"numeric"});
  }

  function cpV5DueItems(){
    try{
      const tasks = normalizeTasks(load(KEY_TASKS, []));
      let list = load(KEY_PAYMENTS, []);
      list = __restorePaymentsSnapshotIfEmptyV584(list);
      try{ list = cleanVisiblePaymentsV11(list, tasks).list; }catch(e){}
      __backupPaymentsSnapshotV584(list);
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
      return `<section class="cpV5Next"><div class="cpV5NextHead"><div class="cpV5Icon">${apoSvg("calendar")}</div><div class="cpV5Kicker">Próxima cuota</div></div><div style="padding:0 18px 18px;"><div class="cpV5DueCard" style="min-width:100%;"><div class="cpV5DueTitle">Todo al día</div><div class="cpV5DueMeta">No tienes pagos urgentes por ahora.</div><div class="cpV5Actions"><button class="cpV5Pay" onclick="go('payments')">Ver pagos</button></div></div></div></section>`;
    }
    return `<section class="cpV5Next"><div class="cpV5NextHead"><div class="cpV5Icon">${apoSvg("calendar")}</div><div class="cpV5Kicker">Próxima cuota</div></div><div class="cpV5Carousel">${items.slice(0,6).map((x,i)=>`<article class="cpV5DueCard"><div class="cpV5DueIndex">${i+1} de ${items.length}</div><div class="cpV5DueTitle">${esc(x.title)}</div><div class="cpV5DueMeta">Vence el ${esc(cpV5DateShort(x.dueDate))} <span class="cpV5Badge">${esc(cpV5DaysText(x.dueDate))}</span></div><div class="cpV5Amount">${clp(x.amount)}</div><div class="cpV5Actions"><button class="cpV5Pay" onclick="cpV5OpenPayment('${esc(x.id)}')">Pagar ahora</button><button class="cpV5Detail" onclick="go('payments')">Ver detalle</button></div></article>`).join("")}</div>${items.length>1 ? `<div class="cpV5Dots">${items.slice(0,6).map((_,i)=>`<span class="cpV5Dot ${i===0?'active':''}"></span>`).join("")}</div>` : ""}</section>`;
  }

  function cpV5QuickAccess(){
    return `<div class="cpV5QuickTitle">Accesos rápidos</div><div class="cpV5QuickGrid"><button class="cpV5Quick" onclick="go('payments')"><span>${apoSvg("card")}</span>Mis pagos</button><button class="cpV5Quick" onclick="go('payments')"><span>${apoSvg("receipt")}</span>Comprobantes</button><button class="cpV5Quick" onclick="go('payments')"><span>${apoSvg("card")}</span>Medios</button><button class="cpV5Quick" onclick="alert('Centro de ayuda próximamente')"><span>${apoSvg("report")}</span>Ayuda</button></div><div data-monetization-slot="apoderado"></div>`;
  }


  function enhanceApoderadoHomeProgressive(){
    try{
      const wrapCard = (card, title, subtitle, icon, count, tone)=>{
        if(!card || card.closest("details.cpV5Section")) return;
        const det = document.createElement("details");
        det.className = "cpV5Section";
        const sum = document.createElement("summary");
        const countHtml = count ? `<span class="cpV5Count ${tone||''}">${count}</span>` : "";
        sum.innerHTML = `<span class="cpV5SecLeft"><span class="cpV5SecIcon ${tone||''}">${icon}</span><span><span class="cpV5SecTitle">${title}</span><span class="cpV5SecSub">${subtitle}</span></span></span><span class="cpV5SecRight">${countHtml}<span class="cpV5Chevron">âŒ„</span></span>`;
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
        if(txt.includes("PrÃ³xima cuota") && !card.closest(".cpV5Next")){ card.style.display = "none"; return; }
        if(txt.includes("Avisos del curso")){
          const m = txt.match(/(\d+)\s+aviso/);
          wrapCard(card, "Avisos del curso", "InformaciÃ³n importante", "ðŸ“£", m ? m[1] : "", "info");
          return;
        }
        if(txt.includes("Pagos pendientes")){
          const m = txt.match(/(\d+)\s+pagos?/);
          wrapCard(card, "Pagos pendientes", "Tienes pagos por revisar", "ðŸ’³", m ? m[1] : "", "pay");
          return;
        }
        if(txt.includes("Estado del curso")){
          wrapCard(card, "Estado del curso", "Recaudado, gastado y disponible", "ðŸ“Š", "Ver", "chart");
          return;
        }
      });
    }catch(e){}
  }

function renderHome(){
    // datos para home
    let paysAll = load(KEY_PAYMENTS, []);
    paysAll = __restorePaymentsSnapshotIfEmptyV584(paysAll);
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
    __backupPaymentsSnapshotV584(paysAll);

    const pending = paysAll.filter(p => ["pending","partial","overdue"].includes(String(p.status||"").toLowerCase()) && !isPaymentOptedOut(p));
    const pendingTotal = pending.reduce((a,p)=> a + Number(p.amountRemaining ?? p.amount ?? 0), 0);

    const thisYM = (()=>{ const d=new Date(); const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,"0"); return `${y}-${m}`; })();

    const dueSorted = pending
      .filter(p=>p.dueDate && !isPaymentOptedOut(p))
      .sort((a,b)=>daysTo(a.dueDate)-daysTo(b.dueDate));

    const nextDue = dueSorted[0];

    const dueThisMonth = dueSorted.filter(p=>String(p.dueDate||"").startsWith(thisYM));
    // Agrupar por campaÃ±a (para mostrar varias campaÃ±as venciendo en el mes)
    const taskTitleById = (tid)=>{
      const t = tasks0.find(x=>String(x.id)===String(tid));
      return (t?.title || t?.name || "").trim();
    };
    const dueMonthByCampaignMap = {};
    for(const p of dueThisMonth){
      const tid = String(p.fromTaskId || p.taskId || "no_task");
      const title = taskTitleById(tid) || String(p.title || p.taskTitle || p.campaignTitle || "CampaÃ±a");
      if(!dueMonthByCampaignMap[tid]){
        dueMonthByCampaignMap[tid] = { taskId: tid, title, amount:0, dueDate: p.dueDate, payId: p.id };
      }
      dueMonthByCampaignMap[tid].amount += Number(p.amountRemaining ?? p.amount ?? 0);
      // mantener la fecha mÃ¡s prÃ³xima y el pago mÃ¡s prÃ³ximo para el botÃ³n
      if(p.dueDate && daysTo(p.dueDate) < daysTo(dueMonthByCampaignMap[tid].dueDate || p.dueDate)){
        dueMonthByCampaignMap[tid].dueDate = p.dueDate;
        dueMonthByCampaignMap[tid].payId = p.id;
      }
    }
    const dueMonthByCampaign = Object.values(dueMonthByCampaignMap).sort((a,b)=>daysTo(a.dueDate)-daysTo(b.dueDate));
    const multipleDueCampaigns = dueMonthByCampaign.length > 1;

    const thisMonthTotal = dueThisMonth.reduce((a,p)=> a + Number(p.amountRemaining ?? p.amount ?? 0), 0);

    const resumenFin = dashboardFinancieroApoderado(paysAll);

    // Desglose por campaÃ±a (con ID para no mezclar tÃ­tulos)
    const perCampaignMap = {};
    for(const p of pending){
      const tid = String(p.fromTaskId || p.taskId || "no_task");
      const title = taskTitleById(tid) || String(p.title || p.taskTitle || p.campaignTitle || "CampaÃ±a");
      if(!perCampaignMap[tid]) perCampaignMap[tid] = { taskId:tid, title, thisMonth:0, total:0 };
      perCampaignMap[tid].total += Number(p.amountRemaining ?? p.amount ?? 0);
    }
    for(const p of dueThisMonth){
      const tid = String(p.fromTaskId || p.taskId || "no_task");
      if(!perCampaignMap[tid]){
        const title = taskTitleById(tid) || String(p.title || p.taskTitle || p.campaignTitle || "CampaÃ±a");
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
      <div class="cpHomeV5 apoderado-home">${cpV5NextDues()}

      <!-- 1) PrÃ³xima cuota -->
      <div class="card" id="cardNextDue" style="border:1px solid rgba(91,92,226,.25);background:rgba(91,92,226,.06);">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
          <div class="kTitle">â° PrÃ³xima cuota <button class="helpBtn" data-help="proxima" type="button" aria-label="Ayuda prÃ³xima cuota">?</button></div>
          <span class="tag warn" id="homeDuePill">Vence pronto</span>
        </div>

        ${multipleDueCampaigns ? `
          <div class="muted" style="margin-top:8px;font-weight:900;">Varias campaÃ±as vencen este mes. Elige cuÃ¡l pagar:</div>

          <div style="margin-top:10px;display:grid;gap:10px;">
            ${dueMonthByCampaign.map((c, idx)=>`
              <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;border:1px solid rgba(0,0,0,.08);border-radius:12px;padding:10px;">
                <div style="min-width:0;">
                  <div style="font-weight:950;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(c.title)}</div>
                  <div class="muted" style="font-size:12px;">Vence en <b>${daysTo(c.dueDate)}</b> dÃ­as Â· ${esc(c.dueDate || "")}</div>
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
            Vence <b id="homeNextDueDate">${nextDue?.dueDate ? esc(nextDue.dueDate) : "â€”"}</b>
            Â· Quedan <b id="homeNextDueDays">${nextDue?.dueDate ? (daysTo(nextDue.dueDate) ?? "â€”") : "â€”"}</b> dÃ­as
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
          <div class="kTitle">ðŸ’³ Pagos pendientes <button class="helpBtn" data-help="pendientes" type="button" aria-label="Ayuda pagos pendientes">?</button></div>
          ${hasNew ? `<span class="tag" style="font-weight:950;">ðŸ†• Nuevo</span>` : ``}
        </div>

        <div class="muted" style="margin-top:6px;font-weight:900;" id="homePendingText">
          En total tienes <b id="homePendingCount">${pending.length}</b> pagos pendientes
        </div>

        <div style="margin-top:12px;">
          <div class="muted" style="font-weight:900;">Este mes</div>
          <div style="margin-top:6px;font-size:28px;font-weight:950;" id="homeThisMonthTotal">${formatCLP(thisMonthTotal)}</div>
          <div class="muted" style="margin-top:4px;font-size:12px;">(${esc(thisYM)})</div>
        </div>

        <div class="muted" style="margin-top:10px;font-size:12px;">Total pendiente anual (todas las campaÃ±as): <b>${formatCLP(pendingTotal)}</b></div>

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

      <!-- 3) Estado del curso (mÃ¡s humano) -->
      <div class="card" style="margin-top:12px;">
           <div class="kTitle">ðŸ“Š Estado del curso</div>
        <div class="muted" style="margin-top:6px;line-height:1.45;">
          AsÃ­ va el fondo del curso. Estos montos son del curso completo, no personales.
        </div>

        ${
          r ? `
          <div style="margin-top:12px;">
            <div style="display:flex;justify-content:space-between;"><span>ðŸ’° Recaudado</span><b>${clp(r.recaudadoCurso||0)}</b></div>
            <div style="display:flex;justify-content:space-between;margin-top:6px;"><span>ðŸ§¾ Gastado</span><b>${clp(r.gastadoCurso||0)}</b></div>
            <div style="display:flex;justify-content:space-between;margin-top:6px;"><span>ðŸ“¦ Disponible</span><b>${clp(r.disponibleCurso||0)}</b></div>
          </div>
          <div class="actions" style="margin-top:12px;justify-content:flex-end;">
            <button class="btnx" onclick="openReport('${esc(r.period||"")}')">Ver informe</button>
          </div>
          ` : `
          <div class="muted" style="margin-top:10px;font-weight:900;">AÃºn no hay informes publicados.</div>
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

    // botÃ³n pagar ahora (caso 1 campaÃ±a)
    const payNext = document.getElementById("btnPayNext");
    if(payNext){
      payNext.onclick = ()=>{
        if(nextDue?.id) payNow(nextDue.id);
        else go("payments");
      };
    }

    // botones pagar por campaÃ±a (cuando hay varias venciendo este mes)
    if(multipleDueCampaigns){
      for(const c of dueMonthByCampaign){
        const b = document.getElementById(`btnPayCamp_${c.taskId}`);
        if(!b) continue;
        b.onclick = ()=>{
          // ir directo a pagos de esa campaÃ±a (y permitir pagar)
          try{ window.__apoTaskFilter = c.taskId; }catch(e){}
          try{ if(typeof window.setPayFilter === "function") window.setPayFilter("pending"); }catch(e){}
          if(c.payId) payNow(c.payId);
          else go("payments");
        };
      }
    }

    // Si estÃ¡ al dÃ­a: copy divertido
    const upcoming = paysAll.filter(p => String(p.status||"").toLowerCase()==="pending" && p.dueDate && daysTo(p.dueDate) >= 1 && daysTo(p.dueDate) <= 7 && !isPaymentOptedOut(p));
    if(pending.length===0 && upcoming.length===0){
      const title = document.querySelector("#cardNextDue .kTitle");
      if(title) title.innerHTML = "ðŸ¥³ Â¡Todo al dÃ­a!";
      const pill = document.getElementById("homeDuePill");
      if(pill){ pill.className="tag ok"; pill.textContent="Todo en orden"; }
      const amt = document.getElementById("homeNextDueAmount");
      if(amt){ amt.textContent="No tienes pagos por ahora ðŸ˜„"; amt.style.fontSize="20px"; }
      const txt = document.getElementById("homePendingText");

      // ocultar lÃ­nea de vencimiento cuando estÃ¡ al dÃ­a
      const metaLine = document.querySelector("#cardNextDue .muted");
      if(metaLine) metaLine.style.display = "none";

      // botÃ³n menos "ansioso" cuando estÃ¡ al dÃ­a
      const btn = document.querySelector("#cardNextDue .btnx");
      if(btn){
        btn.classList.remove("primary");
        btn.textContent = "Revisar pagos";
      }
      if(txt) txt.innerHTML = "Â¡Cero pendientes! ðŸ™Œ Disfruta la tranquilidad";
    }
  }

  let payFilter="pending";
  window.setPayFilter=(f)=>{ payFilter=f; renderPayments(); };

  function renderPayments(){
    let paysAll = load(KEY_PAYMENTS, []);
    paysAll = __restorePaymentsSnapshotIfEmptyV584(paysAll);
    const ddP = dedupePaymentsAll(paysAll);
    if(ddP.changed) save(KEY_PAYMENTS, ddP.list);
    paysAll = ddP.list;
    const tasksAll = normalizeTasks(load(KEY_TASKS, []));
    // pago reciÃ©n efectuado (para banner por campaÃ±a)
    let justPaidId = "";
    try{ justPaidId = sessionStorage.getItem("justPaidPaymentId") || ""; }catch(e){}


    const ident = (typeof getActiveIdentity==="function") ? getActiveIdentity() : null;
    // Fase 2B: no crear pagos locales en Apoderado. Los pagos nacen en Supabase.
    // paysAll = ensurePaymentsForIdentity(ident, tasksAll, paysAll);

    // FIX v11: dedupe real antes de pintar pagos/campaÃ±as.
    try{
      const clean = cleanVisiblePaymentsV11(paysAll, tasksAll);
      if(clean.changed) save(KEY_PAYMENTS, clean.list);
      paysAll = clean.list;
    }catch(e){}

    // Fase 2B: descartar pagos legacy locales pay_xxx; solo Supabase pagos.id UUID.
    paysAll = onlySupabasePayments(paysAll);

    // âœ… Scope por apoderado (evita cruce entre usuarios):
    // - Si el pago ya tiene apoderadoKey, se filtra por ese usuario
    // - Si viene "legacy" sin apoderadoKey, se asocia por alumno elegido en sesiÃ³n
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
    __backupPaymentsSnapshotV584(paysAll);

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
        <button class="chip ${payFilter==="upcoming"?"active":""}" onclick="setPayFilter('upcoming')">PrÃ³ximas</button>
        <button class="chip ${payFilter==="paid"?"active":""}" onclick="setPayFilter('paid')">Pagadas</button>
        <button class="chip ${payFilter==="credit"?"active":""} ${creditTotal>0?"":"disabled"}" ${creditTotal>0?`onclick="setPayFilter(\'credit\')"`:""}>${creditTotal>0?"ðŸ’° Saldo a favor":"Saldo a favor"}</button>
      </div>
    `;

    const taskOptions = (tasksAll.length>1 || (paysAll||[]).some(p=>!p.fromTaskId)) ? `
      <div style="margin-top:12px;">
        <div class="muted" style="font-weight:900;margin-bottom:6px;">ðŸ” CampaÃ±a</div>
        <select id="taskFilter" style="width:100%;padding:12px;border-radius:12px;border:1px solid rgba(0,0,0,.12);font-weight:900;">
          <option value="all">Todas las campaÃ±as</option>
          ${tasksAll.map(t=>`<option value="${esc(t.id)}" ${selectedTask===t.id?"selected":""}>${esc(t.title||"CampaÃ±a")}</option>`).join("")}
          <option value="no_task" ${selectedTask==="no_task"?"selected":""}>Otros (sin campaÃ±a)</option>
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

      const paidJust = (justPaidId && justPaidId===String(r.id)) ? `<span class="tag ok">âœ… Pago efectuado</span>` : ``;

      const badges = `<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">${paidJust}
        ${badge}${monthTag}${r.typeTag?`<span class="tag">${esc(r.typeTag)}</span>`:""}
      </div>`;

      const due = r.dueDate ? dueBadge(r.dueDate) : ``;
      const paidInfo = isPaidRow ? (()=>{ const dt = r.paidAt ? new Date(r.paidAt).toLocaleDateString("es-CL") : "â€”"; const op = r.transactionId || r.webpay?.buyOrder || "â€”"; return `<div class="muted" style="margin-top:6px;">Pagada ${esc(dt)} Â· Op ${esc(op)}</div>`; })() : ``;
      const dueTxt = r.dueDate ? `<div class="muted" style="margin-top:6px;">Vence ${esc(r.dueDate)} Â· ${due}</div>` : ``;

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
                      ? `<button class="btnx" onclick="openReceipt('${esc(r.id)}')">ðŸ§¾ Comprobante</button>`
                      : (optedOut ? `<span class="tag">No participo</span>` : `<span class="muted">â€”</span>`))
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

    // prÃ³xima cuota destacada (solo si hay pendiente con fecha)
    const nextDueBase = (selectedTask && selectedTask!=="all")
      ? paysAll.filter(p => (p.fromTaskId || "no_task") === selectedTask)
      : paysAll;

    const nextDue = nextDueBase
      .filter(p=>String(p.status||"").toLowerCase()==="pending" && p.dueDate && !isPaymentOptedOut(p))
      .sort((a,b)=>daysTo(a.dueDate)-daysTo(b.dueDate))[0];

    const nextCard = nextDue ? `
      <div class="card" style="margin-top:12px;border:1px solid rgba(91,92,226,.22);background:rgba(91,92,226,.06);">
        <div style="font-weight:950;">PrÃ³xima cuota</div>
        <div class="muted" style="margin-top:6px;font-weight:900;">CampaÃ±a: <b>${esc((tasksAll.find(t=>t.id===nextDue.fromTaskId)?.title)||"â€”")}</b></div>
        <div class="muted" style="margin-top:6px;font-weight:800;">
          Vence ${esc(nextDue.dueDate)} Â· ${dueBadge(nextDue.dueDate)}
        </div>
        <div style="margin-top:10px;display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap;">
          <div style="font-weight:950;font-size:18px;">${formatCLP(nextDue.amountRemaining ?? nextDue.amount ?? 0)}</div>
          <button class="btnx primary" onclick="payNow('${esc(nextDue.id)}')">Pagar</button>
        </div>
      </div>
    ` : ``;
    // Aplicar filtro por campaÃ±a (si no es "all")
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

// agrupar pagos por campaÃ±a
    const paysByTask = {};
    paysFiltered.forEach(p=>{
      const tid = p.fromTaskId || "no_task";
      paysByTask[tid] = paysByTask[tid] || [];
      paysByTask[tid].push(p);
    });

    function campaignMeta(t){
      const type = (String(t.type||"") === "monthly") ? `Mensual Â· ${Number(t.months||1)} cuota(s)` : "Pago Ãºnico";
      const part = (t.mandatoryParticipation===false) ? "No obligatoria" : "Obligatoria";
      return { type, part, amount:Number(t.amount||0), range:(t.startDate&&t.dueDate)?`${t.startDate} â†’ ${t.dueDate}`:"" };
    }

    function emptyCampaignCard(t){
      const m = campaignMeta(t);
      return `
        <div class="card" style="margin-top:12px;">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                  <div style="font-weight:950;font-size:18px;">${esc(t.title||"CampaÃ±a")}</div>
                  <span class="tag">CampaÃ±a</span>
                </div>
          ${m.range?`<div class="muted" style="margin-top:6px;">${esc(m.range)}</div>`:""}
          <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">
            <span class="tag">Monto ${formatCLP(m.amount)}</span>
            <span class="tag">${esc(m.type)}</span>
            <span class="tag">${esc(m.part)}</span>
          </div>
          <div class="muted" style="margin-top:10px;font-weight:800;line-height:1.45;">
            ${t.mandatoryParticipation===false ? "Esta campaÃ±a es voluntaria. Se generarÃ¡n cobros pendientes para quienes participen; tambiÃ©n puedes marcar No participo." : "AÃºn no hay cobros generados para ti en esta campaÃ±a. Si acabas de ingresar, vuelve a abrir Pagos para que se creen automÃ¡ticamente."}
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
                      <div style="font-weight:950;">${esc(t.title||"CampaÃ±a")}</div>
                      ${oo ? `
                        <button class="btnx" style="border:1px solid rgba(0,0,0,.14);" onclick="toggleOptOut('${esc(t.id)}')">Participar</button>
                      ` : ``}
                    </div>
                    <div class="muted" style="margin-top:6px;">
                      ${oo ? `Marcaste <b>No participo</b>. Puedes volver a participar aquÃ­.` : `No hay pagos para este filtro en esta campaÃ±a.`}
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
                  <div style="font-weight:950;font-size:18px;">${esc(t.title||"CampaÃ±a")}</div>
                  <span class="tag">CampaÃ±a</span>
                </div>
                  <div class="muted" style="margin-top:6px;">${esc(m.type)} Â· ${esc(m.part)}</div>
                </div>
                ${t.mandatoryParticipation===false ? `
                  <button class="btnx" style="border:1px solid rgba(0,0,0,.14);" onclick="toggleOptOut('${esc(t.id)}')">
                    ${isOptedOut(t.id) ? "Participar" : "No participo"}
                  </button>
                ` : ``}
              </div>
${(justPaidId && rows.some(x=>String(x.id)===String(justPaidId))) ? `<div style="margin-top:10px;padding:10px 12px;border-radius:14px;background: rgba(34,197,94,.12);border: 1px solid rgba(34,197,94,.22);font-weight: 900;">âœ… Pago registrado. Gracias ðŸ™Œ</div>` : ``}
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
                        <div style="font-weight:950;">InformaciÃ³n</div>
                        <div class="muted" style="margin-top:4px;">Cotizaciones referenciales (no es cobro).</div>
                      </div>
                      <button class="btnx" onclick="openCotizacionesModal('${esc(t.id)}')">Ver cotizaciones</button>
                    </div>
                    <div class="muted" style="margin-top:8px;font-weight:900;">
                      Cotizaciones Â· ${items.length} Ã­tem(s) Â· Total ${formatCLP(totalC)}
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
                  <div style="font-weight:950;font-size:18px;">${esc(t.title||"CampaÃ±a")}</div>
                  <span class="tag">CampaÃ±a</span>
                </div>
                <div class="muted" style="margin-top:6px;">${esc(m.type)} Â· ${esc(m.part)}</div>
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

            ${(justPaidId && rows.some(x=>String(x.id)===String(justPaidId))) ? `<div style="margin-top:10px;padding:10px 12px;border-radius:14px;background: rgba(34,197,94,.12);border: 1px solid rgba(34,197,94,.22);font-weight: 900;">âœ… Pago registrado. Gracias ðŸ™Œ</div>` : ``}

            <div style="margin-top:10px;">
              <div style="height:10px;border-radius:999px;background:rgba(17,24,39,.08);overflow:hidden;">
                <div style="height:100%;width:${progressPct}%;background:rgba(91,92,226,.85);"></div>
              </div>
              <div class="muted" style="margin-top:6px;font-weight:900;">
                ${pendCount ? `Quedan ${pendCount} cuota(s) por pagar ðŸ˜…` : `Â¡Listo! CampaÃ±a al dÃ­a ðŸ¥³`}
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
                        <div style="font-weight:950;">InformaciÃ³n</div>
                        <div class="muted" style="margin-top:4px;">Cotizaciones referenciales (no es cobro).</div>
                      </div>
                      <button class="btnx" onclick="openCotizacionesModal('${esc(t.id)}')">Ver cotizaciones</button>
                    </div>
                    <div class="muted" style="margin-top:8px;font-weight:900;">
                      Cotizaciones Â· ${items.length} Ã­tem(s) Â· Total ${formatCLP(totalC)}
                    </div>
                  </div>
                `;
              })()}

          </div>
        `;
}).join("");

    const others = (paysByTask["no_task"]||[]).length ? `
      <div class="card" style="margin-top:12px;">
        <div style="font-weight:950;">Otros (sin campaÃ±a)</div>
        <div class="muted" style="margin-top:6px;">Cobros no asociados a una campaÃ±a</div>
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
          <div class="toastOk">âœ… Pago registrado. Gracias ðŸ™Œ</div>
        `;
      }
    }catch(e){}

    app.innerHTML = `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
          <div class="kTitle">Pagos <button class="helpBtn" data-help="vencida" type="button" aria-label="Ayuda pagos">?</button></div>
          ${hasNew ? `<span class="tag" style="font-weight:950;">ðŸ†• Nuevo</span>` : ``}
        </div>
                <div class="muted" style="margin-top:6px;">ðŸ’¡ El saldo a favor se descuenta automÃ¡ticamente.</div>
        ${chips}
      </div>

      ${taskOptions}

      ${nextCard}

      ${
        emptyAll
          ? (() => {
            if(payFilter==="pending") return `<div class="card" style="margin-top:12px;"><div class="muted" style="font-weight:900;line-height:1.45;">ðŸŽ‰ No tienes pagos pendientes. Te avisaremos cuando la directiva publique un cobro ðŸ˜Š</div></div>`;
            if(payFilter==="upcoming") return `<div class="card" style="margin-top:12px;"><div class="muted" style="font-weight:900;line-height:1.45;">ðŸ“… No hay pagos prÃ³ximos por ahora.</div></div>`;
            if(payFilter==="paid") return `<div class="card" style="margin-top:12px;"><div class="muted" style="font-weight:900;line-height:1.45;">AÃºn no tienes pagos registrados.</div></div>`;
            if(payFilter==="credit") return `<div class="card" style="margin-top:12px;"><div class="muted" style="font-weight:900;line-height:1.45;">No tienes saldo a favor por ahora.</div></div>`;
            return `<div class="card" style="margin-top:12px;"><div class="muted" style="font-weight:900;line-height:1.45;">AÃºn no hay campaÃ±as ni cobros publicados. Te avisaremos cuando haya novedades ðŸ˜Š</div></div>`;
          })()
          : (campaignCards || `<div class="card" style="margin-top:12px;"><div class="muted">Sin pagos para este filtro.</div></div>`)
      }

      ${others}
    `;

    // hook filtro campaÃ±a
    const sel = document.getElementById("taskFilter");
    if(sel){
      sel.onchange = ()=>{
        window.__apoTaskFilter = sel.value;
        renderPayments();
      };
    }

    // marcar como visto (para badge ðŸ†•)
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



  
  // Pagar campaÃ±a single: paga todas las filas pendientes de ese taskId
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
      if(remainingTotal<=0) alert(`âœ… Pago cubierto con saldo a favor.\nAplicado: ${clp(usedCreditTotal)}`);
      else alert(`âœ… Se aplicÃ³ saldo a favor: ${clp(usedCreditTotal)}\nRestante por pagar: ${clp(remainingTotal)} (demo)`);
    }else{
      alert("Pago realizado âœ… (demo)");
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
      alert("Este pago viene de una referencia antigua del navegador. ActualicÃ© desde Supabase; vuelve a presionar Pagar.");
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
      `).join("") : `<div class="card"><div class="muted">AÃºn no hay informes publicados.</div></div>`}
    `;
  }

  // ----- Apoderado Premium v2 visual overrides -----
  function apoSvg(name){
    const paths = {
      card:'<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18"/><path d="M7 15h4"/>',
      receipt:'<path d="M7 3h10v18l-2-1.2-2 1.2-2-1.2-2 1.2-2-1.2V3Z"/><path d="M9 8h6"/><path d="M9 12h6"/><path d="M9 16h4"/>',
      report:'<path d="M6 3h9l3 3v15H6V3Z"/><path d="M14 3v4h4"/><path d="M9 13h6"/><path d="M9 17h6"/>',
      store:'<path d="M4 10h16l-1-5H5l-1 5Z"/><path d="M6 10v10h12V10"/><path d="M9 20v-6h6v6"/>',
      check:'<circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/>',
      calendar:'<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M8 3v4M16 3v4M4 10h16"/>',
      chart:'<path d="M4 19V5"/><path d="M4 19h17"/><rect x="7" y="11" width="3" height="5" rx="1"/><rect x="12" y="7" width="3" height="9" rx="1"/><rect x="17" y="4" width="3" height="12" rx="1"/>',
      megaphone:'<path d="M4 14V9a2 2 0 0 1 2-2h2l9-3v15l-9-3H6a2 2 0 0 1-2-2Z"/><path d="M8 16v4"/>',
      chevron:'<path d="m9 18 6-6-6-6"/>'
    };
    return `<svg class="apoV2IconSvg" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths[name] || paths.report}</svg>`;
  }

  function apoMonthShort(iso){
    const months = ["ENE","FEB","MAR","ABR","MAY","JUN","JUL","AGO","SEP","OCT","NOV","DIC"];
    const d = iso ? new Date(String(iso) + "T00:00:00") : new Date();
    return months[d.getMonth()] || "MES";
  }

  function apoFirstName(value){
    return String(value || "").trim().split(/\s+/).filter(Boolean)[0] || "";
  }

  function apoWeekday(iso){
    if(!iso) return "";
    const days = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];
    const d = new Date(String(iso) + "T00:00:00");
    return days[d.getDay()] || "";
  }

  function apoPaymentIllustration(){
    return `
      <div class="apoV2PayIllustration" aria-hidden="true">
        <span class="apoV2Paper"><i></i><i></i><i></i></span>
        <span class="apoV2CardMini"></span>
        <span class="apoV2Coin">$</span>
        <span class="apoV2CheckMini">${apoSvg("check")}</span>
      </div>`;
  }

  renderHome = function(){
    let paysAll = load(KEY_PAYMENTS, []);
    paysAll = __restorePaymentsSnapshotIfEmptyV584(paysAll);
    try{ paysAll = dedupePaymentsAll(paysAll).list; }catch(e){}
    try{ paysAll = cleanVisiblePaymentsV11(paysAll, normalizeTasks(load(KEY_TASKS, []))).list; }catch(e){}
    paysAll = onlySupabasePayments(paysAll).filter(isMinePayment);

    const pending = paysAll.filter(p => ["pending","partial","overdue"].includes(String(p.status||"").toLowerCase()) && !isPaymentOptedOut(p));
    const paid = paysAll.filter(p => String(p.status||"").toLowerCase()==="paid");
    const pendingTotal = pending.reduce((a,p)=>a+Number(p.amountRemaining ?? p.amount ?? 0),0);
    const paidTotal = paid.reduce((a,p)=>a+Number(p.amount ?? p.amountPaid ?? 0),0);
    const nextDue = pending.slice().sort((a,b)=>daysTo(a.dueDate)-daysTo(b.dueDate))[0];
    const nextTitle = nextDue?.title || nextDue?.concept || "Sin pagos pendientes";
    const nextAmount = nextDue ? clp(nextDue.amountRemaining ?? nextDue.amount ?? 0) : "$0";
    const nextDays = nextDue?.dueDate ? Math.max(0, daysTo(nextDue.dueDate) || 0) : 0;
    const nextDate = nextDue?.dueDate ? new Date(String(nextDue.dueDate)+"T00:00:00") : null;
    const nextDay = nextDate ? String(nextDate.getDate()).padStart(2,"0") : "--";
    const nextMonth = nextDue?.dueDate ? apoMonthShort(nextDue.dueDate) : "MES";
    const nextThisMonth = pending.filter(p => String(p.dueDate || "").slice(0,7) === new Date().toISOString().slice(0,7)).length;
    const payAction = nextDue?.id ? `payNow('${esc(nextDue.id)}')` : `go('payments')`;
    const dueItems = pending.slice().sort((a,b)=>daysTo(a.dueDate)-daysTo(b.dueDate)).slice(0,6);
    const dueSlides = (dueItems.length ? dueItems : [null]).map((p, index)=>{
      const title = p?.title || p?.concept || "Sin pagos pendientes";
      const amount = p ? clp(p.amountRemaining ?? p.amount ?? 0) : "$0";
      const rawDays = p?.dueDate ? (daysTo(p.dueDate) ?? 0) : 0;
      const days = p?.dueDate ? Math.max(0, rawDays) : 0;
      const isOverdue = !!p?.dueDate && rawDays < 0;
      const date = p?.dueDate ? new Date(String(p.dueDate)+"T00:00:00") : null;
      const day = date ? String(date.getDate()).padStart(2,"0") : "--";
      const month = p?.dueDate ? apoMonthShort(p.dueDate) : "MES";
      const weekday = p?.dueDate ? apoWeekday(p.dueDate) : "";
      const action = p?.id ? `payNow('${esc(p.id)}')` : `go('payments')`;
      const overdueDays = Math.abs(rawDays);
      const meta = p?.dueDate
        ? (isOverdue ? `Venció el ${esc(p.dueDate)} · hace ${overdueDays} día(s)` : `Vence el ${esc(p.dueDate)} · quedan ${days} día(s)`)
        : "Te avisaremos cuando existan nuevas cuotas.";
      const shortDue = p?.dueDate ? (isOverdue ? "Vencida" : (days === 0 ? "Vence hoy" : `Vence en ${days} día(s)`)) : "";
      return `
        <article class="apoV2DueSlide ${isOverdue ? "is-overdue" : ""}" aria-label="${esc(title)} ${dueItems.length ? `${index+1} de ${dueItems.length}` : ""}">
          <div class="apoV2DateBox"><b>${esc(month)}</b><span>${esc(day)}</span><small>${esc(weekday)}</small></div>
          <div class="apoV2DueMain">
            <p class="apoV2Kicker">Próxima cuota</p>
            <h1>${esc(title)}</h1>
            <p class="apoV2DueMeta">${shortDue ? `<b>${esc(shortDue)}</b><br>` : ""}${meta}</p>
            <strong>${amount}</strong>
          </div>
          ${apoPaymentIllustration()}
          <div class="apoV2DueActions">
            <button class="apoV2Pay" type="button" onclick="${action}">${p ? "Pagar ahora" : "Ver pagos"}</button>
            <button class="apoV2Detail" type="button" onclick="go('payments')">Ver detalle</button>
          </div>
        </article>`;
    }).join("");
    const dueDots = dueItems.length > 1
      ? `<div class="apoV2DueDots" aria-label="Cuotas pendientes">${dueItems.map((_,i)=>`<span class="${i===0 ? "active" : ""}"></span>`).join("")}</div>`
      : "";

    const quick = [
      {label:"Pagos", sub:"Revisa y paga tus cuotas pendientes", icon:"card", cls:"", action:"go('payments')"},
      {label:"Comprobantes", sub:"Descarga tus comprobantes de pago", icon:"receipt", cls:"", action:"go('payments')"},
      {label:"Informes", sub:"Revisa los informes publicados del curso", icon:"report", cls:"", action:"go('informes')"},
      {label:"Mercado Escolar", sub:"Encuentra productos y servicios del curso", icon:"store", cls:"market", badge:"Nuevo", action:"window.location.href='/mercado-escolar/mercado-escolar.html'"}
    ].map(x=>`<button class="apoV2Quick quick-access-card ${x.cls} ${x.cls === "market" ? "market-access-card" : ""}" type="button" onclick="${x.action}"><span class="apoV2QuickIcon apoderado-icon-bubble ${x.cls === "market" ? "market-icon" : ""}">${apoSvg(x.icon)}</span><span><b class="${x.cls === "market" ? "market-access-card-title" : ""}">${esc(x.label)}</b><small class="${x.cls === "market" ? "market-access-card-subtitle" : ""}">${esc(x.sub)}</small></span>${x.badge ? `<em class="apoV2QuickBadge">${esc(x.badge)}</em>` : ""}<i>${apoSvg("chevron")}</i></button>`).join("");
    const fixApoMojibake = (value) => String(value || "")
      .replace(/ðŸ“Š\s*/g, "")
      .replace(/ðŸ“£\s*/g, "")
      .replace(/ðŸ””\s*/g, "")
      .replace(/Ã¡/g, "á").replace(/Ã©/g, "é").replace(/Ã­/g, "í").replace(/Ã³/g, "ó").replace(/Ãº/g, "ú")
      .replace(/Ã�/g, "Á").replace(/Ã‰/g, "É").replace(/Ã�/g, "Í").replace(/Ã“/g, "Ó").replace(/Ãš/g, "Ú")
      .replace(/Ã±/g, "ñ").replace(/Ã‘/g, "Ñ")
      .replace(/Â·/g, "·").replace(/â€¢/g, "·").replace(/â€”/g, "—").replace(/â€“/g, "–")
      .replace(/Informaci\S+n importante/g, "Información importante")
      .replace(/Avisos le\S+dos/g, "Avisos leídos")
      .replace(/A\S+n no hay avisos/g, "Aún no hay avisos");
    function apoV40LoadNoticeItems(){
      const keys = [];
      try{
        for(let i=0;i<localStorage.length;i++){
          const k = localStorage.key(i);
          if(k && /_avisos_v2$/.test(k)) keys.push(k);
        }
      }catch(e){}
      const scopeCandidates = [];
      try{ const active = localStorage.getItem("cursapp_active_course_v1"); if(active) scopeCandidates.push(String(active).replace(/[^a-zA-Z0-9_\-]/g,"_")); }catch(e){}
      try{ const course = JSON.parse(localStorage.getItem("cursapp_course_v1") || "null"); const ck = course && course.courseKey; if(ck) scopeCandidates.push(String(ck).replace(/[^a-zA-Z0-9_\-]/g,"_")); }catch(e){}
      const ordered = keys.sort((a,b)=>{
        const ai = scopeCandidates.some(sc=>a.includes(sc)) ? 0 : 1;
        const bi = scopeCandidates.some(sc=>b.includes(sc)) ? 0 : 1;
        return ai - bi;
      });
      let items = [];
      ordered.forEach(k=>{
        try{
          const arr = JSON.parse(localStorage.getItem(k) || "[]");
          if(Array.isArray(arr)) items = items.concat(arr);
        }catch(e){}
      });
      const seen = new Set();
      return items
        .filter(a=>a && (a.title || a.message))
        .map(a=>({
          id:String(a.id || a.createdAt || Math.random()),
          title:fixApoMojibake(a.title || "Aviso del curso"),
          message:fixApoMojibake(a.message || ""),
          category:String(a.category || a.type || "info"),
          createdAt:String(a.createdAt || "")
        }))
        .filter(a=>{ const key=a.id+"|"+a.title; if(seen.has(key)) return false; seen.add(key); return true; })
        .sort((a,b)=>String(b.createdAt||"").localeCompare(String(a.createdAt||"")))
        .slice(0,1);
    }
    function apoV40NoticeIcon(category){
      const c = String(category || "").toLowerCase();
      if(c.includes("report")) return "📊";
      if(c.includes("payment") || c.includes("financial")) return "💳";
      if(c.includes("urgent")) return "⚠️";
      if(c.includes("campaign")) return "📌";
      return "📣";
    }
    function apoV40NoticeDate(iso){
      if(!iso) return "";
      try{ return new Date(iso).toLocaleString("es-CL", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" }); }catch(e){ return String(iso).slice(0,16); }
    }
    const noticeItems = apoV40LoadNoticeItems();
    const realAvisos = noticeItems.length ? noticeItems.map(a=>`
      <article class="apoV2Notice apoV40NoticeCard">
        <span class="apoV40NoticeIcon">${apoV40NoticeIcon(a.category)}</span>
        <div class="apoV40NoticeCopy">
          <h3>${esc(a.title)}</h3>
          <p>${esc(a.message || "Revisa el detalle del aviso publicado por la directiva.")}</p>
          ${a.createdAt ? `<small>${esc(apoV40NoticeDate(a.createdAt))}</small>` : ""}
        </div>
        <button type="button" onclick="openAvisosInbox()">Ver</button>
      </article>`).join("") : `<article class="apoV2Notice apoV40NoticeCard"><span class="apoV40NoticeIcon">📣</span><div class="apoV40NoticeCopy"><h3>Sin avisos nuevos</h3><p>Aún no hay mensajes publicados por la directiva.</p></div></article>`;

    app.innerHTML = `
      <div class="apoV2Page apoderado-home">
        <section class="apoV2DueCarousel next-payment-card" aria-label="Próximas cuotas">
          <div class="apoV2DueTrack">${dueSlides}</div>
          ${dueDots}
        </section>

        <section class="apoV2SummaryCard quick-summary-card" aria-label="Resumen rápido">
          <div class="apoV2SummaryHead"><h2>Resumen rápido</h2><button type="button" onclick="go('payments')">Ver todo</button></div>
          <div class="apoV2Summary">
            <article class="quick-summary-item is-pending"><span class="icon-circle">${apoSvg("card")}</span><small>Pendiente</small><b>${clp(pendingTotal)}</b><em>${pending.length} ${pending.length === 1 ? "pago" : "pagos"}</em></article>
            <article class="quick-summary-item is-paid"><span class="icon-circle">${apoSvg("check")}</span><small>Pagadas</small><b>${paid.length}</b><em>Este año</em></article>
            <article class="quick-summary-item is-next"><span class="icon-circle">${apoSvg("calendar")}</span><small>Próximas</small><b>${nextThisMonth}</b><em>Este mes</em></article>
            <article class="quick-summary-item is-total"><span class="icon-circle">${apoSvg("chart")}</span><small>Total pagado</small><b>${clp(paidTotal)}</b><em>Este año</em></article>
          </div>
        </section>

        <section class="apoV2Section">
          <h2>Accesos rápidos</h2>
          <div class="apoV2QuickGrid quick-access-grid">${quick}</div>
        </section>

        <section class="apoV2Section apoV2NoticeSection">
          <div class="apoV2SectionHead"><h2>Avisos del curso</h2><button type="button" onclick="openAvisosInbox()">Ver todos</button></div>
          <div class="apoV2RealAvisos">${realAvisos || `<article class="apoV2Notice"><span>${apoSvg("megaphone")}</span><div><h3>Sin avisos nuevos</h3><p>Aún no hay mensajes publicados por la directiva.</p></div></article>`}</div>
        </section>
        <div data-monetization-slot="apoderado"></div>
      </div>`;
    try{ setupApoV44DueCarousel(); }catch(e){}
    try{ keepApoV45BellAlive(); }catch(e){}
    try{ if(window.CursappMonetization) setTimeout(()=>window.CursappMonetization.render(),120); }catch(e){}
  };
  renderPayments = function(){
    let paysAll = load(KEY_PAYMENTS, []);
    paysAll = __restorePaymentsSnapshotIfEmptyV584(paysAll);
    try{ paysAll = dedupePaymentsAll(paysAll).list; }catch(e){}
    const tasksAll = normalizeTasks(load(KEY_TASKS, []));
    try{ paysAll = cleanVisiblePaymentsV11(paysAll, tasksAll).list; }catch(e){}
    paysAll = onlySupabasePayments(paysAll).filter(isMinePayment);

    const yearNow = new Date().getFullYear();
    const monthNow = new Date().getMonth();
    const statusOf = (p)=>String(p?.status||"pending").toLowerCase();
    const isPaid = (p)=>statusOf(p)==="paid";
    const isPending = (p)=>["pending","partial","overdue"].includes(statusOf(p)) && !isPaymentOptedOut(p);
    const amountOf = (p)=>Number((isPaid(p) ? (p.amountPaid ?? p.amount) : (p.amountRemaining ?? p.amount)) || 0);
    const taskOf = (p)=> tasksAll.find(t=>String(t.id)===String(p.fromTaskId)) || null;
    const titleOf = (p)=>{
      const t = taskOf(p);
      return p.title || p.concept || p.taskTitle || p.campaignTitle || p.fromTaskTitle || t?.title || "Pago del curso";
    };
    const groupKeyOf = (p)=> String(p.fromTaskId || p.taskId || titleOf(p) || "otros");
    const groupTitleOf = (rows)=>{
      const first = rows[0] || {};
      const t = taskOf(first);
      return t?.title || first.taskTitle || first.campaignTitle || first.fromTaskTitle || first.title || first.concept || "Otros pagos";
    };
    const dueTime = (p)=> p?.dueDate ? new Date(p.dueDate+"T00:00:00").getTime() : 0;
    const paidTime = (p)=> new Date(p?.paidAt || p?.createdAt || p?.dueDate || 0).getTime() || 0;
    const fmtDate = (iso)=>{
      if(!iso) return "Sin fecha";
      try{ return new Date(iso+"T00:00:00").toLocaleDateString("es-CL", {day:"2-digit", month:"short", year:"numeric"}).replace(".",""); }catch(e){ return String(iso); }
    };
    const dueState = (p)=>{
      if(!p?.dueDate) return {cls:"neutral", label:"Sin fecha", text:"Sin vencimiento"};
      const d = daysTo(p.dueDate);
      if(d < 0) return {cls:"danger", label:"Vencida", text:`Venció el ${fmtDate(p.dueDate)} · hace ${Math.abs(d)} día(s)`};
      if(d === 0) return {cls:"warn", label:"Vence hoy", text:`Vence hoy · ${fmtDate(p.dueDate)}`};
      if(d <= 7) return {cls:"warn", label:"Próxima", text:`Vence en ${d} día(s) · ${fmtDate(p.dueDate)}`};
      return {cls:"neutral", label:"Pendiente", text:`Vence el ${fmtDate(p.dueDate)}`};
    };
    const paidThisYear = paysAll.filter(p=>isPaid(p) && new Date(p.paidAt || p.createdAt || 0).getFullYear()===yearNow);
    const pendingRowsAll = paysAll.filter(isPending).sort((a,b)=>dueTime(a)-dueTime(b));
    const next = pendingRowsAll[0];
    const totalPending = pendingRowsAll.reduce((a,p)=>a+amountOf(p),0);
    const totalPaidYear = paidThisYear.reduce((a,p)=>a+amountOf(p),0);
    const nextMonthCount = pendingRowsAll.filter(p=>{
      if(!p.dueDate) return false;
      const dt = new Date(p.dueDate+"T00:00:00");
      return dt.getMonth()===monthNow && dt.getFullYear()===yearNow;
    }).length;

    const activeFilter = ["all","pending","paid"].includes(payFilter) ? payFilter : "pending";
    payFilter = activeFilter;

    function renderPayTrustBadge(extraClass=""){
      return `<div class="apoPayTrustBadge ${extraClass}" aria-label="Pago seguro con Transbank">
        <div class="apoPayTrustLock" aria-hidden="true">🔒</div>
        <img class="apoPayTrustLogo" src="/assets/transbank-logo-cursapp.svg" alt="Transbank" loading="lazy" decoding="async" />
        <div class="apoPayTrustText">
          <b>Pago seguro</b>
          <small>Débito · Crédito</small>
        </div>
      </div>`;
    }

    function renderHero(){
      if(!next){
        return `<section class="apoPayUpToDateHero">
          <div class="apoPayHeroIcon">🏆</div>
          <div><span>Todo al día</span><h2>Sin pagos pendientes</h2><p>Gracias por mantener tus compromisos al día. Tus aportes ayudan al curso.</p></div>
        </section>`;
      }
      const ds = dueState(next);
      const groupTitle = groupTitleOf([next]);
      return `<section class="apoPayHero ${ds.cls}">
        <div class="apoPayHeroTop"><span>Próximo pago</span><small>Pago seguro</small></div>
        <div class="apoPayHeroMain">
          <div class="apoPayHeroCopy"><h2>${esc(groupTitle)}</h2><p class="${ds.cls}">${esc(ds.text)}</p><strong>${clp(amountOf(next))}</strong></div>
          ${renderPayTrustBadge('hero')}
        </div>
        <div class="apoPayHeroActions"><button type="button" onclick="payNow('${esc(next.id)}')">Pagar ahora</button><button type="button" onclick="setPayFilter('pending')">Ver pendientes</button></div>
      </section>`;
    }

    function renderSummary(){
      return `<section class="apoPaySummary">
        <article><span class="purple">${apoSvg("card")}</span><p>Pendiente</p><strong>${clp(totalPending)}</strong><small>${pendingRowsAll.length} pago(s)</small></article>
        <article><span class="green">✓</span><p>Pagados</p><strong>${paidThisYear.length}</strong><small>Este año</small></article>
        <article><span class="orange">${apoSvg("calendar")}</span><p>Próximas</p><strong>${nextMonthCount}</strong><small>Este mes</small></article>
        <article><span class="blue">▥</span><p>Total pagado</p><strong>${clp(totalPaidYear)}</strong><small>Este año</small></article>
      </section>`;
    }

    function rowsForFilter(){
      if(activeFilter === "paid") return paysAll.filter(isPaid).sort((a,b)=>paidTime(b)-paidTime(a));
      if(activeFilter === "pending") return pendingRowsAll;
      return paysAll.slice().sort((a,b)=>{
        const aw = isPending(a) ? 0 : 1;
        const bw = isPending(b) ? 0 : 1;
        if(aw !== bw) return aw-bw;
        return (dueTime(a)||paidTime(a)) - (dueTime(b)||paidTime(b));
      });
    }

    function groupRows(rows){
      const map = new Map();
      rows.forEach(p=>{
        const key = groupKeyOf(p);
        if(!map.has(key)) map.set(key, []);
        map.get(key).push(p);
      });
      return Array.from(map.values()).map(rows=>rows.sort((a,b)=>(dueTime(a)||paidTime(a))-(dueTime(b)||paidTime(b))));
    }

    function renderPaymentLine(p){
      const paid = isPaid(p);
      const ds = dueState(p);
      const month = p.dueDate ? new Date(p.dueDate+"T00:00:00").toLocaleDateString("es-CL", {month:"long", year:"numeric"}) : "";
      return `<article class="apoPayLine ${paid?'paid':ds.cls}">
        <div class="apoPayLineIcon">${paid ? '✓' : (ds.cls==='danger' ? '!' : '•')}</div>
        <div class="apoPayLineInfo">
          <h4>${esc(p.installmentLabel || p.cuota || month || titleOf(p))}</h4>
          <p>${paid ? `Pagado ${esc(fmtDate(String(p.paidAt||p.createdAt||'').slice(0,10)))}` : esc(ds.text)}</p>
        </div>
        <strong>${clp(amountOf(p))}</strong>
        ${paid ? `<button type="button" onclick="openReceipt('${esc(p.id)}')">Comprobante</button>` : `<button type="button" onclick="payNow('${esc(p.id)}')">Pagar</button>`}
      </article>`;
    }

    function yearOfPayment(p){
      try{
        const raw = p?.dueDate || p?.paidAt || p?.createdAt;
        const d = raw ? new Date(String(raw).slice(0,10)+"T00:00:00") : null;
        return d && !Number.isNaN(d.getTime()) ? d.getFullYear() : "Sin fecha";
      }catch(e){ return "Sin fecha"; }
    }

    function renderYearAccordion(rows){
      const byYear = new Map();
      rows.forEach(p=>{
        const y = yearOfPayment(p);
        if(!byYear.has(y)) byYear.set(y, []);
        byYear.get(y).push(p);
      });
      return Array.from(byYear.entries()).map(([year, yearRows], index)=>{
        const pending = yearRows.filter(isPending);
        const paid = yearRows.filter(isPaid);
        const amount = pending.length ? pending.reduce((a,p)=>a+amountOf(p),0) : yearRows.reduce((a,p)=>a+amountOf(p),0);
        const open = index === 0 ? " open" : "";
        return `<details class="apoPayYear"${open}>
          <summary>
            <span>${esc(year)}</span>
            <small>${yearRows.length} cuota(s) · ${pending.length} pendiente(s)${paid.length ? ` · ${paid.length} pagada(s)` : ``}</small>
            <b>${clp(amount)}</b>
          </summary>
          <div class="apoPayLines">${yearRows.map(renderPaymentLine).join("")}</div>
        </details>`;
      }).join("");
    }

    function renderGroup(rows){
      const title = groupTitleOf(rows);
      const pending = rows.filter(isPending);
      const paid = rows.filter(isPaid);
      const monthly = rows.length > 1;
      const total = rows.reduce((a,p)=>a+amountOf(p),0);
      const pendingTotal = pending.reduce((a,p)=>a+amountOf(p),0);
      const firstDue = pending[0] || rows[0];
      const ds = dueState(firstDue);
      const collapseMonthly = monthly && rows.length > 3;
      return `<section class="apoPayGroup ${collapseMonthly ? 'is-collapsible' : ''}">
        <div class="apoPayGroupHead">
          <div><span>${monthly ? 'Pago mensual' : 'Pago único'}</span><h3>${esc(title)}</h3><p>${monthly ? `${rows.length} cuotas · ${pending.length} pendiente(s)` : (pending.length ? ds.text : `${paid.length} pago(s) realizado(s)`)}</p></div>
          <div class="apoPayGroupAmount"><small>${pending.length ? 'Por pagar' : 'Total'}</small><strong>${clp(pending.length ? pendingTotal : total)}</strong></div>
        </div>
        ${monthly ? `<div class="apoPayMonthHint">${collapseMonthly ? 'Las cuotas están organizadas por año. Abre cada período para revisar y pagar el mes correspondiente.' : 'Esta campaña se paga en cuotas mensuales. Revisa cada mes y paga la cuota correspondiente.'}</div>` : ``}
        ${collapseMonthly ? renderYearAccordion(rows) : `<div class="apoPayLines">${rows.map(renderPaymentLine).join("")}</div>`}
      </section>`;
    }

    function renderPaidState(){
      if(activeFilter !== "paid") return "";
      if(pendingRowsAll.length > 0) return "";
      return `<section class="apoPayCelebrate"><div>🎉</div><h2>¡Todo al día!</h2><p>No tienes pagos pendientes. Gracias por apoyar al curso.</p><span>${paidThisYear.length} pagos realizados · ${clp(totalPaidYear)} aportados este año</span></section>`;
    }

    const selectedRows = rowsForFilter();
    const groups = groupRows(selectedRows);
    const groupsHtml = groups.map(renderGroup).join("");
    const empty = `<section class="apoPayEmpty"><div>${activeFilter==='paid'?'🏆':'💳'}</div><h3>${activeFilter==='paid'?'Aún no tienes pagos registrados':'No hay pagos para esta pestaña'}</h3><p>Cuando existan cuotas aparecerán aquí.</p></section>`;

    app.innerHTML = `<div class="apoPayPage">
      <section class="apoPayHeader">
        <div><h1>Pagos</h1><p>Revisa tus cuotas, paga de forma segura y descarga comprobantes.</p></div>
        ${renderPayTrustBadge('header')}
      </section>
      ${renderHero()}
      ${renderSummary()}
      <section class="apoPayTabs" role="tablist">
        <button class="${activeFilter==='all'?'active':''}" onclick="setPayFilter('all')">Todos</button>
        <button class="${activeFilter==='pending'?'active':''}" onclick="setPayFilter('pending')">Pendientes</button>
        <button class="${activeFilter==='paid'?'active':''}" onclick="setPayFilter('paid')">Pagados</button>
      </section>
      ${renderPaidState()}
      <section class="apoPayList">${groupsHtml || empty}</section>
    </div>`;

    localStorage.setItem(KEY_LAST_SEEN_PAYMENTS, nowISO());
  };

  renderInformes = function(){
    const reps = reports();
    app.innerHTML = `
      <div class="apoMockPage">
        <section class="apoMockSection">
          <h1>Informes</h1>
          <p class="apoMockLead">Montos del curso compartidos por la directiva.</p>
        </section>
        <section class="apoMockReportList">
          ${reps.length ? reps.map(r=>`<article class="apoMockReport"><span>I</span><div><h3>Informe ${esc(r.period||"")}</h3><p>${esc(r.generatedAt||"Publicado recientemente")}</p></div><button onclick="openReport('${esc(r.period||"")}')">Ver</button></article>`).join("") : `<article class="apoMockEmpty"><strong>Aun no hay informes publicados</strong><p>Cuando la directiva publique uno aparecera aqui.</p></article>`}
        </section>
      </div>`;
  };

  // âœ… Router GLOBAL (y expuesto para que onclick del Home no rompa)
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
    try{ keepApoV45BellAlive(); }catch(e){}
    try{ installApoV47FloatingMessages(); }catch(e){}
  }
  window.go = go; // <-- esto elimina el error "Can't find variable: go"

  // Menu
  function initMenu(){
    const menu = document.getElementById("menuDropdown");
    const btn = document.getElementById("menuBtn");
    if(!menu || !btn) return;

    btn.classList.add("apoV42MenuBtn");
    btn.innerHTML = "☰";

    const hasTesorero = (()=>{
      try{
        const raw = JSON.parse(localStorage.getItem("cursapp_session_v1") || "{}");
        const roles = Array.isArray(raw.roles) ? raw.roles.map(x=>String(x).toLowerCase()) : [];
        if(roles.some(r=>r.includes("tesor"))) return true;
        const profiles = JSON.parse(localStorage.getItem(KEY_PROFILES) || "[]");
        return (Array.isArray(profiles) ? profiles : []).some(p=>String(p?.role || p?.user?.role || "").toLowerCase().includes("tesor"));
      }catch(_e){ return false; }
    })();

    const item = (icon,label,action,extra="") => `<button class="apoV42MenuItem ${extra}" type="button" data-action="${esc(action)}"><span>${icon}</span><b>${esc(label)}</b></button>`;
    const group = (title,items) => `<div class="apoV42MenuGroup"><small>${esc(title)}</small>${items}</div>`;

    menu.className = "apoV42Menu";
    menu.innerHTML = `
      <div class="apoV42MenuHeader">
        <div class="apoV42MenuAvatar">${esc((document.getElementById("whoRoleTitle")?.textContent || "A").trim().charAt(0).toUpperCase() || "A")}</div>
        <div><strong>${esc(document.getElementById("whoRoleTitle")?.textContent || "Apoderado")}</strong><span>${esc((document.getElementById("whoCourseLine")?.innerText || "Curso actual").replace(/\n/g," · "))}</span></div>
      </div>
      ${group("Principal", [
        item("🏠","Inicio","home"),
        item("💳","Pagos","payments"),
        item("📄","Informes","informes"),
        item("🛍️","Mercado Escolar","market","market")
      ].join(""))}
      ${group("Cuenta", [
        item("👤","Mi perfil","perfil"),
        item("🔔","Notificaciones","avisos"),
        item("📄","Consentimientos","consentimientos")
      ].join(""))}
      ${group("Otros", [
        (hasTesorero ? item("💰","Ir a tesorero","tesorero") : ""),
        item("❓","Ayuda","ayuda"),
        item("📱","Instalar App","install"),
        item("🚪","Cerrar sesión","logout","danger")
      ].join(""))}
    `;

    btn.onclick = (ev)=>{
      ev.stopPropagation();
      const open = menu.style.display === "block";
      menu.style.display = open ? "none" : "block";
      menu.setAttribute("aria-hidden", open ? "true" : "false");
    };
    menu.onclick = (ev)=>{
      const it = ev.target && ev.target.closest ? ev.target.closest(".apoV42MenuItem") : null;
      if(!it) return;
      ev.stopPropagation();
      const action = it.dataset.action || "";
      menu.style.display = "none";
      if(action === "home" || action === "payments" || action === "informes") return go(action);
      if(action === "market") return location.href = "/mercado-escolar/mercado-escolar.html";
      if(action === "perfil") return location.href = "/perfil.html";
      if(action === "tesorero") return location.href = "/tesorero.html";
      if(action === "avisos") return (typeof openAvisosInbox === "function" ? openAvisosInbox() : null);
      if(action === "consentimientos") return alert("Consentimientos estará disponible próximamente.");
      if(action === "ayuda") return (typeof openHelp === "function" ? openHelp("general") : alert("Ayuda Cursapp"));
      if(action === "install") return alert("Para instalar Cursapp, usa Compartir → Agregar a inicio.");
      if(action === "logout") return location.href = "/index.html";
    };
    document.addEventListener("click",()=>{ menu.style.display="none"; });
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
// âœ… Solo sembrar demo si estÃ¡ activado explÃ­citamente
const DEMO_MODE = !!(window.CURSAPP && window.CURSAPP.DEMO_MODE);

if (DEMO_MODE) {
  ensureDemo();
}


  // --- Multi-rol (Apoderado/Tesorero): mostrar selector al entrar (1 vez por sesiÃ³n) ---
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
            <div class="muted" style="margin-top:6px;font-weight:800;">Selecciona cÃ³mo ingresar</div>
          </div>
          <button class="btn small" onclick="closeModal()">Cerrar</button>
        </div>
        <div style="margin-top:14px">
          <button class="btn wide" style="display:flex;gap:10px;align-items:center;justify-content:flex-start;" onclick="window.__setRole('apoderado')">
            <span style="font-size:20px">ðŸ‘¥</span>
            <div style="text-align:left">
              <div style="font-weight:900">Apoderado</div>
              <div class="muted">Aprobado automÃ¡ticamente</div>
            </div>
          </button>
          ${canTesorero ? `
          <div style="height:10px"></div>
          <button class="btn wide" style="display:flex;gap:10px;align-items:center;justify-content:flex-start;" onclick="window.__setRole('tesorero')">
            <span style="font-size:20px">ðŸ’¼</span>
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
    // V11.14: no mostrar selector automÃ¡tico dentro de Apoderado.
    // El selector debe resolverse antes de entrar a esta pantalla (login / cambio de rol).
    // Esto evita el bug Presidente -> Apoderado donde se renderizaba Home/banner
    // y luego aparecÃ­a nuevamente el selector de perfil, dejando el banner de fondo.
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
    // para campaÃ±as obligatorias y luego rehidratar. Evita mostrar pagos locales pay_xxx.
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
  try{ installApoV47FloatingMessages(); }catch(e){}
  __hideLegacyTesoreroBanner();
  __maybePromptRole();

  const hash = (location.hash || "").replace("#","");
  if(hash==="payments_paid"){
    try{ window.__apoForcePaid = true; }catch(e){}
    go("payments");
  }else if(hash==="payments") go("payments");
  else go("home");
  try{ window.dispatchEvent(new CustomEvent('cursapp:apoderado-ready')); }catch(e){}
}
__bootApoderadoSupabaseFirst();
})();

/* Re-render banners despuÃ©s de cada render de Apoderado */
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




