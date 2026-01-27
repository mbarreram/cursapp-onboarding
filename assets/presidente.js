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

  // storage keys
  const KEY_TASKS = detectKey(["cursapp_tasks_v1", "tasks", "campanas"]) || "cursapp_tasks_v1";
  const KEY_PAYMENTS = detectKey(["cursapp_payments_v1", "payments", "pagos"]) || "cursapp_payments_v1";
  const KEY_EXPENSES = detectKey(["cursapp_expenses_v1", "expenses", "gastos", "rendiciones"]) || "cursapp_expenses_v1";
  const KEY_MONTHLY_REPORTS = detectKey(["cursapp_monthly_reports_v1"]) || "cursapp_monthly_reports_v1";
  const KEY_DIRTY = detectKey(["cursapp_reports_dirty_v1"]) || "cursapp_reports_dirty_v1";

  const load = (k, def) => {
    try { return JSON.parse(localStorage.getItem(k) || JSON.stringify(def)); }
    catch { return def; }
  };
  const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));

  const markDirty = () => localStorage.setItem(KEY_DIRTY, "1");
  const clearDirty = () => localStorage.removeItem(KEY_DIRTY);
  const isDirty = () => localStorage.getItem(KEY_DIRTY) === "1";

  const sum = (arr, fn) => (arr || []).reduce((a, x) => a + Number(fn ? fn(x) : x || 0), 0);

  function isExpired(t){
    if(!t.dueDate) return false;
    const due = new Date(t.dueDate + "T23:59:59");
    return due.getTime() < Date.now();
  }

  const isPaid = (p) => p.status === "paid";
  const isCredit = (p) => p.status === "credit";
  const isPendingLike = (p) =>
    ["pending","unpaid","due","partial"].includes(String(p.status||"").toLowerCase());

  // data access
  const tasks = () => load(KEY_TASKS, []);
  const payments = () => load(KEY_PAYMENTS, []);
  const expenses = () => load(KEY_EXPENSES, []);
  const reports = () => load(KEY_MONTHLY_REPORTS, []);

  const collectedCourse = () => sum(payments().filter(isPaid), p => p.amount);
  const spentCourse = () => sum(expenses(), e => e.amount);
  const saldoCourse = () => collectedCourse() - spentCourse();

  const creditTotal = () => sum(payments().filter(isCredit), p => p.amount);
  const pendingTotal = () => sum(payments().filter(isPendingLike), p => (p.amountRemaining ?? p.amount ?? 0));
  const deudoresCount = () => payments().filter(isPendingLike).length;

  // ----- menu -----
  function initMenu(){
    if(menuBtn && menuDropdown){
      menuBtn.onclick = (e)=>{
        e.stopPropagation();
        menuDropdown.style.display =
          (menuDropdown.style.display==="block"?"none":"block");
      };
      document.addEventListener("click", ()=> menuDropdown.style.display="none");
    }

    if(resetBtn){
      resetBtn.onclick = ()=>{
        if(!confirm("Reset total del curso (demo). ¿Continuar?")) return;

        localStorage.removeItem(KEY_TASKS);
        localStorage.removeItem(KEY_PAYMENTS);
        localStorage.removeItem(KEY_EXPENSES);
        localStorage.removeItem(KEY_MONTHLY_REPORTS);
        localStorage.removeItem(KEY_DIRTY);

        alert("Datos del curso eliminados.");
        go("home");
      };
    }

    // ✅ CAMBIO 3: logout siempre al login real
    if(logoutBtn){
      logoutBtn.onclick = ()=> location.href="/index.html";
    }
  }

  // ----- UI -----
  function renderHome(){
    const rec = collectedCourse();
    const gas = spentCourse();
    const sal = saldoCourse();
    const pend = pendingTotal();
    const debtors = deudoresCount();
    const credit = creditTotal();

    const alerts = [];
    if(pend > 0) alerts.push(`⏳ Pendiente curso: ${clp(pend)}`);
    if(debtors > 0) alerts.push(`👥 Deudores: ${debtors}`);
    if(isDirty()) alerts.push(`📄 Informe desactualizado`);

    app.innerHTML = `
      ${alerts.length ? `
        <div class="warnBox">
          <div style="font-weight:950;">Resumen rápido</div>
          <div class="muted" style="margin-top:6px;">${alerts.join(" · ")}</div>
        </div>` : ``}

      <div class="card">
        <div class="kTitle">Resumen ejecutivo del curso</div>
        <div class="kpiGrid">
          <div class="kpi"><div class="lbl">💰 Recaudado</div><div class="val">${clp(rec)}</div></div>
          <div class="kpi"><div class="lbl">🧾 Rendido</div><div class="val">${clp(gas)}</div></div>
          <div class="kpi"><div class="lbl">⚖️ Saldo</div><div class="val">${clp(sal)}</div></div>
          <div class="kpi"><div class="lbl">⏳ Pendiente</div><div class="val">${clp(pend)}</div></div>
        </div>

        <div style="margin-top:10px;display:flex;gap:10px;">
          <span class="pill">👥 Deudores ${debtors}</span>
          <span class="pill ok">➕ Saldo a favor ${clp(credit)}</span>
        </div>
      </div>
    `;
  }

  function go(tab){
    navItems.forEach(b=>b.classList.toggle("active", b.dataset.tab===tab));
    if(tab==="home") renderHome();
  }

  navItems.forEach(b=> b.onclick=()=> go(b.dataset.tab));

  // ==============================
  // 🚫 DEMO SEED DESACTIVADO
  // ==============================
  const DEMO_SEED = false; // ← deja SIEMPRE en false
  // if (DEMO_SEED) ensureDemo(); ❌ eliminado

  initMenu();
  go("home");
})();
