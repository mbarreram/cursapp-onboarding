/* ===========================
   Cursapp · core.js (Reset)
   - resetAll(): borra llaves de Cursapp + legacy
   - hardReset(): BORRA TODO localStorage del sitio (DEV) => no más datos fantasma
   - Expone window.CURSAPP.resetAll() y window.CURSAPP.hardReset()
   =========================== */

(function () {
  const LEGACY_KEYS = new Set(["campanas", "cobros", "pagos", "usuarios", "dashboardData"]);

  function goLogin() {
    location.assign("/index.html");
  }

  // ------------------------------------------------------------
  // Cross-page navigation helper (Perfil -> dashboards)
  // Guardamos un "siguiente tab" por unos segundos para que la
  // página destino abra la sección correcta.
  const NAV_TAB_KEY = "cursapp_nav_tab_v1";
  const NAV_AT_KEY = "cursapp_nav_at_v1";
  const NAV_TTL_MS = 15000;

  function setNextNavTab(tab) {
    try {
      if (!tab) return;
      localStorage.setItem(NAV_TAB_KEY, String(tab));
      localStorage.setItem(NAV_AT_KEY, String(Date.now()));
    } catch (e) {}
  }

  function consumeNextNavTab() {
    try {
      const tab = localStorage.getItem(NAV_TAB_KEY);
      const at = Number(localStorage.getItem(NAV_AT_KEY) || 0);
      // one-shot
      localStorage.removeItem(NAV_TAB_KEY);
      localStorage.removeItem(NAV_AT_KEY);
      if (!tab) return null;
      if (!at || Date.now() - at > NAV_TTL_MS) return null;
      return String(tab);
    } catch (e) {
      return null;
    }
  }

  function resetAll() {
    if (!confirm("⚠️ Reset demo: eliminará los datos de Cursapp en este navegador. ¿Continuar?")) return;

    const toDelete = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (k.startsWith("cursapp") || LEGACY_KEYS.has(k)) toDelete.push(k);
    }

    toDelete.forEach((k) => localStorage.removeItem(k));

    alert("✅ Demo reseteada. Volviendo al login.");
    goLogin();
  }

  // ✅ Reset TOTAL DEV: borra TODO el storage del sitio (la forma más robusta)
  function hardReset() {
    if (!confirm("🧨 Reset TOTAL (DEV): borrará TODO el almacenamiento local de este sitio. ¿Continuar?")) return;

    localStorage.clear();

    alert("✅ Reset TOTAL aplicado. Volviendo al login.");
    goLogin();
  }

  window.CURSAPP = window.CURSAPP || {};
  window.CURSAPP.resetAll = resetAll;
  window.CURSAPP.hardReset = hardReset;
  window.CURSAPP.goLogin = goLogin;
  window.CURSAPP.setNextNavTab = setNextNavTab;
  window.CURSAPP.consumeNextNavTab = consumeNextNavTab;

  function wire() {
    // si existe botón Reset demo
    const resetBtn = document.getElementById("resetMenuItem");
    if (resetBtn) resetBtn.onclick = resetAll;

    // si existe botón Reset total (dev)
    const hardBtn = document.getElementById("hardResetMenuItem");
    if (hardBtn) hardBtn.onclick = hardReset;

    // volver al login (onboarding)
    const backLogin = document.getElementById("backLogin");
    if (backLogin) backLogin.onclick = goLogin;

    // Atajo opcional: Ctrl/Cmd + Shift + R → hard reset
    document.addEventListener("keydown", (e) => {
      const isCmd = e.metaKey && e.shiftKey && (e.key === "R" || e.key === "r");
      const isCtrl = e.ctrlKey && e.shiftKey && (e.key === "R" || e.key === "r");
      if (isCmd || isCtrl) {
        e.preventDefault();
        hardReset();
      }
    });
  }

  document.addEventListener("DOMContentLoaded", wire);
})();


/* ============================================================
   Cursapp · core patches (v10.1)
   Parche mínimo:
   1) Al aprobar apoderados, asegurar pagos pendientes para campañas obligatorias ya creadas.
   2) Al marcar "No participo" (campañas NO obligatorias), forzar recálculo inmediato del pendiente
      ajustando amountRemaining (sin tocar pantallas específicas).
   ============================================================ */

(function(){
  // ---- helper: evento unificado ----
  function emitChanged(key){
    try{ window.dispatchEvent(new CustomEvent('cursapp:dataChanged', { detail:{ key:String(key||'') } })); }catch(e){}
  }

  // ---- patch localStorage.setItem una sola vez (si alguna pantalla no lo hizo) ----
  (function patchLocalStorageSetItem(){
    try{
      if(window.__cursapp_setItemPatched_core) return;
      const _orig = localStorage.setItem.bind(localStorage);
      localStorage.setItem = function(k, v){
        _orig(k, v);
        emitChanged(k);
      };
      window.__cursapp_setItemPatched_core = true;
    }catch(e){}
  })();

  // ---- scoped keys (por curso) ----
  function sk(base){
    try{
      if(window.CURSAPP && typeof window.CURSAPP.scopedKey === 'function') return window.CURSAPP.scopedKey(base);
    }catch(e){}
    return `cursapp_${base}`;
  }
  const KEY_TASKS = sk('tasks_v1');
  const KEY_PAYMENTS = sk('payments_v1');
  const KEY_ENROLLMENTS = sk('enrollments_v1');
  const KEY_OPTOUT = sk('optout_v1');

  function load(k, def){
    try{ return JSON.parse(localStorage.getItem(k) || JSON.stringify(def)); }catch(e){ return def; }
  }
  function save(k, v){
    try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){}
  }

  function uid(prefix){
    return `${prefix||'id'}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
  }

  function getSessionEmail(){
    try{
      const s = (window.CURSAPP && typeof window.CURSAPP.getSessionSafe === 'function')
        ? window.CURSAPP.getSessionSafe()
        : ((window.CURSAPP && typeof window.CURSAPP.getSession === 'function') ? window.CURSAPP.getSession() : null);
      const mail = (s && (s.email || s.userEmail || s.username)) || '';
      return String(mail||'').toLowerCase().trim();
    }catch(e){
      return '';
    }
  }

  // ------------------------------------------------------------
  // 1) Sync pagos al aprobar apoderados (campañas obligatorias)
  // ------------------------------------------------------------
  function enrollmentEmail(enr){
    return String(enr?.email || enr?.apoderadoEmail || enr?.userEmail || enr?.username || '').toLowerCase().trim();
  }

  function ensureMandatoryPaymentsForApproved(){
    const tasks = load(KEY_TASKS, []);
    const enrollments = load(KEY_ENROLLMENTS, []);
    const approved = (enrollments||[]).filter(e => String(e?.status||'').toLowerCase() === 'approved');
    if(!approved.length || !tasks.length) return false;

    const emails = approved.map(enrollmentEmail).filter(Boolean);
    if(!emails.length) return false;

    let payments = load(KEY_PAYMENTS, []);
    let changed = false;

    const mandatoryTasks = (tasks||[]).filter(t => !!t && (t.mandatoryParticipation === true));
    if(!mandatoryTasks.length) return false;

    for(const t of mandatoryTasks){
      const taskId = String(t.id||'');
      if(!taskId) continue;

      for(const email of emails){
        const exists = payments.some(p =>
          String(p?.fromTaskId||'') === taskId &&
          String(p?.apoderadoEmail||p?.email||'').toLowerCase().trim() === email
        );
        if(exists) continue;

        const type = String(t.type||'single');
        const months = Math.max(1, Number(t.months||1));
        payments.unshift({
          id: uid('p'),
          fromTaskId: taskId,
          concept: (type === 'monthly') ? `${String(t.title||'Campaña')} · Cuota 1/${months}` : 'Pago único',
          amount: Number(t.amount||0),
          amountRemaining: Number(t.amount||0),
          status: 'pending',
          dueDate: t.dueDate || '',
          createdAt: new Date().toISOString(),
          apoderadoEmail: email
        });
        changed = true;
      }
    }

    if(changed){
      save(KEY_PAYMENTS, payments);
      emitChanged(KEY_PAYMENTS);
    }
    return changed;
  }

  // ------------------------------------------------------------
  // 2) Opt-out: forzar recálculo inmediato de pendiente
  // ------------------------------------------------------------
  function normalizeOptOutMap(){
    const raw = load(KEY_OPTOUT, null);
    if(Array.isArray(raw)) return raw.map(String);
    if(raw && typeof raw === 'object'){
      const keys = Object.keys(raw);
      for(const k of keys){
        if(Array.isArray(raw[k])) return raw[k].map(String);
      }
    }
    return [];
  }

  function applyOptOutToPayments(){
    const optedTaskIds = new Set(normalizeOptOutMap().map(String));
    const me = getSessionEmail();
    if(!me) return false;

    const tasks = load(KEY_TASKS, []);
    const voluntary = new Set((tasks||[])
      .filter(t => t && t.mandatoryParticipation === false)
      .map(t => String(t.id||''))
      .filter(Boolean));

    let payments = load(KEY_PAYMENTS, []);
    let changed = false;

    payments = (payments||[]).map(p => {
      if(!p) return p;
      const email = String(p.apoderadoEmail || p.email || '').toLowerCase().trim();
      if(email && email !== me) return p;

      const tid = String(p.fromTaskId || p.taskId || p.campaignId || '');
      if(!tid || !voluntary.has(tid)) return p;

      const st = String(p.status||'').toLowerCase();
      if(st === 'paid' || st === 'credit') return p;

      const isOpted = optedTaskIds.has(tid);
      const curRem = Number(p.amountRemaining ?? p.amount ?? 0);

      if(isOpted){
        if(curRem !== 0 || !p.__optedOutCore){
          changed = true;
          return {
            ...p,
            __optedOutCore: true,
            __optedOutPrev: (p.__optedOutPrev != null) ? p.__optedOutPrev : curRem,
            amountRemaining: 0
          };
        }
        return p;
      }

      if(p.__optedOutCore){
        const prev = Number(p.__optedOutPrev ?? p.amount ?? 0);
        if(curRem !== prev){
          changed = true;
          const cp = { ...p, amountRemaining: prev };
          delete cp.__optedOutCore;
          delete cp.__optedOutPrev;
          return cp;
        }
      }
      return p;
    });

    if(changed){
      save(KEY_PAYMENTS, payments);
      emitChanged(KEY_PAYMENTS);
    }
    return changed;
  }

  // ---- listeners: reaccionar a cambios relevantes ----
  let __syncTimer = null;
  function scheduleSync(){
    try{ if(__syncTimer) clearTimeout(__syncTimer); }catch(e){}
    __syncTimer = setTimeout(()=>{
      try{ ensureMandatoryPaymentsForApproved(); }catch(e){}
      try{ applyOptOutToPayments(); }catch(e){}
    }, 80);
  }

  window.addEventListener('cursapp:dataChanged', (ev)=>{
    const k = String(ev?.detail?.key || '');
    if(!k) return;
    if(k === KEY_ENROLLMENTS || k === KEY_TASKS || k === KEY_OPTOUT) scheduleSync();
  });

  // Primer sync al cargar página (por si vienes de aprobar / cambiar optout)
  try{ scheduleSync(); }catch(e){}
})();

/* ============================================================
   Cursapp · Supabase Hybrid Bridge Fase 1A FIX v1
   - Autoritativo SOLO en assets/core.js.
   - No reemplaza localStorage.
   - Replica: colegios, cursos, usuarios, miembros_curso, campanas.
   - Evita upsert para no exigir políticas UPDATE en esta fase dev.
   - Deja diagnóstico en localStorage sin alertas visibles.
   - Fase 1C: hidrata campañas desde Supabase hacia caché local por curso.
   ============================================================ */
(function(){
  if (window.__CURSAPP_SUPABASE_HYBRID_FASE1A_CORE_FIX__) return;
  window.__CURSAPP_SUPABASE_HYBRID_FASE1A_CORE_FIX__ = true;

  const SB_URL = "https://ngxistgymgdkoaiulfbq.supabase.co";
  const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5neGlzdGd5bWdka29haXVsZmJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2OTg1NDQsImV4cCI6MjA5NjI3NDU0NH0.1r-aLijYEWvUifKcLjlClnA8-oYw11lgThY0swg_xbg";
  const MAP_KEY = "cursapp_supabase_ids_v1";
  const LOG_KEY = "cursapp_supabase_last_sync_v1";
  const ALERT_KEY = "cursapp_supabase_alert_once_v1";

  window.CURSAPP = window.CURSAPP || {};

  // Scope por curso. Si no hay curso activo, usa global.
  if (typeof window.CURSAPP.scopedKey !== "function") {
    window.CURSAPP.scopedKey = function(base){
      let courseKey = "global";
      try { courseKey = String(localStorage.getItem("cursapp_active_course_v1") || "global").trim() || "global"; } catch(e) {}
      return "cursapp_" + courseKey + "_" + base;
    };
  }

  function log(status, detail){
    try{
      const row = { status, detail: detail || {}, at: new Date().toISOString(), version: "fase1c2-campanas-supabase-authoritative" };
      localStorage.setItem(LOG_KEY, JSON.stringify(row));
      window.CURSAPP_SUPABASE_STATUS = row;
      if (status === "error") console.warn("Cursapp Supabase sync", row);
      else console.log("Cursapp Supabase sync", row);
      // Sin alertas en producción. El diagnóstico queda en localStorage y console.
    }catch(e){}
  }

  function maybeAlert(row){
    // Alertas temporales desactivadas: el estado queda en localStorage y consola.
    // Usar: JSON.parse(localStorage.getItem("cursapp_supabase_last_sync_v1"))
    return;
  }

  function parseJSON(v, fallback){ try{ if(v == null || v === "") return fallback; return JSON.parse(v); }catch(e){ return fallback; } }
  function loadJSON(k, fallback){ try{ return parseJSON(localStorage.getItem(k), fallback); }catch(e){ return fallback; } }
  function saveJSON(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
  function q(v){ return encodeURIComponent(String(v == null ? "" : v)); }
  function asInt(v){ const n = parseInt(v,10); return Number.isFinite(n) ? n : null; }
  function cleanDate(v){ const s = String(v || "").slice(0,10); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null; }

  function activeCourseKey(){
    try{
      const s = loadJSON("cursapp_session_v1", null) || {};
      return String(localStorage.getItem("cursapp_active_course_v1") || s.courseKey || "").trim();
    }catch(e){ return ""; }
  }

  function taskFromSupabase(row){
    row = row || {};
    const id = row.local_id || row.campaign_id || row.id || ("sb_campaign_" + Date.now());
    const type = String(row.tipo || "single");
    const status = String(row.estado || "activa").toLowerCase();
    return {
      id: String(id),
      supabaseId: row.id || "",
      title: row.titulo || row.nombre || "Campaña",
      type: type,
      amount: Number(row.monto || 0) || 0,
      startDate: row.fecha_inicio || "",
      dueDate: row.fecha_vencimiento || "",
      endDate: row.fecha_vencimiento || "",
      months: Number(row.meses || 1) || 1,
      mandatoryParticipation: row.obligatoria !== false,
      status: status,
      closed: status === "cerrada" || status === "closed",
      fromSupabase: true,
      updatedAt: row.updated_at || row.created_at || new Date().toISOString()
    };
  }

  function mergeTasksById(localTasks, remoteTasks){
    // Fase 1C.2: Supabase es fuente oficial de campañas.
    // No mezclar campañas antiguas de localStorage porque duplica o muestra campañas fantasmas.
    const out = [];
    const seen = new Set();
    function keyOf(t){
      return String(t?.supabaseId || t?.id || [t?.title,t?.amount,t?.startDate,t?.dueDate].join("|") || "");
    }
    (remoteTasks || []).forEach(t=>{
      const k = keyOf(t);
      if(!k || seen.has(k)) return;
      seen.add(k);
      out.push(t);
    });
    return out;
  }

  function mapLoad(){
    const m = loadJSON(MAP_KEY, {});
    m.cursos = m.cursos || {}; m.colegios = m.colegios || {}; m.usuarios = m.usuarios || {}; m.miembros = m.miembros || {}; m.campanas = m.campanas || {};
    return m;
  }
  function mapSave(m){ saveJSON(MAP_KEY, m); }

  async function sb(path, opts){
    const headers = Object.assign({
      "apikey": SB_KEY,
      "Authorization": "Bearer " + SB_KEY,
      "Content-Type": "application/json",
      "Prefer": "return=representation"
    }, (opts && opts.headers) || {});
    const res = await fetch(SB_URL + "/rest/v1/" + path, Object.assign({}, opts || {}, { headers }));
    const text = await res.text();
    let data = null;
    try{ data = text ? JSON.parse(text) : null; }catch(e){ data = text; }
    if(!res.ok){
      const msg = (data && (data.message || data.error || data.hint || data.details)) || text || ("HTTP " + res.status);
      throw new Error(msg);
    }
    return data;
  }
  async function selectOne(table, query){
    const data = await sb(table + "?" + query + "&limit=1", { method:"GET" });
    return Array.isArray(data) ? (data[0] || null) : null;
  }
  async function insert(table, body){
    const data = await sb(table, { method:"POST", body: JSON.stringify(body) });
    return Array.isArray(data) ? (data[0] || null) : data;
  }

  function normalizeCourseObj(obj){
    if(!obj) return null;
    const c = obj.course || obj;
    const courseKey = String(obj.courseKey || c.courseKey || "").trim();
    if(!courseKey) return null;
    return {
      courseKey,
      inviteCode: String(obj.inviteCode || c.inviteCode || ""),
      schoolName: String(c.schoolName || c.school || c.colegio || c.nombreColegio || "Colegio").trim() || "Colegio",
      regionName: String(c.regionName || c.region || "").trim(),
      comunaName: String(c.comunaName || c.comuna || "").trim(),
      schoolId: String(c.schoolId || c.colegioId || "").trim(),
      level: String(c.level || c.nivel || "").trim(),
      letter: String(c.letter || c.letra || "").trim(),
      year: asInt(c.year || c.anio || c.año),
      jornada: String(c.jornada || "").trim()
    };
  }

  function allLocalCourses(){
    const out = [];
    const current = loadJSON("cursapp_course_v1", null); if(current) out.push(current);
    const list = loadJSON("cursapp_courses_v1", []); if(Array.isArray(list)) list.forEach(x=>out.push(x));
    const profiles = loadJSON("cursapp_profiles_v1", []);
    if(Array.isArray(profiles)) profiles.forEach(p=>{ if(p && p.courseKey && p.course) out.push({ courseKey:p.courseKey, inviteCode:p.inviteCode || "", course:p.course }); });
    const seen = new Set();
    return out.filter(x=>{ const c = normalizeCourseObj(x); if(!c) return false; if(seen.has(c.courseKey)) return false; seen.add(c.courseKey); return true; });
  }

  async function ensureColegio(course){
    const m = mapLoad();
    const ck = [course.schoolName, course.regionName, course.comunaName].join("|");
    if(m.colegios[ck]) return m.colegios[ck];
    let row = await selectOne("colegios", "nombre=eq." + q(course.schoolName) + "&region=eq." + q(course.regionName) + "&comuna=eq." + q(course.comunaName) + "&select=id");
    if(!row){
      row = await insert("colegios", {
        nombre: course.schoolName,
        region: course.regionName || null,
        comuna: course.comunaName || null,
        rbd: course.schoolId || null,
        es_catalogo_demo: /\(demo\)/i.test(course.schoolName)
      });
    }
    if(row && row.id){ const mm = mapLoad(); mm.colegios[ck] = row.id; mapSave(mm); return row.id; }
    return null;
  }

  async function ensureCurso(courseLike){
    const course = normalizeCourseObj(courseLike);
    if(!course) return null;
    const mm0 = mapLoad();
    if(mm0.cursos[course.courseKey]) return mm0.cursos[course.courseKey];
    let existing = await selectOne("cursos", "course_key=eq." + q(course.courseKey) + "&select=id");
    if(existing && existing.id){ const mm = mapLoad(); mm.cursos[course.courseKey] = existing.id; mapSave(mm); return existing.id; }
    const colegioId = await ensureColegio(course);
    const nombreCurso = `${course.schoolName} · ${course.level}${course.letter} ${course.year || ""}`.replace(/\s+/g," ").trim();
    const row = await insert("cursos", {
      colegio_id: colegioId,
      nombre: nombreCurso || "Curso Cursapp",
      nivel: course.level || null,
      letra: course.letter || null,
      anio: course.year,
      jornada: course.jornada || null,
      course_key: course.courseKey,
      invite_code: course.inviteCode || null,
      estado: "activo"
    });
    if(row && row.id){ const mm = mapLoad(); mm.cursos[course.courseKey] = row.id; mapSave(mm); return row.id; }
    return null;
  }

  function findLocalUserById(userId){
    try{
      const id = String(userId || "").trim();
      if(!id) return null;
      const users = loadJSON("cursapp_users_v1", []);
      return (Array.isArray(users) ? users : []).find(u => String(u.userId || u.id || "").trim() === id) || null;
    }catch(e){ return null; }
  }

  function emailFromUserOrProfile(userLike, profileLike){
    const byDirect = String(userLike?.email || profileLike?.email || profileLike?.userEmail || profileLike?.apoderado?.email || "").toLowerCase().trim();
    if(byDirect) return byDirect;
    const local = findLocalUserById(profileLike?.userId || userLike?.userId || userLike?.id);
    return String(local?.email || "").toLowerCase().trim();
  }

  async function ensureUsuario(userLike, profileLike){
    const email = emailFromUserOrProfile(userLike, profileLike);
    if(!email) return null;
    const m = mapLoad(); if(m.usuarios[email]) return m.usuarios[email];
    let existing = await selectOne("usuarios", "email=eq." + q(email) + "&select=id");
    if(existing && existing.id){ const mm = mapLoad(); mm.usuarios[email] = existing.id; mapSave(mm); return existing.id; }
    const name = String(profileLike?.apoderado?.name || profileLike?.directiva?.name || profileLike?.name || userLike?.name || "").trim();
    const phone = String(profileLike?.apoderado?.phone || profileLike?.phone || "").trim();
    const row = await insert("usuarios", { email, nombre: name || null, telefono: phone || null, rol_global: "usuario", estado: "activo" });
    if(row && row.id){ const mm = mapLoad(); mm.usuarios[email] = row.id; mapSave(mm); return row.id; }
    return null;
  }

  async function upsertMiembro(profile){
    if(!profile || !profile.courseKey || !profile.role) return null;
    const cursoId = await ensureCurso({ courseKey:profile.courseKey, inviteCode:profile.inviteCode || "", course:profile.course || {} });
    if(!cursoId) return null;
    const email = emailFromUserOrProfile({}, profile);
    const userId = await ensureUsuario({ email, userId: profile.userId }, profile);
    const rol = String(profile.role || "apoderado").toLowerCase();
    const alumno = String(profile.apoderado?.alumno || profile.alumno || "").trim();
    const nombre = String(profile.apoderado?.name || profile.directiva?.name || profile.name || "").trim();
    const key = [cursoId, email || profile.userId || "sin-email", rol, alumno].join("|");
    const m = mapLoad(); if(m.miembros[key]) return m.miembros[key];
    let found = null;
    if(email) found = await selectOne("miembros_curso", "curso_id=eq." + q(cursoId) + "&email=eq." + q(email) + "&rol=eq." + q(rol) + "&select=id");
    if(found && found.id){ const mm = mapLoad(); mm.miembros[key] = found.id; mapSave(mm); return found.id; }
    const row = await insert("miembros_curso", {
      curso_id: cursoId,
      usuario_id: userId,
      rol,
      nombre_apoderado: nombre || null,
      nombre_alumno: alumno || null,
      email: email || null,
      estado: String(profile.status || (rol === "apoderado" ? "pendiente" : "aprobado")).toLowerCase(),
      activacion_pagada: (rol === "presidente" || rol === "tesorero") ? true : (String(profile.activation?.status || "").toLowerCase() === "paid")
    });
    if(row && row.id){ const mm = mapLoad(); mm.miembros[key] = row.id; mapSave(mm); return row.id; }
    return null;
  }

  async function syncCourses(){ const courses = allLocalCourses(); for(const c of courses) await ensureCurso(c); return courses.length; }

  async function syncUsersAndMembers(){
    const users = loadJSON("cursapp_users_v1", []);
    const profiles = loadJSON("cursapp_profiles_v1", []);
    let count = 0;
    if(Array.isArray(users)){ for(const u of users){ await ensureUsuario(u, null); count++; } }
    if(Array.isArray(profiles)){ for(const p of profiles){ await upsertMiembro(p); count++; } }
    return count;
  }

  function allTaskKeys(){
    const keys = [];
    try{ for(let i=0;i<localStorage.length;i++){ const k = localStorage.key(i); if(k && (k === "cursapp_tasks_v1" || /tasks_v1$/.test(k) || k.indexOf("tasks_v1") >= 0)) keys.push(k); } }catch(e){}
    return Array.from(new Set(keys));
  }

  async function syncCampaigns(){
    const activeCourseKey = String(localStorage.getItem("cursapp_active_course_v1") || "").trim();
    let count = 0;
    for(const key of allTaskKeys()){
      const tasks = loadJSON(key, []);
      if(!Array.isArray(tasks) || !tasks.length) continue;
      for(const t of tasks){
        if(!t) continue;
        const localId = String(t.id || t.taskId || t.campaignId || "").trim(); if(!localId) continue;
        const courseKey = String(t.courseKey || activeCourseKey || "").trim(); if(!courseKey) continue;
        let cursoId = mapLoad().cursos[courseKey];
        if(!cursoId){
          const current = allLocalCourses().find(c=>normalizeCourseObj(c)?.courseKey === courseKey) || { courseKey, course:{ schoolName:"Colegio", level:"", letter:"", year:null, jornada:"" } };
          cursoId = await ensureCurso(current);
        }
        if(!cursoId) continue;
        const m = mapLoad(); if(m.campanas[localId]) { count++; continue; }
        const body = {
          curso_id: cursoId,
          titulo: String(t.title || t.name || t.nombre || "Campaña").trim() || "Campaña",
          tipo: String(t.type || t.tipo || "single").toLowerCase().includes("mens") ? "monthly" : String(t.type || t.tipo || "single"),
          monto: Number(t.amount || t.monto || 0) || 0,
          fecha_inicio: cleanDate(t.startDate || t.fecha_inicio || t.inicio),
          fecha_vencimiento: cleanDate(t.dueDate || t.endDate || t.fecha_vencimiento || t.fin),
          meses: Number(t.months || t.meses || 1) || 1,
          obligatoria: (t.mandatoryParticipation !== undefined) ? !!t.mandatoryParticipation : (t.obligatoria !== false),
          estado: t.closed ? "cerrada" : (String(t.status || t.estado || "activa") || "activa")
        };
        let found = await selectOne("campanas", "curso_id=eq." + q(cursoId) + "&titulo=eq." + q(body.titulo) + "&select=id");
        let row = found || await insert("campanas", body);
        if(row && row.id){ const mm = mapLoad(); mm.campanas[localId] = row.id; mapSave(mm); count++; }
      }
    }
    return count;
  }

  async function hydrateActiveCourseFromSupabase(reason){
    const ck = activeCourseKey();
    if(!ck) return { hydrated:false, reason:"no-active-course" };

    const curso = await selectOne("cursos", "course_key=eq." + q(ck) + "&select=*");
    if(!curso || !curso.id) return { hydrated:false, reason:"course-not-found", courseKey:ck };

    // Guardar mapa curso local -> Supabase.
    try{ const mm = mapLoad(); mm.cursos[ck] = curso.id; mapSave(mm); }catch(e){}

    const rows = await sb("campanas?curso_id=eq." + q(curso.id) + "&select=*&order=created_at.desc", { method:"GET" });
    const remoteTasks = (Array.isArray(rows) ? rows : []).map(taskFromSupabase);
    const tasksKey = (window.CURSAPP && typeof window.CURSAPP.scopedKey === "function")
      ? window.CURSAPP.scopedKey("tasks_v1")
      : "cursapp_" + ck + "_tasks_v1";
    const localTasks = loadJSON(tasksKey, []);
    const merged = mergeTasksById(Array.isArray(localTasks) ? localTasks : [], remoteTasks);
    const before = JSON.stringify(Array.isArray(localTasks) ? localTasks : []);
    const after = JSON.stringify(merged);
    // Siempre dejar el caché local exactamente igual a Supabase para el curso activo.
    // Si Supabase tiene 9 campañas, la UI debe mostrar 9, no 9 + locales antiguas.
    if(before !== after){
      saveJSON(tasksKey, merged);
      try{ localStorage.setItem("cursapp_supabase_campaigns_authoritative_v1", "1"); }catch(e){}
      try{ window.dispatchEvent(new CustomEvent("cursapp:dataChanged", { detail:{ key:tasksKey, source:"supabase-authoritative-hydrate", count:remoteTasks.length } })); }catch(e){}
      try{ window.dispatchEvent(new CustomEvent("cursapp:dataUpdated", { detail:{ key:tasksKey, source:"supabase-authoritative-hydrate", count:remoteTasks.length } })); }catch(e){}
    }

    const status = { hydrated:true, reason:reason||"manual", courseKey:ck, cursoId:curso.id, campanas:remoteTasks.length, at:new Date().toISOString() };
    try{ localStorage.setItem("cursapp_supabase_last_hydrate_v1", JSON.stringify(status)); }catch(e){}
    return status;
  }

  let timer = null;
  async function syncAll(reason){
    try{
      const cursos = await syncCourses();
      const miembros = await syncUsersAndMembers();
      const campanas = await syncCampaigns();
      log("ok", { reason: reason || "manual", cursos, miembros, campanas });
      try{ await hydrateActiveCourseFromSupabase(reason || "syncAll"); }catch(e){ console.warn("Cursapp Supabase hydrate", e); }
      try{ window.dispatchEvent(new CustomEvent("cursapp:supabaseSynced", { detail:{ cursos, miembros, campanas } })); }catch(e){}
    }catch(e){ log("error", { reason: reason || "manual", message: e && e.message ? e.message : String(e) }); }
  }
  function schedule(reason){ try{ if(timer) clearTimeout(timer); }catch(e){} timer = setTimeout(()=>syncAll(reason), 700); }
  function shouldSyncKey(k){ k = String(k || ""); return k === "cursapp_course_v1" || k === "cursapp_courses_v1" || k === "cursapp_users_v1" || k === "cursapp_profiles_v1" || k === "cursapp_enrollments_v1" || k.indexOf("tasks_v1") >= 0; }

  (function patchStorage(){
    try{
      if(window.__CURSAPP_SUPABASE_STORAGE_PATCHED_CORE_FIX__) return;
      const original = localStorage.setItem.bind(localStorage);
      localStorage.setItem = function(k,v){ original(k,v); if(shouldSyncKey(k)) schedule("setItem:" + k); };
      window.__CURSAPP_SUPABASE_STORAGE_PATCHED_CORE_FIX__ = true;
    }catch(e){}
  })();

  window.addEventListener("cursapp:dataChanged", function(ev){ const k = ev && ev.detail ? ev.detail.key : ""; if(shouldSyncKey(k)) schedule("event:" + k); });
  window.CURSAPP.syncSupabase = function(){ return syncAll("manual"); };
  window.CURSAPP.hydrateSupabase = function(){ return hydrateActiveCourseFromSupabase("manual"); };
  window.CURSAPP.supabaseStatus = function(){ return loadJSON(LOG_KEY, null); };
  window.CURSAPP.supabaseHydrateStatus = function(){ return loadJSON("cursapp_supabase_last_hydrate_v1", null); };

  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", ()=>schedule("DOMContentLoaded"));
  else schedule("load");
  // Evita re-render/parpadeo: una hidratación tardía es suficiente.
  setTimeout(()=>hydrateActiveCourseFromSupabase("late-hydrate-1800").catch(()=>{}), 1800);
})();

/* ============================================================
   Cursapp · Fase 1D.4
   Supabase como fuente oficial de datos operacionales.
   - localStorage queda solo como caché/sesión.
   - Limpia cachés antiguas al cargar dashboards.
   - Hidrata curso, miembros, campañas y pagos desde Supabase.
   ============================================================ */
(function(){
  if(window.__CURSAPP_SUPABASE_OPERATIONAL_ONLY_1D4__) return;
  window.__CURSAPP_SUPABASE_OPERATIONAL_ONLY_1D4__ = true;

  const SB_URL = "https://ngxistgymgdkoaiulfbq.supabase.co";
  const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5neGlzdGd5bWdka29haXVsZmJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2OTg1NDQsImV4cCI6MjA5NjI3NDU0NH0.1r-aLijYEWvUifKcLjlClnA8-oYw11lgThY0swg_xbg";
  const STATUS_KEY = "cursapp_supabase_operational_only_status_v1";

  function parseJSON(v, fallback){ try{ return v ? JSON.parse(v) : fallback; }catch(e){ return fallback; } }
  function loadJSON(k, fallback){ try{ return parseJSON(localStorage.getItem(k), fallback); }catch(e){ return fallback; } }
  function saveJSON(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
  function q(v){ return encodeURIComponent(String(v == null ? "" : v)); }
  function normEmail(v){ return String(v || "").toLowerCase().trim(); }
  function normEstado(v){
    const s = String(v || "").toLowerCase().trim();
    if(["aprobado","aprobada","approved","activo","activa"].includes(s)) return "approved";
    if(["pendiente","pending","solicitado","solicitada"].includes(s)) return "pending";
    if(["rechazado","rechazada","rejected"].includes(s)) return "rejected";
    return s || "approved";
  }
  function uid(prefix){ return `${prefix||"id"}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`; }
  function ymFromISO(iso){ const s = String(iso||""); return s.length >= 7 ? s.slice(0,7) : ""; }

  async function sb(path, opts){
    const res = await fetch(SB_URL + "/rest/v1/" + path, {
      method: (opts && opts.method) || "GET",
      headers: Object.assign({
        "apikey": SB_KEY,
        "Authorization": "Bearer " + SB_KEY,
        "Content-Type": "application/json",
        "Prefer": "return=representation"
      }, (opts && opts.headers) || {}),
      body: opts && opts.body
    });
    const text = await res.text();
    let data = null;
    try{ data = text ? JSON.parse(text) : null; }catch(e){ data = text; }
    if(!res.ok){
      const msg = (data && (data.message || data.error || data.hint)) || text || ("HTTP " + res.status);
      throw new Error(msg);
    }
    return Array.isArray(data) ? data : (data ? [data] : []);
  }

  function getSession(){ return loadJSON("cursapp_session_v1", null) || {}; }
  function activeCourseKey(){
    const s = getSession();
    return String(s.courseKey || localStorage.getItem("cursapp_active_course_v1") || "").trim();
  }
  function scopedKey(base){
    if(window.CURSAPP && typeof window.CURSAPP.scopedKey === "function") return window.CURSAPP.scopedKey(base);
    const ck = activeCourseKey() || "global";
    return "cursapp_" + ck + "_" + base;
  }

  function clearOperationalCache(){
    // Evita que Safari/Chrome muestren datos antiguos antes de hidratar desde BD.
    const keep = new Set([
      "cursapp_session_v1",
      "cursapp_active_role_v1",
      "cursapp_active_course_v1",
      "cursapp_active_profile_v1",
      "cursapp_nav_tab_v1",
      "cursapp_nav_at_v1",
      STATUS_KEY
    ]);
    const patterns = [
      /^cursapp_users_v1$/,
      /^cursapp_profiles_v1$/,
      /^cursapp_enrollments_v1$/,
      /^cursapp_course_v1$/,
      /^cursapp_courses_v1$/,
      /^cursapp_.*_(tasks|payments|expenses|monthly_reports|receipts|enrollments|optout)_v1$/,
      /^cursapp_(tasks|payments|expenses|monthly_reports|receipts|enrollments|optout)_v1$/,
      /^(campanas|cobros|pagos|usuarios|dashboardData)$/
    ];
    try{
      const keys = [];
      for(let i=0;i<localStorage.length;i++) keys.push(localStorage.key(i));
      keys.filter(Boolean).forEach(k=>{
        if(keep.has(k)) return;
        if(patterns.some(rx=>rx.test(k))) localStorage.removeItem(k);
      });
    }catch(e){}
  }

  function courseObject(row){
    row = row || {};
    const colegio = row.colegios || {};
    return {
      courseKey: row.course_key || row.id || "",
      id: row.id || "",
      schoolId: colegio.rbd || "",
      schoolName: colegio.nombre || row.nombre || "Colegio",
      regionName: colegio.region || "",
      comunaName: colegio.comuna || "",
      level: row.nivel || "",
      letter: row.letra || "",
      year: row.anio || "",
      jornada: row.jornada || "",
      inviteCode: row.invite_code || ""
    };
  }

  function taskFromCampana(row, courseKey){
    return {
      id: row.id,
      remoteId: row.id,
      fromSupabase: true,
      courseKey,
      title: row.titulo || "Campaña",
      name: row.titulo || "Campaña",
      amount: Number(row.monto || 0),
      monto: Number(row.monto || 0),
      type: String(row.tipo || "single").toLowerCase().includes("month") || String(row.tipo || "").toLowerCase().includes("mens") ? "monthly" : "single",
      months: Number(row.meses || 1) || 1,
      startDate: row.fecha_inicio || "",
      dueDate: row.fecha_vencimiento || "",
      endDate: row.fecha_vencimiento || "",
      mandatoryParticipation: row.obligatoria !== false,
      status: row.estado || "activa",
      closed: String(row.estado || "").toLowerCase() === "cerrada",
      createdAt: row.created_at || ""
    };
  }

  function paymentFromRow(row, campanasById, miembrosById, courseKey){
    const camp = campanasById[String(row.campana_id||"")] || {};
    const mem = miembrosById[String(row.miembro_id||"")] || {};
    const email = normEmail(mem.email || "");
    const estado = String(row.estado || "pendiente").toLowerCase();
    const paid = ["pagado","paid","conciliado"].includes(estado);
    return {
      id: row.id,
      remoteId: row.id,
      fromSupabase: true,
      paymentKey: [courseKey, row.campana_id, row.miembro_id, row.periodo || ymFromISO(row.fecha_vencimiento || row.created_at || "")].join("|"),
      courseKey,
      fromTaskId: row.campana_id || "",
      campaignId: row.campana_id || "",
      campana_id: row.campana_id || "",
      apoderadoKey: email || row.miembro_id || "",
      apoderadoId: email || row.miembro_id || "",
      apoderadoEmail: email,
      email,
      alumnoId: mem.id || row.miembro_id || "",
      guardianName: mem.nombre_apoderado || "",
      studentName: mem.nombre_alumno || "",
      alumno: mem.nombre_alumno || "",
      concept: camp.titulo || "Pago",
      title: camp.titulo || "Pago",
      amount: Number(row.monto || 0),
      amountRemaining: paid ? 0 : Number(row.monto || 0) - Number(row.monto_pagado || 0),
      monto: Number(row.monto || 0),
      status: paid ? "paid" : "pending",
      estado: row.estado || "pendiente",
      dueDate: row.fecha_vencimiento || "",
      period: row.periodo || ymFromISO(row.fecha_vencimiento || row.created_at || ""),
      paidAt: row.paid_at || "",
      paymentMethod: row.metodo_pago || "",
      metodo_pago: row.metodo_pago || "",
      createdAt: row.created_at || ""
    };
  }

  async function hydrateOperationalFromSupabase(reason){
    const ck = activeCourseKey();
    if(!ck) return { ok:false, reason:"no-active-course" };

    // 1) Curso actual.
    const cursos = await sb("cursos?course_key=eq." + q(ck) + "&select=*,colegios(*)&limit=1");
    const curso = cursos[0];
    if(!curso || !curso.id) return { ok:false, reason:"course-not-found", courseKey:ck };
    const course = courseObject(curso);

    // 2) Datos oficiales del curso.
    const [usuariosRows, miembrosRows, campanasRows, pagosRows] = await Promise.all([
      sb("usuarios?select=*&order=created_at.desc"),
      sb("miembros_curso?curso_id=eq." + q(curso.id) + "&select=*&order=created_at.desc"),
      sb("campanas?curso_id=eq." + q(curso.id) + "&select=*&order=created_at.desc"),
      sb("pagos?curso_id=eq." + q(curso.id) + "&select=*&order=created_at.desc")
    ]);

    const usersById = {};
    usuariosRows.forEach(u=>{ if(u && u.id) usersById[String(u.id)] = u; });

    // 3) Filtrar miembros válidos y deduplicar por curso+usuario+rol.
    const seen = new Set();
    const miembros = [];
    (miembrosRows || []).forEach(m=>{
      if(!m || !m.id || !m.curso_id || !m.rol) return;
      const u = usersById[String(m.usuario_id||"")] || {};
      const email = normEmail(m.email || u.email || "");
      if(!m.usuario_id && !email) return;
      const key = [m.curso_id, m.usuario_id || email, String(m.rol||"").toLowerCase()].join("|");
      if(seen.has(key)) return;
      seen.add(key);
      miembros.push(Object.assign({}, m, { email, __usuario:u }));
    });

    const profiles = miembros.map(m=>{
      const role = String(m.rol || "apoderado").toLowerCase();
      const u = m.__usuario || {};
      const name = m.nombre_apoderado || u.nombre || m.email || "";
      return {
        profileId: m.id,
        userId: m.usuario_id || m.email || "",
        role,
        status: normEstado(m.estado),
        courseKey: ck,
        course,
        apoderado: role === "apoderado" ? {
          name,
          alumno: m.nombre_alumno || "",
          alumnoId: m.id,
          email: m.email || u.email || "",
          phone: u.telefono || ""
        } : null,
        directiva: role !== "apoderado" ? { name } : null,
        activation: { required:true, status:m.activacion_pagada ? "paid" : "unpaid", paidAt:m.activacion_pagada ? (m.updated_at || m.created_at || "") : "" },
        createdAt: m.created_at || ""
      };
    });

    const enrollments = miembros
      .filter(m=>String(m.rol || "").toLowerCase() === "apoderado")
      .map(m=>({
        id: m.id,
        profileId: m.id,
        courseKey: ck,
        cursoId: m.curso_id,
        miembroId: m.id,
        userId: m.usuario_id || "",
        email: m.email || "",
        apoderadoEmail: m.email || "",
        apoderadoName: m.nombre_apoderado || (m.__usuario && m.__usuario.nombre) || m.email || "",
        name: m.nombre_apoderado || (m.__usuario && m.__usuario.nombre) || m.email || "",
        alumno: m.nombre_alumno || "",
        phone: (m.__usuario && m.__usuario.telefono) || "",
        status: normEstado(m.estado),
        activationStatus: m.activacion_pagada ? "paid" : "unpaid",
        createdAt: m.created_at || ""
      }));

    const campanasById = {};
    const tasks = (campanasRows || []).map(c=>{ campanasById[String(c.id)] = c; return taskFromCampana(c, ck); });
    const miembrosById = {};
    miembros.forEach(m=>{ miembrosById[String(m.id)] = m; });
    const payments = (pagosRows || []).map(p=>paymentFromRow(p, campanasById, miembrosById, ck));

    // 4) Escribir caché oficial para pantallas legacy, reemplazando todo lo local.
    const courseObj = { courseKey:ck, inviteCode:course.inviteCode || curso.invite_code || "", course, createdAt:curso.created_at || "", createdByRole:"supabase" };
    saveJSON("cursapp_course_v1", courseObj);
    saveJSON("cursapp_courses_v1", [Object.assign({ courseKey:ck, inviteCode:course.inviteCode || "" }, course)]);
    saveJSON("cursapp_users_v1", usuariosRows.map(u=>({ userId:u.id, email:u.email, name:u.nombre || u.email || "", phone:u.telefono || "", createdAt:u.created_at || "" })));
    saveJSON("cursapp_profiles_v1", profiles);
    saveJSON("cursapp_enrollments_v1", enrollments);
    saveJSON(scopedKey("enrollments_v1"), enrollments);
    saveJSON(scopedKey("tasks_v1"), tasks);
    saveJSON(scopedKey("payments_v1"), payments);
    saveJSON("cursapp_tasks_v1", tasks);
    saveJSON("cursapp_payments_v1", payments);

    const status = { ok:true, reason:reason||"manual", courseKey:ck, cursoId:curso.id, usuarios:usuariosRows.length, miembros:miembros.length, apoderados:enrollments.length, campanas:tasks.length, pagos:payments.length, at:new Date().toISOString() };
    saveJSON(STATUS_KEY, status);
    try{ window.dispatchEvent(new CustomEvent("cursapp:dataChanged", { detail:{ key:"supabase-operational", source:"supabase", status } })); }catch(e){}
    try{ window.dispatchEvent(new CustomEvent("cursapp:dataUpdated", { detail:{ key:"supabase-operational", source:"supabase", status } })); }catch(e){}
    return status;
  }

  window.CURSAPP = window.CURSAPP || {};
  window.CURSAPP.clearOperationalCache = clearOperationalCache;
  window.CURSAPP.hydrateOperationalFromSupabase = hydrateOperationalFromSupabase;
  window.CURSAPP.operationalStatus = function(){ return loadJSON(STATUS_KEY, null); };

  // En páginas de negocio, limpiar caché antigua antes del primer render.
  const path = String(location.pathname || "").toLowerCase();
  const businessPage = /presidente|apoderado|tesorero|admin/.test(path);
  if(businessPage){
    clearOperationalCache();
    const run = ()=>hydrateOperationalFromSupabase("page-load").catch(e=>{
      saveJSON(STATUS_KEY, { ok:false, reason:"error", message:e && e.message ? e.message : String(e), at:new Date().toISOString() });
      console.warn("Cursapp Supabase operational hydrate", e);
    });
    if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", run, { once:true });
    else run();
  }
})();
