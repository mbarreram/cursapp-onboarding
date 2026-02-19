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
