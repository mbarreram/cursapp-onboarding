(function () {
  const app = document.getElementById("app");
  const modalRoot = document.getElementById("modalRoot");
  const navItems = Array.from(document.querySelectorAll(".navItem"));
  const menuBtn = document.getElementById("menuBtn");
  const menuDropdown = document.getElementById("menuDropdown");
  const resetBtn = document.getElementById("resetBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  // ---- helpers ----
  const esc = (s) =>
    String(s ?? "").replace(/[&<>'"]/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c])
    );
  const clp = (n) => "$" + Number(n || 0).toLocaleString("es-CL");
  const uid = (p = "id") => `${p}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;

  function detectKey(candidates) {
    for (const k of candidates) if (localStorage.getItem(k) != null) return k;
    return "";
  }

  // storage keys (scoped por curso; listo para producción)
  const sk = (base)=> (window.CURSAPP && window.CURSAPP.scopedKey) ? window.CURSAPP.scopedKey(base) : `cursapp_${base}`;
  const KEY_TASKS = sk("tasks_v1");
  const KEY_PAYMENTS = sk("payments_v1");
  const KEY_EXPENSES = sk("expenses_v1");
  const KEY_MONTHLY_REPORTS = sk("monthly_reports_v1");
  const KEY_DIRTY = detectKey(["cursapp_reports_dirty_v1", "reportsDirty", "cursapp_dirty_reports"]) || "cursapp_reports_dirty_v1";

  const load = (k, def) => {
    try { return JSON.parse(localStorage.getItem(k) || JSON.stringify(def)); }
    catch { return def; }
  };
  const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));

  const markDirty = () => localStorage.setItem(KEY_DIRTY, "1");
  const clearDirty = () => localStorage.removeItem(KEY_DIRTY);
  const isDirty = () => localStorage.getItem(KEY_DIRTY) === "1";

  const sum = (arr, fn) => (arr || []).reduce((a, x) => a + Number(fn ? fn(x) : x || 0), 0);

  function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }

  function isExpired(t){
    if(!t.dueDate) return false;
    const due = new Date(t.dueDate + "T23:59:59");
    if(isNaN(due.getTime())) return false;
    return due.getTime() < Date.now();
  }

  // payment status tolerance
  const isPaid = (p) => p.status === "paid";
  const isCredit = (p) => p.status === "credit";
  const isPendingLike = (p) => ["pending","unpaid","due","partial"].includes(String(p.status||"").toLowerCase());

  // data access
  const tasks = () => load(KEY_TASKS, []);
  const payments = () => load(KEY_PAYMENTS, []);
  const expenses = () => load(KEY_EXPENSES, []);
  const reports = () => load(KEY_MONTHLY_REPORTS, []);

  const activeTasks = () => tasks().filter(t => !t.closed && !isExpired(t));
  const expiredTasks = () => tasks().filter(t => !t.closed && isExpired(t));
  const closedTasks = () => tasks().filter(t => !!t.closed);

  const collectedCourse = () => sum(payments().filter(isPaid), p => p.amount);
  const spentCourse = () => sum(expenses(), e => e.amount);
  const saldoCourse = () => collectedCourse() - spentCourse();

  const creditTotal = () => sum(payments().filter(isCredit), p => p.amount);
  const pendingTotal = () => sum(payments().filter(isPendingLike), p => (p.amountRemaining ?? p.amount ?? 0));
  const deudoresCount = () => payments().filter(isPendingLike).length;

  // ---- curso / apoderados aprobados ----
  const KEY_ACTIVE_COURSE = "cursapp_active_course_v1";
  const KEY_ENROLL = "cursapp_enrollments_v1";

  function activeCourseKey(){
    return localStorage.getItem(KEY_ACTIVE_COURSE) || "";
  }
  function approvedApoderados(){
    const ck = activeCourseKey();
    try{
      const list = JSON.parse(localStorage.getItem(KEY_ENROLL) || "[]");
      return list.filter(e => (!ck || e.courseKey===ck) && e.status==="approved");
    }catch(e){
      return [];
    }
  }
  function approvedCount(){
    const n = approvedApoderados().length;
    return n || 1; // fallback
  }

  // ---- fechas / periodos ----
  function ymFromISO(iso){
    if(!iso) return "";
    const s = String(iso);
    if(s.length >= 7) return s.slice(0,7);
    return "";
  }
  function currentYYYYMM(){
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
  }
  function endOfMonthDate(ym){
    const [y,m] = ym.split("-").map(x=>parseInt(x,10));
    if(!y || !m) return null;
    return new Date(y, m, 0); // last day of month
  }
  function withinMonth(iso, ym){
    return ymFromISO(iso) === ym;
  }

  // ---- KPIs mes ----
  function collectedMonth(ym){
    // prefer paidAt / paidDate if exists; fallback dueDate
    return sum(payments().filter(p=>{
      if(!isPaid(p)) return false;
      const dt = p.paidAt || p.paidDate || p.paid_on || "";
      return withinMonth(String(dt).slice(0,10), ym) || withinMonth(p.createdAt||"", ym);
    }), p=>p.amount);
  }

  function spentMonth(ym){
    return sum(expenses().filter(e=> withinMonth(e.date||"", ym)), e=>e.amount);
  }

  function pendingMonthReal(ym){
    return sum(payments().filter(p=>{
      if(!isPendingLike(p)) return false;
      if(String(p.status||"").toLowerCase()==="opted_out") return false;
      const due = p.dueDate || "";
      return withinMonth(due, ym);
    }), p => (p.amountRemaining ?? p.amount ?? 0));
  }

  // Pendiente operacional del mes (dashboard):
  // - Usa proyección máxima del mes (campañas) menos lo recaudado.
  // - Evita depender de que los cobros existan ya en payments_v1.
  function pendingMonth(ym){
    const expected = pendingMonthProjected(ym);
    const collected = collectedMonth(ym);
    return Math.max(0, expected - collected);
  }

  // Proyección máxima (ajustada por opt-out si existe)
  function pendingMonthProjected(ym){
    const people = approvedCount();
    const tks = tasks();
    let expected = 0;

    // monthly campaigns: contribute amount if month is within their schedule
    tks.forEach(t=>{
      if(t.closed) return;
      const type = String(t.type||"single").toLowerCase();
      const amt = Number(t.amount||0);

      if(type==="monthly"){
        // month range: from startDate month to start+months-1
        const startYM = ymFromISO(t.startDate||t.dueDate||"");
        if(!startYM) return;
        const months = Math.max(1, Number(t.months||1));

        // compute index of ym relative to startYM
        const sy = parseInt(startYM.slice(0,4),10), sm = parseInt(startYM.slice(5,7),10);
        const cy = parseInt(ym.slice(0,4),10), cm = parseInt(ym.slice(5,7),10);
        const idx = (cy - sy)*12 + (cm - sm) + 1; // 1-based
        if(idx < 1 || idx > months) return;

        expected += amt * people;

        // opt-out adjustment for non mandatory (if we have opted_out payments for this task+month)
        if(t.mandatoryParticipation === false){
          const opted = payments().filter(p=>{
            return p.fromTaskId===t.id && String(p.status||"").toLowerCase()==="opted_out" && withinMonth(p.dueDate||p.period||"", ym);
          }).length;
          expected -= Math.min(opted, people) * amt;
        }
        return;
      }

      // single payment: only count if dueDate month equals ym
      const dueYM = ymFromISO(t.dueDate||"");
      if(dueYM && dueYM===ym){
        expected += amt * people;

        if(t.mandatoryParticipation === false){
          const opted = payments().filter(p=>{
            return p.fromTaskId===t.id && String(p.status||"").toLowerCase()==="opted_out" && withinMonth(p.dueDate||p.period||"", ym);
          }).length;
          expected -= Math.min(opted, people) * amt;
        }
      }
    });

    return Math.max(0, expected);
  }

  function debtorsMonthCount(ym){
    // count unique apoderados with pending in month (if we have email); else count pending items
    const pend = payments().filter(p=>isPendingLike(p) && withinMonth(p.dueDate||"", ym) && String(p.status||"").toLowerCase()!=="opted_out");
    const emails = new Set(pend.map(p=>p.apoderadoEmail||p.email||"").filter(Boolean));
    return emails.size ? emails.size : pend.length;
  }

  function collectedTask(id){
    return sum(payments().filter(p=>p.fromTaskId===id && isPaid(p)), p=>p.amount);
  }
  function pendingTask(id){
    // pendiente operacional (solo cobros instanciados)
    return sum(payments().filter(p=>String(p.fromTaskId||"")===String(id||"") && isPendingLike(p)), p => (p.amountRemaining ?? p.amount ?? 0));
  }

  function expectedTaskTotal(t){
    if(!t) return 0;
    const monto = Number(t.amount||0);
    const nApo = approvedCount(); // apoderados aprobados (fallback=1)
    const type = String(t.type||"single").toLowerCase();
    if(type==="monthly"){
      const months = Math.max(1, Number(t.months||1));
      return monto * months * nApo;
    }
    return monto * nApo;
  }

  function pendingTaskEstimated(t){
    // Pendiente estimado (aunque aún no existan cobros instanciados para apoderados)
    const expected = expectedTaskTotal(t);
    const rec = collectedTask(t.id);
    return Math.max(0, expected - rec);
  }

  function deudoresTask(id){
    return payments().filter(p=>p.fromTaskId===id && isPendingLike(p)).length;
  }
  function spentTask(id){
    return sum(expenses().filter(e=>e.scope==="campaign" && e.campaignId===id), e=>e.amount);
  }

  function latestReport(){
    const r = reports();
    return r.length ? r[0] : null;
  }

  function openModal(html){
    modalRoot.innerHTML = `
      <div style="position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:10000;display:flex;align-items:flex-end;justify-content:center;padding:14px;">
        <div class="card" style="width:min(820px,100%);margin-bottom:12px;">
          ${html}
        </div>
      </div>
    `;
  }
  function closeModal(){ modalRoot.innerHTML=""; }
  window.closeModal = closeModal;

  // ----- menu -----
  function initMenu(){
    if(menuBtn && menuDropdown){
      menuBtn.onclick = (e)=>{e.stopPropagation(); menuDropdown.style.display = (menuDropdown.style.display==="block"?"none":"block");};
      document.addEventListener("click", ()=> menuDropdown.style.display="none");
    }
    if(resetBtn){
      resetBtn.onclick = ()=>{
        if(!confirm("Reset demo presidente. ¿Continuar?")) return;
        localStorage.removeItem(KEY_TASKS);
        localStorage.removeItem(KEY_PAYMENTS);
        localStorage.removeItem(KEY_EXPENSES);
        localStorage.removeItem(KEY_MONTHLY_REPORTS);
        localStorage.removeItem(KEY_DIRTY);
        alert("Datos reseteados.");
        // ✅ CAMBIO 2: NO re-sembrar demo automáticamente
        go("home");
      };
    }
    if(logoutBtn){
      // ✅ CAMBIO 3: logout al login real
      logoutBtn.onclick = ()=> location.href="/index.html";
    }
  }

  // ----- demo seed (if empty) -----
  function ensureDemo(){
    if(tasks().length) return;

    save(KEY_TASKS, [
      {id:"t1", title:"Rifa del curso", description:"", startDate:"2026-01-10", dueDate:"2026-01-31", closed:false, closeType:"", closeReason:"", mandatoryParticipation:true, type:"single", months:1, amount:10000, goalTotal:150000},
      {id:"t2", title:"Paseo de curso", description:"", startDate:"2026-02-01", dueDate:"2026-04-01", closed:false, closeType:"", closeReason:"", mandatoryParticipation:false, type:"monthly", months:3, amount:20000, goalTotal:null},
    ]);

    save(KEY_PAYMENTS, [
      {id:"p1", fromTaskId:"t1", amount:10000, status:"paid"},
      {id:"p2", fromTaskId:"t1", amount:10000, status:"paid"},
      {id:"p3", fromTaskId:"t2", amount:20000, status:"pending"},
      {id:"p4", fromTaskId:"t2", amount:20000, status:"paid"},
      {id:"c1", fromTaskId:"t1", amount:5000, status:"credit", note:"Saldo a favor por campaña eliminada"}
    ]);

    save(KEY_EXPENSES, [
      {id:"e1", scope:"campaign", campaignId:"t1", title:"Flores", date:"2026-01-18", amount:25000, attachments:[{name:"boleta.jpg"}]},
      {id:"e2", scope:"campaign", campaignId:"t2", title:"Reserva", date:"2026-02-18", amount:60000, attachments:[]},
    ]);

    save(KEY_MONTHLY_REPORTS, []);
    clearDirty();
  }

  // ----- state -----
  let state = { tab:"home" };
  let campaignFilter = "active"; // active | expired | closed | all

  function setActive(tab){
    navItems.forEach(b=>b.classList.toggle("active", b.dataset.tab===tab));
  }

  function go(tab){
    state.tab = tab;
    setActive(tab);
    if(tab==="home") renderHome();
    if(tab==="campanas") renderCampanas();
    if(tab==="informes") renderInformes();
  }

  navItems.forEach(b=> b.onclick=()=> go(b.dataset.tab));

  
  // ----- Watcher: refrescar Campañas cuando cambian las tasks -----
  let __TASKS_SIG = "";
  function __tasksSig(){
    try{
      const raw = localStorage.getItem(KEY_TASKS) || "[]";
      let h=0; for(let i=0;i<raw.length;i++) h=(h*31 + raw.charCodeAt(i))>>>0;
      return String(h);
    }catch(e){ return ""; }
  }
// ----- UI pieces -----
  function statusPillForCampaign(t){
    if(t.closed){
      const pend = pendingTaskEstimated(t);
      if(pend > 0) return `<span class="pill warn">Cerrada · con pagos pendientes</span>`;
      return `<span class="pill">Cerrada</span>`;
    }
    if(isExpired(t)) return `<span class="pill danger">Caducada</span>`;
    return `<span class="pill ok">Activa</span>`;
  }

  function lineClassForCampaign(t){
    const pend = pendingTaskEstimated(t);
    const saldo = collectedTask(t.id) - spentTask(t.id);
    if(saldo < 0) return "isDanger";
    if(pend > 0 && t.closed) return "isWarn";
    if(isExpired(t)) return "isWarn";
    return "isOk";
  }

  function campaignTypeLabel(t){
    const type = String(t.type||"single");
    if(type==="monthly"){
      const m = Number(t.months||1);
      return `Mensual · ${m} cuota(s)`;
    }
    return "Pago único";
  }

  // ----- Home -----
  function renderHome(){
    const ym = currentYYYYMM();
    const recMes = collectedMonth(ym);
    const recTot = collectedCourse();
    const gasMes = spentMonth(ym);
    const gasTot = spentCourse();
    const sal = saldoCourse();

    const pendMes = pendingMonth(ym);
    const pendProjMes = pendingMonthProjected(ym);
    // Para el dashboard: si existe pendiente (proyección - recaudado),
    // asumimos deudores potenciales = apoderados aprobados.
    // (En producción esto vendrá del Billing Service con detalle por apoderado.)
    const debtorsMes = pendMes > 0 ? approvedCount() : 0;
    const credit = creditTotal();
    const apods = approvedCount();

    const last = latestReport();

    const alerts = [];
    // En el dashboard principal mostramos el pendiente REAL (lo que falta por pagar).
    // La proyección se puede usar para análisis, pero no debe confundirse con lo adeudado.
    if(pendMes > 0) alerts.push(`⏳ Pendiente mes: ${clp(pendMes)}`);
    if(debtorsMes > 0) alerts.push(`👥 Deudores (mes): ${debtorsMes}`);
    if(isDirty()) alerts.push(`📄 Informe desactualizado`);

    app.innerHTML = `
      ${alerts.length ? `
        <div class="warnBox">
          <div style="font-weight:950;">Resumen rápido</div>
          <div class="muted" style="margin-top:6px;">${alerts.join(" · ")}</div>
        </div>
      `:""}

      ${last ? `
        <div class="card">
          <div class="row">
            <div>
              <div class="kTitle">Último informe publicado</div>
              <div class="muted" style="margin-top:6px;">Periodo ${esc(last.period)} · Emitido ${esc(last.generatedAt||"")}</div>
            </div>
            <div class="actions">
              <button class="btnx" onclick="go('informes')">Ver informes</button>
            </div>
          </div>
        </div>
      `:""}

      <div class="card">
        <div class="row">
          <div>
            <div class="kTitle">Resumen ejecutivo del curso</div>
            <div class="muted" style="margin-top:6px;">Montos globales (no personales)</div>
          </div>
          <div class="actions">
            <button class="btnx primary" onclick="confirmGenerateReport()">${isDirty() ? "Actualizar y publicar" : "📄 Publicar informe"}</button>
          </div>
        </div>

        <div class="kpiGrid">
          <div class="kpi"><div class="lbl">💰 Recaudado (mes)</div><div class="val">${clp(recMes)}</div></div>
          <div class="kpi"><div class="lbl">💰 Recaudado (total)</div><div class="val">${clp(recTot)}</div></div>
          <div class="kpi"><div class="lbl">🧾 Gastado (mes)</div><div class="val">${clp(gasMes)}</div></div>
          <div class="kpi"><div class="lbl">🧾 Gastado (total)</div><div class="val">${clp(gasTot)}</div></div>
          <div class="kpi"><div class="lbl">⚖️ Saldo disponible</div><div class="val">${clp(sal)}</div></div>
          <div class="kpi"><div class="lbl">⏳ Pendiente (mes)</div><div class="val">${clp(pendMes)}</div></div>
        </div>

        ${pendProjMes>pendMes ? `
          <div class="muted" style="margin-top:10px;font-weight:900;">
            Proyección máxima del mes: <b>${clp(pendProjMes)}</b>
          </div>
        ` : ``}

        <div style="margin-top:10px;display:flex;gap:10px;flex-wrap:wrap;">
          <span class="pill">👥 Deudores (mes) ${debtorsMes}</span>
          <span class="pill">🧑‍🤝‍🧑 Apoderados ${apods}</span>
          <span class="pill ok">➕ Saldo a favor ${clp(credit)}</span>
          ${isDirty()?`<span class="pill warn">📄 Informe desactualizado</span>`:""}
        </div>
      </div>

      <div class="card">
        <div class="kTitle">Acciones</div>
        <div class="actions" style="margin-top:10px;">
          <button class="btnx primary" onclick="openCreateCampaign()">➕ Crear campaña</button>
          <button class="btnx" onclick="openCloseCampaign()">🔒 Cerrar campaña</button>
          <button class="btnx" onclick="go('campanas')">📌 Ver campañas</button>
        </div>
      </div>
    `;
  }

  // ----- Campaigns -----
  function setFilter(f){
    campaignFilter = f;
    renderCampanas();
  }
  window.setFilter = setFilter;

  function getFilteredCampaigns(){
    if(campaignFilter==="active") return activeTasks();
    if(campaignFilter==="expired") return expiredTasks();
    if(campaignFilter==="closed") return closedTasks();
    return tasks();
  }

  function renderCampanas(){
    const filtered = getFilteredCampaigns();

    const chips = `
      <div class="chips">
        <button class="chip ${campaignFilter==="active"?"active":""}" onclick="setFilter('active')">Activas</button>
        <button class="chip ${campaignFilter==="expired"?"active":""}" onclick="setFilter('expired')">Caducadas</button>
        <button class="chip ${campaignFilter==="closed"?"active":""}" onclick="setFilter('closed')">Cerradas</button>
        <button class="chip ${campaignFilter==="all"?"active":""}" onclick="setFilter('all')">Todas</button>
      </div>
    `;

    const list = filtered.map(t=>{
      const rec = collectedTask(t.id);
      const gas = spentTask(t.id);
      const saldo = rec - gas;
      const pend = pendingTaskEstimated(t);
      const debtors = deudoresTask(t.id);

      const monto = Number(t.amount||0);
      const tipo = campaignTypeLabel(t);
      const part = (t.mandatoryParticipation === false) ? "No obligatoria" : "Obligatoria";
      const meta = (t.goalTotal != null && Number(t.goalTotal)>0) ? Number(t.goalTotal) : 0;

      
      return `
        <div class="campCard ${lineClassForCampaign(t)}" style="margin-top:12px;">
          <div class="campHead">
            <div class="campTitleRow">
              <div class="campTitle">${esc(t.title)}</div>
              ${statusPillForCampaign(t)}
            </div>
            <div class="campDates">${esc(t.startDate||"")} → ${esc(t.dueDate||"")}</div>
          </div>

          <div class="chipInfoRow">
            <span class="chipInfo">💵 <strong>Monto</strong> ${clp(monto)}</span>
            <span class="chipInfo">🧾 <strong>Tipo</strong> ${esc(tipo)}</span>
            <span class="chipInfo">🔒 <strong>Participación</strong> ${esc(part)}</span>
            ${meta?`<span class="chipInfo">🎯 <strong>Meta</strong> ${clp(meta)}</span>`:""}
          </div>

          <div class="campMetrics">
            <div class="metricBox">
              <div class="metricLbl">Recaudado</div>
              <div class="metricVal">${clp(rec)}</div>
            </div>
            <div class="metricBox">
              <div class="metricLbl">Gastado</div>
              <div class="metricVal">${clp(gas)}</div>
            </div>
            <div class="metricBox">
              <div class="metricLbl">Saldo</div>
              <div class="metricVal">${clp(saldo)}</div>
            </div>
            <div class="metricBox">
              <div class="metricLbl">Deudores</div>
              <div class="metricVal">${Number(debtors||0)}</div>
            </div>
            <div class="metricBox">
              <div class="metricLbl">Pendiente</div>
              <div class="metricVal">${clp(pend)}</div>
            </div>
          </div>

          ${t.closed && pend>0 ? `<div class="muted" style="padding:0 14px 12px 14px;font-size:12px;">
            Esta campaña está cerrada, pero aún hay aportes pendientes (arrastran al siguiente mes).
          </div>` : ``}

          <div class="campActions">
            <button class="btnx" onclick="openEditCampaign('${t.id}')">✏️ Editar</button>
            ${(!t.closed && !isExpired(t)) ? `<button class="btnx danger" onclick="deleteCampaign('${t.id}')">🗑️ Eliminar</button>` : ""}
          </div>
        </div>
      `;
}).join("");

    app.innerHTML = `
      <style>
.campCard{border-radius:18px;border:1px solid rgba(0,0,0,.08);overflow:hidden;background:#fff}
.campHead{padding:14px 14px 10px 14px}
.campTitleRow{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.campTitle{font-weight:950;font-size:20px}
.campDates{margin-top:6px;font-size:12px;opacity:.7;font-weight:800}
.chipInfoRow{padding:0 14px 12px 14px;display:flex;gap:8px;flex-wrap:wrap}
.chipInfo{display:inline-flex;align-items:center;gap:6px;padding:8px 10px;border-radius:999px;border:1px solid rgba(0,0,0,.10);background:rgba(17,24,39,.03);font-weight:900;font-size:13px;cursor:default;user-select:none}
.chipInfo strong{font-weight:950}
.campMetrics{padding:12px 14px;background:rgba(17,24,39,.02);border-top:1px solid rgba(0,0,0,.06);display:flex;gap:10px;flex-wrap:wrap}
.metricBox{flex:1 1 120px;min-width:120px;border:1px solid rgba(0,0,0,.08);background:#fff;border-radius:14px;padding:10px 12px}
.metricLbl{font-size:12px;opacity:.7;font-weight:900}
.metricVal{margin-top:4px;font-weight:950;font-size:16px}
.campActions{padding:12px 14px 14px 14px;border-top:1px solid rgba(0,0,0,.06);display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap}
</style>

      <div class="card">
        <div class="row">
          <div>
            <div class="kTitle">Campañas</div>
            <div class="muted" style="margin-top:6px;">Muestra deudores sin nombres y pendiente estimado.</div>
          </div>
          <div class="actions">
            <button class="btnx primary" onclick="openCreateCampaign()">➕ Crear campaña</button>
          </div>
        </div>

        ${chips}

        <div class="listLines">
          ${list || `<div class="muted">Sin campañas en este filtro.</div>`}
        </div>
      </div>
    `;
  }

  // ----- Informes -----
  function renderInformes(){
    const reps = reports();

    app.innerHTML = `
      ${isDirty()?`
        <div class="warnBox">
          <div style="font-weight:950;">Informe desactualizado</div>
          <div class="muted" style="margin-top:6px;">Hubo cambios posteriores al último informe. Publica uno nuevo.</div>
          <div class="actions" style="margin-top:10px;">
            <button class="btnx primary" onclick="confirmGenerateReport()">Actualizar y publicar</button>
          </div>
        </div>
      `:""}

      <div class="card">
        <div class="row">
          <div>
            <div class="kTitle">Informes mensuales</div>
            <div class="muted" style="margin-top:6px;">Snapshots del curso (no personales).</div>
          </div>
          <div class="actions">
            <button class="btnx primary" onclick="confirmGenerateReport()">Publicar informe</button>
          </div>
        </div>

        <div class="listLines">
          ${reps.length
            ? reps.map(r=>`
              <div class="lineItem">
                <b>${esc(r.period)}</b> · Emitido ${esc(r.generatedAt)}
                <div class="muted" style="margin-top:6px;">
                  Recaudado ${clp(r.recaudadoCurso||0)}
                  · Rendido ${clp(r.gastadoCurso||0)}
                  · Saldo ${clp(r.disponibleCurso||0)}
                  · Pendiente ${clp(r.pendienteCurso||0)}
                  · Deudores ${Number(r.deudores||0)}
                </div>
              </div>
            `).join("")
            : `<div class="muted">Sin informes publicados.</div>`
          }
        </div>
      </div>
    `;
  }

  // ----- Campaign actions (delegated to campaigns.js) -----
  window.openCreateCampaign = function () { Campaigns.openCreate(); };
  window.openEditCampaign = function (taskId) { Campaigns.openEdit(taskId); };
  window.openCloseCampaign = function () { Campaigns.openClose(() => activeTasks()); };

  // Mantener ELIMINAR campaña (activa) en Presidente
  
  // ✅ Publicar cobros: genera pagos pendientes para apoderados (para que Apoderado vea la campaña)
  window.publishCobros = function(taskId){
    const t = tasks().find(x=>x.id===taskId);
    if(!t) return alert("Campaña no encontrada.");

    // Evitar duplicados
    const ps = payments().slice();

    function addPayment(dueDate, concept){
      const exists = ps.some(p=>p.fromTaskId===taskId && String(p.dueDate||"")===String(dueDate||"") && String(p.concept||"")===String(concept||""));
      if(exists) return;
      ps.unshift({
        id: uid("pay"),
        fromTaskId: taskId,
        concept,
        amount: Number(t.amount||0),
        status: "pending",
        dueDate,
        createdAt: new Date().toISOString()
      });
    }

    function addMonths(dateStr, n){
      const d = new Date(dateStr + "T12:00:00");
      if(isNaN(d.getTime())) return dateStr;
      d.setMonth(d.getMonth()+n);
      return d.toISOString().slice(0,10);
    }

    const type = String(t.type||"single").toLowerCase();
    if(type === "monthly"){
      const months = Math.max(1, Number(t.months||1));
      const base = t.startDate || todayISO();
      for(let i=0;i<months;i++){
        const due = addMonths(base, i);
        addPayment(due, `${t.title} · Cuota ${i+1}/${months}`);
      }
    }else{
      addPayment(t.dueDate || todayISO(), t.title);
    }

    save(KEY_PAYMENTS, ps);
    markDirty();
    alert("Cobros publicados ✅");
    go("campanas");
  };
window.deleteCampaign = function(taskId){
    const t = tasks().find(x=>x.id===taskId);
    if(!t) return;

    if(t.closed){ alert("No se puede eliminar una campaña cerrada."); return; }
    if(isExpired(t)){ alert("No se puede eliminar una campaña caducada."); return; }

    const msg = `¿Eliminar campaña "${t.title}"?\n\n` +
      `Regla: pagos pagados pasan a saldo a favor.\n` +
      `Los pendientes se eliminan del ciclo de cobro.\n\n` +
      `Esto marcará “requiere nuevo informe”.`;

    if(!confirm(msg)) return;

    // eliminar campaña
    save(KEY_TASKS, tasks().filter(x=>x.id!==taskId));

    // eliminar rendiciones asociadas
    save(KEY_EXPENSES, expenses().filter(e=>!(e.scope==="campaign" && e.campaignId===taskId)));

    // pagos: paid -> credit, pending-like -> remove
    const ps = payments()
      .filter(p=>!(p.fromTaskId===taskId && isPendingLike(p))) // elimina pendientes de esa campaña
      .map(p=>{
        if(p.fromTaskId===taskId && isPaid(p)){
          return {...p, status:"credit", creditFromTaskId:taskId, note:"Saldo a favor por campaña eliminada"};

  // ----- Publicar cobros (genera pagos por apoderado aprobado) -----
  function endOfMonthISO(ym){
    const d = endOfMonthDate(ym);
    if(!d) return "";
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const dd = String(d.getDate()).padStart(2,'0');
    return `${yyyy}-${mm}-${dd}`;
  }

  function addMonthsYM(ym, add){
    const y = parseInt(ym.slice(0,4),10);
    const m = parseInt(ym.slice(5,7),10);
    const base = (y*12 + (m-1)) + add;
    const ny = Math.floor(base/12);
    const nm = (base%12)+1;
    return `${ny}-${String(nm).padStart(2,'0')}`;
  }

  function paymentsForTask(taskId){
    return payments().filter(p=>p.fromTaskId===taskId);
  }

  function publishCobrosForTask(taskId){
    const t = tasks().find(x=>x.id===taskId);
    if(!t) return;
    const people = approvedApoderados();
    if(!people.length){
      alert('No hay apoderados aprobados para generar cobros.');
      return;
    }
    const existing = paymentsForTask(taskId);
    const byKey = new Set(existing.map(p=>`${p.apoderadoEmail||p.email||''}||${p.period||ymFromISO(p.dueDate)||''}||${p.installmentIndex||''}`));
    const out = payments().slice();
    const type = String(t.type||'single').toLowerCase();
    if(type==='monthly'){
      const startYM = ymFromISO(t.startDate||t.dueDate||currentYYYYMM());
      const months = Math.max(1, Number(t.months||1));
      for(let i=0;i<months;i++){
        const period = addMonthsYM(startYM, i);
        const dueDate = endOfMonthISO(period);
        const idx = i+1;
        people.forEach(e=>{
          const email = e.email || '';
          const key = `${email}||${period}||${idx}`;
          if(byKey.has(key)) return;
          out.unshift({
            id: uid('pay'),
            fromTaskId: t.id,
            concept: `${t.title} · Cuota ${idx}/${months}`,
            amount: Number(t.amount||0),
            status: 'pending',
            dueDate,
            period,
            installmentIndex: idx,
            apoderadoEmail: email,
            apoderadoName: e.apoderadoName||'',
            alumno: e.alumno||'',
            createdAt: new Date().toISOString()
          });
          byKey.add(key);
        });
      }
    } else {
      const period = ymFromISO(t.dueDate||t.startDate||currentYYYYMM());
      const dueDate = t.dueDate||endOfMonthISO(period);
      people.forEach(e=>{
        const email = e.email || '';
        const key = `${email}||${period}||1`;
        if(byKey.has(key)) return;
        out.unshift({
          id: uid('pay'),
          fromTaskId: t.id,
          concept: t.title,
          amount: Number(t.amount||0),
          status: 'pending',
          dueDate,
          period,
          installmentIndex: 1,
          apoderadoEmail: email,
          apoderadoName: e.apoderadoName||'',
          alumno: e.alumno||'',
          createdAt: new Date().toISOString()
        });
        byKey.add(key);
      });
    }
    save(KEY_PAYMENTS, out);
    markDirty();
    alert('Cobros publicados ✅');
    go('campanas');
  }

  window.publishCobrosForTask = publishCobrosForTask;
  window.publishCobros = publishCobrosForTask;

        }
        return p;
      });
    save(KEY_PAYMENTS, ps);

    markDirty();
    alert("Campaña eliminada ✅ (saldo a favor generado si aplica)");
    go("campanas");
  };

  // ----- Publish report (monthly) -----
  window.confirmGenerateReport = function(){
    if(!confirm("¿Publicar informe mensual del curso?")) return;
    publishMonthly();
  };

  function publishMonthly(){
    const period = prompt("Mes (YYYY-MM)", "2026-01");
    if(!period) return;
    if(!/^\d{4}-\d{2}$/.test(period)){ alert("Formato inválido (YYYY-MM)"); return; }

    const rep = {
      id: uid("repM"),
      period,
      generatedAt: new Date().toLocaleString("es-CL"),
      recaudadoCurso: collectedCourse(),
      gastadoCurso: spentCourse(),
      disponibleCurso: saldoCourse(),
      pendienteCurso: pendingTotal(),
      deudores: deudoresCount(),
      saldoFavor: creditTotal()
    };

    const reps = reports();
    reps.unshift(rep);
    save(KEY_MONTHLY_REPORTS, reps);

    clearDirty();
    alert("Informe publicado ✅");
    go("informes");
  }

  // ----- boot -----
  // ✅ DEMO seed solo si está activado globalmente
  const DEMO_SEED = !!(window.CURSAPP && window.CURSAPP.DEMO_MODE);
  if (DEMO_SEED) ensureDemo();

  initMenu();
  setInterval(()=>{
    if(state.tab!=="campanas") return;
    const sig = __tasksSig();
    if(sig && sig!==__TASKS_SIG){ __TASKS_SIG=sig; renderCampanas(); }
  }, 800);
  go("home");
})();
