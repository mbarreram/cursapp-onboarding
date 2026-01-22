/* =========================================================
   Cursapp · Presidente (vista aislada) — COMPLETO
   Incluye:
   - Inicio con alertas + KPIs + acciones clave
   - Campañas con filtro chips: Activas / Caducadas / Cerradas / Todas
   - Crear campaña completo:
       nombre, descripción, tipo (single/monthly), participación, monto,
       meta total opcional, inicio/fin, cuotas/meses para mensual
       + cálculo automático de fecha fin (mensual)
   - Editar campaña completo (misma lógica que crear)
   - Cerrar campaña con: tipo de cierre + motivo obligatorio
   - Eliminar solo campañas activas:
       NO borra pagos, convierte pagos pagados -> "credit" (saldo a favor)
       elimina gastos/rendiciones asociados
   - Informes mensuales:
       generar/actualizar, historial, "informe desactualizado" si hay cambios
========================================================= */

(function () {

  /* ------------------ DOM ------------------ */
  const app = document.getElementById("app");
  const modalRoot = document.getElementById("modalRoot");

  const navItems = Array.from(document.querySelectorAll(".navItem"));
  const menuBtn = document.getElementById("menuBtn");
  const menuDropdown = document.getElementById("menuDropdown");
  const resetBtn = document.getElementById("resetBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  /* ------------------ Helpers ------------------ */
  const esc = (s) =>
    String(s ?? "").replace(/[&<>'"]/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c])
    );

  const clp = (n) => "$" + Number(n || 0).toLocaleString("es-CL");

  const uid = (p = "id") =>
    `${p}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;

  function detectKey(candidates) {
    for (const k of candidates) if (localStorage.getItem(k) != null) return k;
    return "";
  }

  /* ------------------ Storage keys ------------------ */
  // Auto-detect to be compatible with your existing data
  const KEY_TASKS =
    detectKey(["cursapp_tasks_v1", "tasks", "campanas"]) || "cursapp_tasks_v1";
  const KEY_PAYMENTS =
    detectKey(["cursapp_payments_v1", "payments", "pagos"]) || "cursapp_payments_v1";
  const KEY_EXPENSES =
    detectKey(["cursapp_expenses_v1", "expenses", "gastos", "rendiciones"]) || "cursapp_expenses_v1";
  const KEY_MONTHLY_REPORTS =
    detectKey(["cursapp_monthly_reports_v1", "monthly_reports", "informesMensuales"]) || "cursapp_monthly_reports_v1";
  const KEY_DIRTY =
    detectKey(["cursapp_reports_dirty_v1", "reportsDirty", "cursapp_dirty_reports"]) || "cursapp_reports_dirty_v1";

  const load = (k, def) => {
    try { return JSON.parse(localStorage.getItem(k) || JSON.stringify(def)); }
    catch { return def; }
  };
  const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));

  const markDirty = () => localStorage.setItem(KEY_DIRTY, "1");
  const clearDirty = () => localStorage.removeItem(KEY_DIRTY);
  const isDirty = () => localStorage.getItem(KEY_DIRTY) === "1";

  const sum = (arr, fn) => (arr || []).reduce((a, x) => a + Number(fn ? fn(x) : x || 0), 0);

  const hasBoleta = (e) =>
    (Array.isArray(e.attachments) && e.attachments.length) ||
    e.receipt || e.boleta === true;

  /* ------------------ Data selectors ------------------ */
  const tasks = () => load(KEY_TASKS, []);
  const payments = () => load(KEY_PAYMENTS, []);
  const expenses = () => load(KEY_EXPENSES, []);
  const monthlyReports = () => load(KEY_MONTHLY_REPORTS, []);

  const collectedCourse = () =>
    sum(payments().filter(p => p.status === "paid"), p => p.amount);

  const spentCourse = () =>
    sum(expenses(), e => e.amount);

  const pendingCourse = () =>
    sum(payments().filter(p => p.status === "pending"), p => p.amount);

  const collectedTask = (id) =>
    sum(payments().filter(p => p.fromTaskId === id && p.status === "paid"), p => p.amount);

  const spentTask = (id) =>
    sum(expenses().filter(e => e.scope === "campaign" && e.campaignId === id), e => e.amount);

  const expensesTask = (id) =>
    expenses().filter(e => e.scope === "campaign" && e.campaignId === id);

  const deudoresCountForTask = (id) =>
    payments().filter(p => p.fromTaskId === id && p.status === "pending").length;

  const noBoletaCount = () =>
    expenses().filter(e => !hasBoleta(e)).length;

  /* ------------------ Date helpers ------------------ */
  function todayISO() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function isExpired(t) {
    if (!t.dueDate) return false;
    const due = new Date(t.dueDate + "T23:59:59");
    if (isNaN(due.getTime())) return false;
    return due.getTime() < Date.now();
  }

  function addMonthsKeepDay(isoDateStr, monthsToAdd) {
    const d = new Date(isoDateStr + "T12:00:00");
    const target = new Date(d.getFullYear(), d.getMonth() + monthsToAdd, d.getDate(), 12, 0, 0);
    const yyyy = target.getFullYear();
    const mm = String(target.getMonth() + 1).padStart(2, "0");
    const dd = String(target.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function calcMonthlyEndDate(startISO, months) {
    const m = Number(months || 0);
    if (m <= 0) return "";
    // end = start + (months-1) months
    return addMonthsKeepDay(startISO, m - 1);
  }

  /* ------------------ Campaign groups ------------------ */
  const activeTasks = () => tasks().filter(t => !t.closed && !isExpired(t));
  const expiredTasks = () => tasks().filter(t => !t.closed && isExpired(t));
  const closedTasks = () => tasks().filter(t => !!t.closed);

  function statusChip(t) {
    if (t.closed) return `<span class="pill">Cerrada</span>`;
    if (isExpired(t)) return `<span class="pill danger">Caducada</span>`;
    return `<span class="pill ok">Activa</span>`;
  }

  function lineAccentClass(t) {
    const miss = expensesTask(t.id).filter(e => !hasBoleta(e)).length;
    const saldo = collectedTask(t.id) - spentTask(t.id);
    if (miss > 0 || saldo < 0) return "isDanger";
    if (isExpired(t) || t.closed) return "isWarn";
    return "isOk";
  }

  function negativeCampaignsCount() {
    return activeTasks().filter(t => (collectedTask(t.id) - spentTask(t.id)) < 0).length;
  }

  /* ------------------ Demo seed (if empty) ------------------ */
  function ensureDemo() {
    if (tasks().length) return;

    save(KEY_TASKS, [
      {
        id: "t1",
        title: "Rifa del curso",
        description: "",
        type: "single",
        amount: 10000,
        goalTotal: 80000,
        months: 1,
        mandatoryParticipation: true,
        startDate: "2026-01-10",
        dueDate: "2026-01-31",
        closed: false,
        closeType: "",
        closeReason: "",
        closedAt: ""
      },
      {
        id: "t2",
        title: "Paseo de curso",
        description: "",
        type: "monthly",
        amount: 20000,
        goalTotal: 200000,
        months: 3,
        mandatoryParticipation: false,
        startDate: "2026-02-01",
        dueDate: "2026-04-01",
        closed: false,
        closeType: "",
        closeReason: "",
        closedAt: ""
      }
    ]);

    save(KEY_PAYMENTS, [
      { id: "p1", fromTaskId: "t1", amount: 10000, status: "paid" },
      { id: "p2", fromTaskId: "t1", amount: 10000, status: "paid" },
      { id: "p3", fromTaskId: "t2", amount: 20000, status: "paid" },
      { id: "p4", fromTaskId: "t2", amount: 20000, status: "pending" }
    ]);

    save(KEY_EXPENSES, [
      { id: "e1", scope: "campaign", campaignId: "t1", title: "Flores", date: "2026-01-18", amount: 25000, attachments: [{ name: "boleta.jpg" }] },
      { id: "e2", scope: "campaign", campaignId: "t2", title: "Reserva", date: "2026-02-18", amount: 60000, attachments: [] }
    ]);

    save(KEY_MONTHLY_REPORTS, []);
    clearDirty();
  }

  /* ------------------ Modal ------------------ */
  function openModal(html) {
    modalRoot.innerHTML = `
      <div style="position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:10000;display:flex;align-items:flex-end;justify-content:center;padding:14px;">
        <div class="card" style="width:min(820px,100%);margin-bottom:12px;">
          ${html}
        </div>
      </div>
    `;
  }

  window.closeModal = function () { modalRoot.innerHTML = ""; };

  /* ------------------ Navigation ------------------ */
  function go(tab) {
    navItems.forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
    if (tab === "home") renderHome();
    if (tab === "campanas") renderCampanas();
    if (tab === "informes") renderInformes();
  }
  navItems.forEach(b => b.onclick = () => go(b.dataset.tab));

  /* ------------------ Home ------------------ */
  function renderHome() {
    const collected = collectedCourse();
    const spent = spentCourse();
    const saldo = collected - spent;
    const adeudado = pendingCourse();

    const sinBoleta = noBoletaCount();
    const neg = negativeCampaignsCount();

    const alerts = [];
    if (sinBoleta > 0) alerts.push(`🧾 Gastos sin boleta: ${sinBoleta}`);
    if (neg > 0) alerts.push(`🔴 Campañas con saldo negativo: ${neg}`);
    if (isDirty()) alerts.push(`📄 Informe desactualizado (requiere nuevo)`);

    app.innerHTML = `
      ${alerts.length ? `
        <div class="${(sinBoleta>0 || neg>0) ? "alertBox" : "warnBox"}">
          <div style="font-weight:950;">Alertas</div>
          <div class="muted" style="margin-top:6px;">${alerts.join(" · ")}</div>
        </div>
      ` : ""}

      <div class="card">
        <div class="row">
          <div>
            <div class="kTitle">Resumen ejecutivo del curso</div>
            <div class="muted" style="margin-top:6px;">Montos globales (no personales)</div>
          </div>
          <div class="actions">
            <button class="btnx primary" onclick="confirmGenerateReport()">📊 Generar informe</button>
          </div>
        </div>

        <div class="kpiGrid">
          <div class="kpi"><div class="lbl">Recaudado</div><div class="val">${clp(collected)}</div></div>
          <div class="kpi"><div class="lbl">Gastado</div><div class="val">${clp(spent)}</div></div>
          <div class="kpi"><div class="lbl">Saldo</div><div class="val">${clp(saldo)}</div></div>
          <div class="kpi"><div class="lbl">Adeudado</div><div class="val">${clp(adeudado)}</div></div>
        </div>

        <div style="margin-top:10px;display:flex;gap:10px;flex-wrap:wrap;">
          <span class="pill ok">Activas ${activeTasks().length}</span>
          <span class="pill">Cerradas ${closedTasks().length}</span>
          <span class="pill danger">Caducadas ${expiredTasks().length}</span>
          ${isDirty() ? `<span class="pill warn">📄 Requiere nuevo informe</span>` : ""}
        </div>
      </div>

      <div class="card">
        <div class="kTitle">Acciones clave</div>
        <div class="actions actionsKey" style="margin-top:10px;">
          <button class="btnx primary" onclick="openCreateCampaign()">➕ Crear campaña</button>
          <button class="btnx" onclick="openCloseCampaign()">🔒 Cerrar campaña</button>
          <button class="btnx primary" onclick="confirmGenerateReport()">📊 Generar informe</button>
        </div>
      </div>
    `;
  }

  /* ------------------ Campaigns (chips filter) ------------------ */
  let campaignFilter = "active"; // active | expired | closed | all

  function setFilter(f) {
    campaignFilter = f;
    renderCampanas();
  }
  window.setFilter = setFilter;

  function getFilteredTasks() {
    if (campaignFilter === "active") return activeTasks();
    if (campaignFilter === "expired") return expiredTasks();
    if (campaignFilter === "closed") return closedTasks();
    return tasks();
  }

  function renderCampanas() {
    const filtered = getFilteredTasks();

    const chips = `
      <div class="chips">
        <button class="chip ${campaignFilter==="active"?"active":""}" onclick="setFilter('active')">Activas</button>
        <button class="chip ${campaignFilter==="expired"?"active":""}" onclick="setFilter('expired')">Caducadas</button>
        <button class="chip ${campaignFilter==="closed"?"active":""}" onclick="setFilter('closed')">Cerradas</button>
        <button class="chip ${campaignFilter==="all"?"active":""}" onclick="setFilter('all')">Todas</button>
      </div>
    `;

    const list = filtered.map(t => {
      const rec = collectedTask(t.id);
      const gas = spentTask(t.id);
      const saldo = rec - gas;
      const deudores = deudoresCountForTask(t.id);
      const miss = expensesTask(t.id).filter(e => !hasBoleta(e)).length;

      const canDelete = (!t.closed && !isExpired(t));

      const closeInfo = t.closed
        ? `<div class="muted" style="margin-top:6px;font-size:12px;">
             Cierre: <b>${esc(t.closeType||"—")}</b> · Motivo: ${esc(t.closeReason||"—")}
           </div>` : "";

      return `
        <div class="lineItem ${lineAccentClass(t)}">
          <div class="row">
            <div>
              <div style="font-weight:950;">${esc(t.title)} ${statusChip(t)}</div>
              ${t.description ? `<div class="muted" style="margin-top:4px;">${esc(t.description)}</div>` : ``}
              <div class="muted" style="margin-top:6px;font-size:12px;">${esc(t.startDate||"")} → ${esc(t.dueDate||"")}</div>
              ${closeInfo}

              <div style="margin-top:8px;display:flex;gap:10px;flex-wrap:wrap;">
                <span class="pill ok">Rec ${clp(rec)}</span>
                <span class="pill warn">Gas ${clp(gas)}</span>
                <span class="pill ${saldo<0?"danger":""}">Saldo ${clp(saldo)}</span>
                <span class="pill">Deudores ${deudores}</span>
                ${miss ? `<span class="pill danger">⚠️ sin boleta ${miss}</span>` : ""}
              </div>
            </div>

            <div class="actions">
              <button class="btnx" onclick="openEditCampaign('${t.id}')">✏️ Editar</button>
              ${canDelete ? `<button class="btnx danger" onclick="deleteCampaign('${t.id}')">🗑️ Eliminar</button>` : ``}
            </div>
          </div>
        </div>
      `;
    }).join("");

    app.innerHTML = `
      <div class="card">
        <div class="row">
          <div>
            <div class="kTitle">📌 Campañas</div>
            <div class="muted" style="margin-top:6px;">Filtra por estado (chips). Eliminar solo activas.</div>
          </div>
          <div class="actions">
            <button class="btnx primary" onclick="openCreateCampaign()">➕ Crear campaña</button>
          </div>
        </div>

        ${chips}

        <div class="listLines" style="margin-top:12px;">
          ${list || `<div class="muted">Sin campañas en este filtro.</div>`}
        </div>
      </div>
    `;
  }

  /* ------------------ Reports ------------------ */
  function renderInformes() {
    const reps = monthlyReports();

    app.innerHTML = `
      ${isDirty() ? `
        <div class="warnBox">
          <div style="font-weight:950;">Informe desactualizado</div>
          <div class="muted" style="margin-top:6px;">Se detectaron cambios. Debes generar uno nuevo.</div>
          <div class="actions" style="margin-top:10px;">
            <button class="btnx primary" onclick="confirmGenerateReport()">Actualizar informe</button>
          </div>
        </div>
      ` : ""}

      <div class="card">
        <div class="kTitle">📄 Informes mensuales</div>
        <div class="muted" style="margin-top:6px;">Historial (demo). Snapshots del curso.</div>

        <div class="actions" style="margin-top:10px;">
          <button class="btnx primary" onclick="confirmGenerateReport()">Generar informe mensual</button>
        </div>

        <div class="listLines" style="margin-top:12px;">
          ${reps.length
            ? reps.map(r=>`<div class="lineItem"><b>${esc(r.period)}</b> · Emitido ${esc(r.generatedAt)}</div>`).join("")
            : `<div class="muted">Sin informes generados.</div>`}
        </div>
      </div>
    `;
  }

  window.confirmGenerateReport = function () {
    if (!confirm("¿Generar / actualizar informe mensual?")) return;
    generateMonthly();
  };

  function generateMonthly() {
    const period = prompt("Mes (YYYY-MM)", "2026-01");
    if (!period) return;
    if (!/^\d{4}-\d{2}$/.test(period)) { alert("Formato inválido (YYYY-MM)"); return; }

    const rep = {
      id: uid("repM"),
      period,
      generatedAt: new Date().toLocaleString("es-CL"),
      recaudadoCurso: collectedCourse(),
      gastadoCurso: spentCourse(),
      disponibleCurso: collectedCourse() - spentCourse(),
      adeudadoCurso: pendingCourse()
    };

    const reps = monthlyReports();
    reps.unshift(rep);
    save(KEY_MONTHLY_REPORTS, reps);
    clearDirty();

    alert("Informe generado ✅");
    renderInformes();
  }

  /* ------------------ Create Campaign ------------------ */
  window.openCreateCampaign = function () {
    const defaultStart = todayISO();

    openModal(`
      <div class="row">
        <div>
          <div style="font-weight:950;font-size:18px;">Crear campaña</div>
          <div class="muted" style="margin-top:6px;">Mensual: fin se calcula según cuotas.</div>
        </div>
        <button class="btnx" onclick="closeModal()">Cerrar</button>
      </div>

      <div style="margin-top:12px;">
        <label style="font-weight:900;">Nombre campaña</label>
        <input id="cc_title" placeholder="Ej: Cuota paseo" />
      </div>

      <div style="margin-top:12px;">
        <label style="font-weight:900;">Descripción (opcional)</label>
        <input id="cc_desc" placeholder="Ej: Transporte y entradas" />
      </div>

      <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;">
        <div style="flex:1;min-width:140px;">
          <label style="font-weight:900;">Tipo</label>
          <select id="cc_type">
            <option value="single">Pago único</option>
            <option value="monthly">Mensual</option>
          </select>
        </div>
        <div style="flex:1;min-width:140px;">
          <label style="font-weight:900;">Participación</label>
          <select id="cc_mandatory">
            <option value="true">Obligatoria</option>
            <option value="false">No obligatoria</option>
          </select>
        </div>
      </div>

      <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;">
        <div style="flex:1;min-width:140px;">
          <label style="font-weight:900;">Monto (obligatorio)</label>
          <input id="cc_amount" inputmode="numeric" placeholder="Ej: 5000" />
        </div>
        <div style="flex:1;min-width:140px;">
          <label style="font-weight:900;">Meta total (opcional)</label>
          <input id="cc_goal" inputmode="numeric" placeholder="Ej: 150000" />
        </div>
      </div>

      <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;">
        <div style="flex:1;min-width:140px;">
          <label style="font-weight:900;">Inicio</label>
          <input id="cc_start" type="date" value="${defaultStart}" />
        </div>
        <div style="flex:1;min-width:140px;">
          <label style="font-weight:900;">Fin</label>
          <input id="cc_due" type="date" />
          <div class="muted" style="margin-top:6px;font-size:12px;">(Mensual: se calcula automáticamente)</div>
        </div>
      </div>

      <div style="margin-top:12px;">
        <label style="font-weight:900;">Cuotas / Meses (solo mensual)</label>
        <input id="cc_months" inputmode="numeric" placeholder="Ej: 3" />
      </div>

      <div class="actions" style="margin-top:14px;justify-content:flex-end;">
        <button class="btnx" onclick="closeModal()">Cancelar</button>
        <button class="btnx primary" onclick="saveCreateCampaign()">Crear</button>
      </div>
    `);

    const typeEl = document.getElementById("cc_type");
    const startEl = document.getElementById("cc_start");
    const dueEl = document.getElementById("cc_due");
    const monthsEl = document.getElementById("cc_months");

    function syncMonthly() {
      const type = typeEl.value;
      const start = startEl.value || todayISO();
      const months = Number(monthsEl.value || 0);

      if (type === "monthly") {
        dueEl.disabled = true;
        const end = calcMonthlyEndDate(start, months > 0 ? months : 0);
        dueEl.value = end || "";
      } else {
        dueEl.disabled = false;
      }
    }

    typeEl.onchange = syncMonthly;
    startEl.onchange = syncMonthly;
    monthsEl.oninput = syncMonthly;
    syncMonthly();
  };

  window.saveCreateCampaign = function () {
    const title = (document.getElementById("cc_title").value || "").trim();
    const desc = (document.getElementById("cc_desc").value || "").trim();
    const type = document.getElementById("cc_type").value || "single";
    const mandatoryParticipation = document.getElementById("cc_mandatory").value === "true";

    const amount = Number(document.getElementById("cc_amount").value || 0);
    const goalTotal = Number(document.getElementById("cc_goal").value || 0);

    let startDate = document.getElementById("cc_start").value || todayISO();
    let dueDate = document.getElementById("cc_due").value || "";
    let months = Number(document.getElementById("cc_months").value || 0);

    if (!title) { alert("Debes ingresar un nombre."); return; }
    if (!amount || amount <= 0) { alert("Debes ingresar un monto válido."); return; }

    if (type === "monthly") {
      if (!months || months <= 0) { alert("Si es mensual, indica cuotas/meses."); return; }
      dueDate = calcMonthlyEndDate(startDate, months);
      if (!dueDate) { alert("No se pudo calcular la fecha fin."); return; }
    } else {
      months = 1;
      if (!dueDate) { alert("Debes seleccionar una fecha fin."); return; }
    }

    const ts = tasks();
    ts.unshift({
      id: uid("t"),
      title,
      description: desc,
      type,
      amount,
      goalTotal: goalTotal > 0 ? goalTotal : null,
      months,
      mandatoryParticipation,
      startDate,
      dueDate,
      closed: false,
      closeType: "",
      closeReason: "",
      closedAt: ""
    });

    save(KEY_TASKS, ts);
    markDirty();
    closeModal();

    alert("Campaña creada ✅");
    renderCampanas();
  };

  /* ------------------ Edit Campaign ------------------ */
  window.openEditCampaign = function (taskId) {
    const ts = tasks();
    const t = ts.find(x => x.id === taskId);
    if (!t) return;

    openModal(`
      <div class="row">
        <div>
          <div style="font-weight:950;font-size:18px;">Editar campaña</div>
          <div class="muted" style="margin-top:6px;">Mensual: fin se recalcula según cuotas.</div>
        </div>
        <button class="btnx" onclick="closeModal()">Cerrar</button>
      </div>

      <div style="margin-top:12px;">
        <label style="font-weight:900;">Nombre</label>
        <input id="ec_title" value="${esc(t.title)}" />
      </div>

      <div style="margin-top:12px;">
        <label style="font-weight:900;">Descripción</label>
        <input id="ec_desc" value="${esc(t.description || "")}" />
      </div>

      <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;">
        <div style="flex:1;min-width:140px;">
          <label style="font-weight:900;">Tipo</label>
          <select id="ec_type">
            <option value="single" ${t.type === "single" ? "selected" : ""}>Pago único</option>
            <option value="monthly" ${t.type === "monthly" ? "selected" : ""}>Mensual</option>
          </select>
        </div>

        <div style="flex:1;min-width:140px;">
          <label style="font-weight:900;">Participación</label>
          <select id="ec_mandatory">
            <option value="true" ${t.mandatoryParticipation ? "selected" : ""}>Obligatoria</option>
            <option value="false" ${!t.mandatoryParticipation ? "selected" : ""}>No obligatoria</option>
          </select>
        </div>
      </div>

      <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;">
        <div style="flex:1;min-width:140px;">
          <label style="font-weight:900;">Monto</label>
          <input id="ec_amount" inputmode="numeric" value="${Number(t.amount || 0)}" />
        </div>
        <div style="flex:1;min-width:140px;">
          <label style="font-weight:900;">Meta total</label>
          <input id="ec_goal" inputmode="numeric" value="${Number(t.goalTotal || 0)}" />
        </div>
      </div>

      <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;">
        <div style="flex:1;min-width:140px;">
          <label style="font-weight:900;">Inicio</label>
          <input id="ec_start" type="date" value="${esc(t.startDate || todayISO())}" />
        </div>
        <div style="flex:1;min-width:140px;">
          <label style="font-weight:900;">Fin</label>
          <input id="ec_due" type="date" value="${esc(t.dueDate || "")}" />
          <div class="muted" style="margin-top:6px;font-size:12px;">(Mensual: se calcula automáticamente)</div>
        </div>
      </div>

      <div style="margin-top:12px;">
        <label style="font-weight:900;">Cuotas / Meses (solo mensual)</label>
        <input id="ec_months" inputmode="numeric" value="${Number(t.months || 1)}" />
      </div>

      <div class="actions" style="margin-top:14px;justify-content:flex-end;">
        <button class="btnx" onclick="closeModal()">Cancelar</button>
        <button class="btnx primary" onclick="saveEditCampaign('${t.id}')">Guardar</button>
      </div>
    `);

    const typeEl = document.getElementById("ec_type");
    const startEl = document.getElementById("ec_start");
    const dueEl = document.getElementById("ec_due");
    const monthsEl = document.getElementById("ec_months");

    function sync() {
      const type = typeEl.value;
      const start = startEl.value || todayISO();
      const months = Number(monthsEl.value || 0);

      if (type === "monthly") {
        dueEl.disabled = true;
        const end = calcMonthlyEndDate(start, months > 0 ? months : 0);
        dueEl.value = end || "";
      } else {
        dueEl.disabled = false;
      }
    }
    typeEl.onchange = sync;
    startEl.onchange = sync;
    monthsEl.oninput = sync;
    sync();
  };

  window.saveEditCampaign = function (taskId) {
    const ts = tasks();
    const i = ts.findIndex(x => x.id === taskId);
    if (i < 0) return;

    const type = document.getElementById("ec_type").value || ts[i].type;
    const startDate = document.getElementById("ec_start").value || ts[i].startDate;
    let dueDate = document.getElementById("ec_due").value || ts[i].dueDate;
    let months = Number(document.getElementById("ec_months").value || ts[i].months || 1);

    const amount = Number(document.getElementById("ec_amount").value || 0);
    const goal = Number(document.getElementById("ec_goal").value || 0);

    if (!amount || amount <= 0) { alert("Monto inválido."); return; }

    if (type === "monthly") {
      if (!months || months <= 0) { alert("Si es mensual, indica cuotas/meses."); return; }
      dueDate = calcMonthlyEndDate(startDate, months);
      if (!dueDate) { alert("No se pudo calcular la fecha fin."); return; }
    } else {
      months = 1;
      if (!dueDate) { alert("Debes seleccionar una fecha fin."); return; }
    }

    ts[i].title = (document.getElementById("ec_title").value || "").trim() || ts[i].title;
    ts[i].description = (document.getElementById("ec_desc").value || "").trim();
    ts[i].type = type;
    ts[i].mandatoryParticipation = document.getElementById("ec_mandatory").value === "true";
    ts[i].amount = amount;
    ts[i].goalTotal = goal > 0 ? goal : null;
    ts[i].startDate = startDate;
    ts[i].dueDate = dueDate;
    ts[i].months = months;

    save(KEY_TASKS, ts);
    markDirty();
    closeModal();

    alert("Campaña actualizada ✅");
    renderCampanas();
  };

  /* ------------------ Close Campaign ------------------ */
  window.openCloseCampaign = function () {
    const list = activeTasks();
    if (!list.length) { alert("No hay campañas activas para cerrar."); return; }

    openModal(`
      <div class="row">
        <div>
          <div style="font-weight:950;font-size:18px;">Cerrar campaña</div>
          <div class="muted" style="margin-top:6px;">Indica tipo y motivo (obligatorio).</div>
        </div>
        <button class="btnx" onclick="closeModal()">Cerrar</button>
      </div>

      <div style="margin-top:12px;">
        <label style="font-weight:900;">Campaña</label>
        <select id="cl_task">
          ${list.map(t => `<option value="${t.id}">${esc(t.title)}</option>`).join("")}
        </select>
      </div>

      <div style="margin-top:12px;">
        <label style="font-weight:900;">Tipo de cierre</label>
        <select id="cl_type">
          <option value="Meta cumplida">Meta cumplida</option>
          <option value="Cancelada">Cancelada</option>
          <option value="Manual">Manual</option>
          <option value="Otro">Otro</option>
        </select>
      </div>

      <div style="margin-top:12px;">
        <label style="font-weight:900;">Motivo de cierre</label>
        <input id="cl_reason" placeholder="Ej: Actividad cancelada / Cambio de plan" />
      </div>

      <div class="actions" style="margin-top:14px;justify-content:flex-end;">
        <button class="btnx" onclick="closeModal()">Cancelar</button>
        <button class="btnx primary" onclick="saveCloseCampaign()">Cerrar campaña</button>
      </div>
    `);
  };

  window.saveCloseCampaign = function () {
    const taskId = document.getElementById("cl_task").value;
    const closeType = document.getElementById("cl_type").value;
    const closeReason = (document.getElementById("cl_reason").value || "").trim();

    if (!closeReason) { alert("Debes ingresar el motivo de cierre."); return; }

    const ts = tasks();
    const i = ts.findIndex(x => x.id === taskId);
    if (i < 0) return;

    ts[i].closed = true;
    ts[i].closeType = closeType;
    ts[i].closeReason = closeReason;
    ts[i].closedAt = new Date().toISOString();

    save(KEY_TASKS, ts);
    markDirty();
    closeModal();

    alert("Campaña cerrada ✅");
    renderCampanas();
  };

  /* ------------------ Delete Campaign (only active) ------------------ */
  window.deleteCampaign = function (taskId) {
    const t = tasks().find(x => x.id === taskId);
    if (!t) return;

    if (t.closed) { alert("No se puede eliminar una campaña cerrada."); return; }
    if (isExpired(t)) { alert("No se puede eliminar una campaña caducada."); return; }

    const msg =
`¿Eliminar la campaña "${t.title}"?

• La campaña se elimina del sistema.
• Los pagos NO se borran: quedan como saldo a favor.
• Se eliminan rendiciones asociadas.
• Requiere nuevo informe.`;

    if (!confirm(msg)) return;

    // Remove campaign
    save(KEY_TASKS, tasks().filter(x => x.id !== taskId));

    // Remove expenses associated
    save(KEY_EXPENSES, expenses().filter(e => !(e.scope === "campaign" && e.campaignId === taskId)));

    // Convert paid payments to credit (keep payments)
    const ps = payments().map(p => {
      if (p.fromTaskId === taskId && p.status === "paid") {
        return {
          ...p,
          status: "credit",
          creditFromTaskId: taskId,
          note: "Saldo a favor por campaña eliminada"
        };
      }
      return p;
    });
    save(KEY_PAYMENTS, ps);

    markDirty();
    alert("Campaña eliminada ✅. Pagos convertidos a saldo a favor.");
    renderCampanas();
  };

  /* ------------------ Menu ------------------ */
  function initMenu() {
    if (menuBtn && menuDropdown) {
      menuBtn.onclick = (e) => {
        e.stopPropagation();
        menuDropdown.style.display =
          menuDropdown.style.display === "block" ? "none" : "block";
      };
      document.addEventListener("click", () => (menuDropdown.style.display = "none"));
    }

    if (resetBtn) {
      resetBtn.onclick = () => {
        if (!confirm("Reset demo presidente. ¿Continuar?")) return;
        localStorage.removeItem(KEY_TASKS);
        localStorage.removeItem(KEY_PAYMENTS);
        localStorage.removeItem(KEY_EXPENSES);
        localStorage.removeItem(KEY_MONTHLY_REPORTS);
        localStorage.removeItem(KEY_DIRTY);
        alert("Datos reseteados.");
        ensureDemo();
        go("home");
      };
    }

    if (logoutBtn) {
      logoutBtn.onclick = () => (location.href = "login.html");
    }
  }

  /* ------------------ Boot ------------------ */
  ensureDemo();
  initMenu();
  go("home");

})();
