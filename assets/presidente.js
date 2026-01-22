/* =========================================================
   Cursapp · Presidente (vista aislada) — COMPLETO
   - Alertas fuertes
   - Campañas (editar + eliminar con reglas)
   - Informes (generar/actualizar + historial)
   - “Requiere nuevo informe” si hay cambios
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

  /* ------------------ Storage keys (auto detect) ------------------ */
  function detectKey(candidates) {
    for (const k of candidates) if (localStorage.getItem(k) != null) return k;
    return "";
  }

  const KEY_TASKS =
    detectKey(["cursapp_tasks_v1", "tasks", "campanas"]) || "cursapp_tasks_v1";
  const KEY_PAYMENTS =
    detectKey(["cursapp_payments_v1", "payments", "pagos"]) || "cursapp_payments_v1";
  const KEY_EXPENSES =
    detectKey(["cursapp_expenses_v1", "expenses", "gastos", "rendiciones"]) || "cursapp_expenses_v1";
  const KEY_MONTHLY_REPORTS =
    detectKey(["cursapp_monthly_reports_v1", "monthly_reports"]) || "cursapp_monthly_reports_v1";
  const KEY_DIRTY =
    detectKey(["cursapp_reports_dirty_v1", "reportsDirty"]) || "cursapp_reports_dirty_v1";

  const load = (k, def) => {
    try { return JSON.parse(localStorage.getItem(k) || JSON.stringify(def)); }
    catch { return def; }
  };
  const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));

  const markDirty = () => localStorage.setItem(KEY_DIRTY, "1");
  const clearDirty = () => localStorage.removeItem(KEY_DIRTY);
  const isDirty = () => localStorage.getItem(KEY_DIRTY) === "1";

  const sum = (arr, fn) =>
    (arr || []).reduce((a, x) => a + Number(fn ? fn(x) : x || 0), 0);

  const hasBoleta = (e) =>
    (Array.isArray(e.attachments) && e.attachments.length) ||
    e.receipt || e.boleta === true;

  /* ------------------ Data selectors ------------------ */
  const tasks = () => load(KEY_TASKS, []);
  const payments = () => load(KEY_PAYMENTS, []);
  const expenses = () => load(KEY_EXPENSES, []);
  const monthlyReports = () => load(KEY_MONTHLY_REPORTS, []);

  const activeTasks = () => tasks().filter(t => !t.closed);
  const closedTasks = () => tasks().filter(t => t.closed);

  const collectedCourse = () =>
    sum(payments().filter(p => p.status === "paid"), p => p.amount);

  const spentCourse = () =>
    sum(expenses(), e => e.amount);

  const pendingCourse = () =>
    sum(payments().filter(p => p.status === "pending"), p => p.amount);

  const collectedTask = (id) =>
    sum(payments().filter(p => p.status === "paid" && p.fromTaskId === id), p => p.amount);

  const spentTask = (id) =>
    sum(expenses().filter(e => e.scope === "campaign" && e.campaignId === id), e => e.amount);

  const expensesTask = (id) =>
    expenses().filter(e => e.scope === "campaign" && e.campaignId === id);

  const noBoletaCount = () => expenses().filter(e => !hasBoleta(e)).length;

  const negativeCampaignsCount = () =>
    activeTasks().filter(t => (collectedTask(t.id) - spentTask(t.id)) < 0).length;

  const deudoresCountForTask = (id) =>
    payments().filter(p => p.fromTaskId === id && p.status === "pending").length;

  /* ------------------ Demo seed (if empty) ------------------ */
  function ensureDemo() {
    if (tasks().length) return;

    save(KEY_TASKS, [
      { id: "t1", title: "Rifa del curso", startDate: "2026-01-10", dueDate: "2026-01-31", closed: false, mandatoryParticipation: true, type: "single" },
      { id: "t2", title: "Paseo de curso", startDate: "2026-01-01", dueDate: "2026-03-31", closed: false, mandatoryParticipation: false, type: "monthly" },
    ]);

    save(KEY_PAYMENTS, [
      { id: "p1", fromTaskId: "t1", amount: 10000, status: "paid" },
      { id: "p2", fromTaskId: "t1", amount: 10000, status: "paid" },
      { id: "p3", fromTaskId: "t2", amount: 20000, status: "paid" },
      { id: "p4", fromTaskId: "t2", amount: 20000, status: "pending" },
    ]);

    save(KEY_EXPENSES, [
      { id: "e1", scope: "campaign", campaignId: "t1", title: "Flores", date: "2026-01-18", amount: 25000, attachments: [{ name: "boleta.jpg" }] },
      { id: "e2", scope: "campaign", campaignId: "t2", title: "Reserva", date: "2026-01-18", amount: 60000, attachments: [] },
    ]);

    save(KEY_MONTHLY_REPORTS, []);
    clearDirty();
  }

  /* ------------------ Modal helpers ------------------ */
  function openModal(html) {
    modalRoot.innerHTML = `
      <div style="position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:10000;display:flex;align-items:flex-end;justify-content:center;padding:14px;">
        <div class="card" style="width:min(820px,100%);margin-bottom:12px;">
          ${html}
        </div>
      </div>`;
  }
  function closeModal() { modalRoot.innerHTML = ""; }

  /* ------------------ Render: Home ------------------ */
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
          <span class="pill">📌 Activas ${activeTasks().length}</span>
          <span class="pill">✅ Cerradas ${closedTasks().length}</span>
          ${isDirty() ? `<span class="pill warn">📄 Requiere nuevo informe</span>` : ""}
        </div>
      </div>
    `;
  }

  /* ------------------ Render: Campañas ------------------ */
  function renderCampanas() {
    const list = activeTasks().map(t => {
      const rec = collectedTask(t.id);
      const gas = spentTask(t.id);
      const saldo = rec - gas;
      const deudores = deudoresCountForTask(t.id);
      const miss = expensesTask(t.id).filter(e=>!hasBoleta(e)).length;

      return `
        <div class="lineItem">
          <div class="row">
            <div>
              <div style="font-weight:950;">${esc(t.title)}</div>
              <div class="muted" style="margin-top:6px;font-size:12px;">${t.startDate||""} → ${t.dueDate||""}</div>

              <div style="margin-top:8px;display:flex;gap:10px;flex-wrap:wrap;">
                <span class="pill ok">Rec ${clp(rec)}</span>
                <span class="pill warn">Gas ${clp(gas)}</span>
                <span class="pill ${saldo<0?"danger":""}">Saldo ${clp(saldo)}</span>
                <span class="pill">Deudores ${deudores}</span>
                ${miss?`<span class="pill danger">⚠️ sin boleta ${miss}</span>`:""}
              </div>
            </div>

            <div class="actions">
              <button class="btnx" onclick="openEditCampaign('${t.id}')">✏️ Editar</button>
              <button class="btnx" onclick="deleteCampaign('${t.id}')">🗑️ Eliminar</button>
            </div>
          </div>
        </div>
      `;
    }).join("");

    app.innerHTML = `
      <div class="card">
        <div class="kTitle">📌 Campañas activas</div>
        <div class="muted" style="margin-top:6px;">Se pueden eliminar solo campañas activas. Las caducadas o cerradas no se eliminan.</div>
        <div class="listLines" style="margin-top:12px;">
          ${list || `<div class="muted">Sin campañas activas.</div>`}
        </div>
      </div>
    `;
  }

  /* ------------------ Render: Informes ------------------ */
  function renderInformes() {
    const reps = monthlyReports();

    app.innerHTML = `
      ${isDirty() ? `
        <div class="warnBox">
          <div style="font-weight:950;">Informe desactualizado</div>
          <div class="muted" style="margin-top:6px;">
            Se detectaron cambios posteriores al último informe. Debes generar uno nuevo.
          </div>
          <div class="actions" style="margin-top:10px;">
            <button class="btnx primary" onclick="confirmGenerateReport()">Actualizar informe</button>
          </div>
        </div>
      ` : ""}

      <div class="card">
        <div class="kTitle">📄 Informes mensuales</div>
        <div class="muted" style="margin-top:6px;">Historial (demo). Los informes son snapshots del curso.</div>

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

  /* ------------------ Editar campaña ------------------ */
  window.openEditCampaign = function(taskId){
    const ts = tasks();
    const t = ts.find(x=>x.id===taskId);
    if(!t) return;

    openModal(`
      <div class="row">
        <div>
          <div style="font-weight:950;font-size:18px;">Editar campaña</div>
          <div class="muted" style="margin-top:6px;">Este cambio marcará “Requiere nuevo informe”.</div>
        </div>
        <button class="btnx" onclick="closeModal()">Cerrar</button>
      </div>

      <div style="margin-top:12px;">
        <label style="font-weight:900;">Nombre</label>
        <input id="ec_title" value="${esc(t.title)}" />
      </div>

      <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;">
        <div style="flex:1;min-width:140px;">
          <label style="font-weight:900;">Inicio</label>
          <input id="ec_start" type="date" value="${t.startDate||""}" />
        </div>
        <div style="flex:1;min-width:140px;">
          <label style="font-weight:900;">Fin</label>
          <input id="ec_due" type="date" value="${t.dueDate||""}" />
        </div>
      </div>

      <div class="actions" style="margin-top:14px;justify-content:flex-end;">
        <button class="btnx" onclick="closeModal()">Cancelar</button>
        <button class="btnx primary" onclick="saveEditCampaign('${taskId}')">Guardar</button>
      </div>
    `);
  }

  window.saveEditCampaign = function(taskId){
    const ts = tasks();
    const i = ts.findIndex(x=>x.id===taskId);
    if(i<0) return;

    ts[i].title = (document.getElementById("ec_title").value||"").trim() || ts[i].title;
    ts[i].startDate = document.getElementById("ec_start").value || ts[i].startDate;
    ts[i].dueDate = document.getElementById("ec_due").value || ts[i].dueDate;

    save(KEY_TASKS, ts);
    markDirty();
    closeModal();
    renderCampanas();
  }

  /* ------------------ Eliminar campaña (reglas) ------------------ */
  window.deleteCampaign = function(taskId){
    const t = tasks().find(x=>x.id===taskId);
    if(!t) return;

    // ❌ no cerradas
    if(t.closed){
      alert("No se puede eliminar una campaña cerrada.");
      return;
    }

    // ❌ no caducadas (vencidas)
    if(t.dueDate){
      const due = new Date(t.dueDate + "T23:59:59");
      if(!isNaN(due.getTime()) && due.getTime() < Date.now()){
        alert("No se puede eliminar una campaña caducada (vencida).");
        return;
      }
    }

    const msg =
`¿Eliminar la campaña "${t.title}"?

• La campaña se elimina del sistema.
• Los pagos NO se borran: quedarán como saldo a favor de apoderados que pagaron.
• Se eliminarán las rendiciones asociadas.
• Esto marcará "Requiere nuevo informe".`;

    if(!confirm(msg)) return;

    // 1) eliminar campaña
    save(KEY_TASKS, tasks().filter(x=>x.id!==taskId));

    // 2) eliminar gastos asociados a esa campaña
    save(KEY_EXPENSES,
      expenses().filter(e => !(e.scope==="campaign" && e.campaignId===taskId))
    );

    // 3) pagos pagados -> saldo a favor (NO se borran)
    const ps = payments().map(p=>{
      if(p.fromTaskId === taskId && p.status === "paid"){
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
  }

  /* ------------------ Generar informe ------------------ */
  window.confirmGenerateReport = function(){
    if(!confirm("¿Generar / actualizar informe mensual?")) return;
    generateMonthly();
  }

  function generateMonthly(){
    const period = prompt("Mes (YYYY-MM)", "2026-01");
    if(!period) return;
    if(!/^\d{4}-\d{2}$/.test(period)){ alert("Formato inválido (YYYY-MM)"); return; }

    const rep = {
      id: uid("repM"),
      period,
      generatedAt: new Date().toLocaleString("es-CL"),
      recaudadoCurso: collectedCourse(),
      gastadoCurso: spentCourse(),
      disponibleCurso: collectedCourse()-spentCourse(),
      adeudadoCurso: pendingCourse()
    };

    const reps = monthlyReports();
    reps.unshift(rep);
    save(KEY_MONTHLY_REPORTS, reps);
    clearDirty();

    alert("Informe generado ✅");
    renderInformes();
  }

  /* ------------------ Menu + Nav ------------------ */
  function initMenu(){
    if(menuBtn && menuDropdown){
      menuBtn.onclick=(e)=>{e.stopPropagation(); menuDropdown.style.display=(menuDropdown.style.display==="block"?"none":"block");};
      document.addEventListener("click",()=> menuDropdown.style.display="none");
    }
    if(resetBtn){
      resetBtn.onclick=()=>{
        if(!confirm("Reset demo presidente. ¿Continuar?")) return;
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
    if(logoutBtn){
      logoutBtn.onclick=()=> location.href="login.html";
    }
  }

  function setActive(tab){
    navItems.forEach(b=> b.classList.toggle("active", b.dataset.tab===tab));
  }

  function go(tab){
    setActive(tab);
    if(tab==="home") renderHome();
    if(tab==="campanas") renderCampanas();
    if(tab==="informes") renderInformes();
  }

  navItems.forEach(b=> b.onclick=()=> go(b.dataset.tab));

  /* ------------------ Boot ------------------ */
  ensureDemo();
  initMenu();
  go("home");

})();
