/* =========================================================
   Cursapp · Presidente (vista aislada)
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

  /* ------------------ Storage keys (auto) ------------------ */
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

  const activeTasks = () => tasks().filter(t => !t.closed);
  const closedTasks = () => tasks().filter(t => t.closed);

  const collectedTask = (id) =>
    sum(payments().filter(p => p.status === "paid" && p.fromTaskId === id), p => p.amount);

  const spentTask = (id) =>
    sum(expenses().filter(e => e.scope === "campaign" && e.campaignId === id), e => e.amount);

  const collectedCourse = () =>
    sum(payments().filter(p => p.status === "paid"), p => p.amount);

  const spentCourse = () =>
    sum(expenses(), e => e.amount);

  const pendingCourse = () =>
    sum(payments().filter(p => p.status === "pending"), p => p.amount);

  /* ------------------ UI helpers ------------------ */
  function openModal(html) {
    modalRoot.innerHTML = `
      <div style="position:fixed;inset:0;background:rgba(15,23,42,.45);
           z-index:10000;display:flex;align-items:flex-end;justify-content:center;padding:14px;">
        <div class="card" style="width:min(820px,100%);margin-bottom:12px;">
          ${html}
        </div>
      </div>`;
  }
  function closeModal() { modalRoot.innerHTML = ""; }

  /* ------------------ Render: Home ------------------ */
  function renderHome() {
    const alerts = [];
    if (expenses().some(e => !hasBoleta(e))) alerts.push("🧾 Gastos sin boleta");
    if (isDirty()) alerts.push("📄 Informe desactualizado");

    app.innerHTML = `
      ${alerts.length ? `
        <div class="alertBox">
          <b>Alertas</b>
          <div class="muted">${alerts.join(" · ")}</div>
        </div>` : ""}

      <div class="card">
        <div class="row">
          <div>
            <div class="kTitle">Resumen ejecutivo del curso</div>
            <div class="muted">Montos globales (no personales)</div>
          </div>
          <button class="btnx primary" onclick="confirmGenerateReport()">📊 Generar informe</button>
        </div>

        <div class="kpiGrid">
          <div class="kpi"><div class="lbl">Recaudado</div><div class="val">${clp(collectedCourse())}</div></div>
          <div class="kpi"><div class="lbl">Gastado</div><div class="val">${clp(spentCourse())}</div></div>
          <div class="kpi"><div class="lbl">Saldo</div><div class="val">${clp(collectedCourse() - spentCourse())}</div></div>
          <div class="kpi"><div class="lbl">Adeudado</div><div class="val">${clp(pendingCourse())}</div></div>
        </div>
      </div>`;
  }

  /* ------------------ Render: Campañas ------------------ */
  function renderCampanas() {
    app.innerHTML = `
      <div class="card">
        <div class="kTitle">Campañas activas</div>
        <div class="listLines">
          ${activeTasks().map(t => {
            const saldo = collectedTask(t.id) - spentTask(t.id);
            return `
              <div class="lineItem">
                <div class="row">
                  <div>
                    <b>${esc(t.title)}</b>
                    <div class="muted">${t.startDate || ""} → ${t.dueDate || ""}</div>
                    <div class="pill ${saldo < 0 ? "danger" : "ok"}">Saldo ${clp(saldo)}</div>
                  </div>
                  <div class="actions">
                    <button class="btnx" onclick="openEditCampaign('${t.id}')">✏️ Editar</button>
                    <button class="btnx" onclick="deleteCampaign('${t.id}')">🗑️ Eliminar</button>
                  </div>
                </div>
              </div>`;
          }).join("")}
        </div>
      </div>`;
  }

  /* ------------------ Edit campaign ------------------ */
  window.openEditCampaign = function (taskId) {
    const t = tasks().find(x => x.id === taskId);
    if (!t) return;

    openModal(`
      <h3>Editar campaña</h3>
      <input id="ec_title" value="${esc(t.title)}"/>
      <div class="actions">
        <button class="btnx" onclick="closeModal()">Cancelar</button>
        <button class="btnx primary" onclick="saveEditCampaign('${taskId}')">Guardar</button>
      </div>`);
  };

  window.saveEditCampaign = function (taskId) {
    const ts = tasks();
    const i = ts.findIndex(x => x.id === taskId);
    ts[i].title = document.getElementById("ec_title").value || ts[i].title;
    save(KEY_TASKS, ts);
    markDirty();
    closeModal();
    renderCampanas();
  };

  /* ------------------ Delete campaign (RULES) ------------------ */
  window.deleteCampaign = function (taskId) {
    const t = tasks().find(x => x.id === taskId);
    if (!t) return;

    // ❌ no cerradas
    if (t.closed) {
      alert("No se puede eliminar una campaña cerrada.");
      return;
    }

    // ❌ no caducadas
    if (t.dueDate) {
      const due = new Date(t.dueDate + "T23:59:59");
      if (due < new Date()) {
        alert("No se puede eliminar una campaña caducada.");
        return;
      }
    }

    if (!confirm(`¿Eliminar campaña "${t.title}"?\n\nLos pagos quedarán como saldo a favor.`)) return;

    // 1) eliminar campaña
    save(KEY_TASKS, tasks().filter(x => x.id !== taskId));

    // 2) eliminar gastos asociados
    save(KEY_EXPENSES,
      expenses().filter(e => !(e.scope === "campaign" && e.campaignId === taskId))
    );

    // 3) pagos → saldo a favor
    const newPayments = payments().map(p => {
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
    save(KEY_PAYMENTS, newPayments);

    markDirty();
    alert("Campaña eliminada. Pagos convertidos a saldo a favor.");
    renderCampanas();
  };

  /* ------------------ Informes ------------------ */
  window.confirmGenerateReport = function () {
    if (!confirm("¿Generar / actualizar informe mensual?")) return;
    const period = prompt("Periodo (YYYY-MM)");
    if (!period) return;
    const reps = load(KEY_MONTHLY_REPORTS, []);
    reps.unshift({ id: uid("rep"), period, generatedAt: new Date().toLocaleString("es-CL") });
    save(KEY_MONTHLY_REPORTS, reps);
    clearDirty();
    alert("Informe generado");
  };

  /* ------------------ Menu + Nav ------------------ */
  menuBtn.onclick = e => {
    e.stopPropagation();
    menuDropdown.style.display =
      menuDropdown.style.display === "block" ? "none" : "block";
  };
  document.addEventListener("click", () => (menuDropdown.style.display = "none"));
  resetBtn.onclick = () => { localStorage.clear(); location.reload(); };
  logoutBtn.onclick = () => (location.href = "login.html");

  navItems.forEach(b => b.onclick = () => {
    navItems.forEach(x => x.classList.remove("active"));
    b.classList.add("active");
    if (b.dataset.tab === "home") renderHome();
    if (b.dataset.tab === "campanas") renderCampanas();
  });

  /* ------------------ Boot ------------------ */
  renderHome();

})();
