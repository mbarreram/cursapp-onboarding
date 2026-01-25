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

  // storage keys (auto to match your ecosystem)
  const KEY_TASKS = detectKey(["cursapp_tasks_v1", "tasks", "campanas"]) || "cursapp_tasks_v1";
  const KEY_PAYMENTS = detectKey(["cursapp_payments_v1", "payments", "pagos"]) || "cursapp_payments_v1";
  const KEY_EXPENSES = detectKey(["cursapp_expenses_v1", "expenses", "gastos", "rendiciones"]) || "cursapp_expenses_v1";
  const KEY_MONTHLY_REPORTS = detectKey(["cursapp_monthly_reports_v1", "monthly_reports", "informesMensuales"]) || "cursapp_monthly_reports_v1";
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

  function collectedTask(id){
    return sum(payments().filter(p=>p.fromTaskId===id && isPaid(p)), p=>p.amount);
  }
  function pendingTask(id){
    return sum(payments().filter(p=>p.fromTaskId===id && isPendingLike(p)), p => (p.amountRemaining ?? p.amount ?? 0));
  }
  function deudoresTask(id){
    return payments().filter(p=>p.fromTaskId===id && isPendingLike(p)).length;
  }
  function spentTask(id){
    return sum(expenses().filter(e=>e.scope==="campaign" && e.campaignId===id), e=>e.amount);
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
        ensureDemo();
        go("home");
      };
    }
    if(logoutBtn){
      logoutBtn.onclick = ()=> location.href="login.html";
    }
  }

  // ----- demo seed (if empty) -----
  function ensureDemo(){
    if(tasks().length) return;

    save(KEY_TASKS, [
      {id:"t1", title:"Rifa del curso", startDate:"2026-01-10", dueDate:"2026-01-31", closed:false, closeType:"", closeReason:"", mandatoryParticipation:true, type:"single"},
      {id:"t2", title:"Paseo de curso", startDate:"2026-02-01", dueDate:"2026-04-01", closed:false, closeType:"", closeReason:"", mandatoryParticipation:false, type:"monthly"},
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

  // ----- UI pieces -----
  function statusPillForCampaign(t){
    if(t.closed){
      const pend = pendingTask(t.id);
      if(pend > 0) return `<span class="pill warn">Cerrada · con pagos pendientes</span>`;
      return `<span class="pill">Cerrada</span>`;
    }
    if(isExpired(t)) return `<span class="pill danger">Caducada</span>`;
    return `<span class="pill ok">Activa</span>`;
  }

  function lineClassForCampaign(t){
    const pend = pendingTask(t.id);
    const saldo = collectedTask(t.id) - spentTask(t.id);
    if(saldo < 0) return "isDanger";
    if(pend > 0 && t.closed) return "isWarn";
    if(isExpired(t)) return "isWarn";
    return "isOk";
  }

  // ----- Home -----
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
        <div class="${isDirty() ? "warnBox" : "warnBox"}">
          <div style="font-weight:950;">Resumen rápido</div>
          <div class="muted" style="margin-top:6px;">${alerts.join(" · ")}</div>
        </div>
      `:""}

      <div class="card">
        <div class="row">
          <div>
            <div class="kTitle">Resumen ejecutivo del curso</div>
            <div class="muted" style="margin-top:6px;">Montos globales (no personales)</div>
          </div>
          <div class="actions">
            <button class="btnx primary" onclick="confirmGenerateReport()">📄 Publicar informe</button>
          </div>
        </div>

        <div class="kpiGrid">
          <div class="kpi"><div class="lbl">💰 Recaudado</div><div class="val">${clp(rec)}</div></div>
          <div class="kpi"><div class="lbl">🧾 Rendido</div><div class="val">${clp(gas)}</div></div>
          <div class="kpi"><div class="lbl">⚖️ Saldo</div><div class="val">${clp(sal)}</div></div>
          <div class="kpi"><div class="lbl">⏳ Pendiente (curso)</div><div class="val">${clp(pend)}</div></div>
        </div>

        <div style="margin-top:10px;display:flex;gap:10px;flex-wrap:wrap;">
          <span class="pill">👥 Deudores ${debtors}</span>
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
      const pend = pendingTask(t.id);
      const debtors = deudoresTask(t.id);

      return `
        <div class="lineItem ${lineClassForCampaign(t)}">
          <div class="row">
            <div>
              <div style="font-weight:950;">${esc(t.title)} ${statusPillForCampaign(t)}</div>
              <div class="muted" style="margin-top:6px;font-size:12px;">${esc(t.startDate||"")} → ${esc(t.dueDate||"")}</div>

              <div style="margin-top:8px;display:flex;gap:10px;flex-wrap:wrap;">
                <span class="pill ok">Rec ${clp(rec)}</span>
                <span class="pill warn">Gas ${clp(gas)}</span>
                <span class="pill ${saldo<0?"danger":""}">Saldo ${clp(saldo)}</span>
                <span class="pill">Deudores ${debtors}</span>
                <span class="pill warn">Pendiente ${clp(pend)}</span>
              </div>
            </div>

            <div class="actions">
              <button class="btnx" onclick="openEditCampaign('${t.id}')">✏️ Editar</button>
              ${(!t.closed && !isExpired(t)) ? `<button class="btnx danger" onclick="deleteCampaign('${t.id}')">🗑️ Eliminar</button>` : ""}
            </div>
          </div>
        </div>
      `;
    }).join("");

    app.innerHTML = `
      <div class="card">
        <div class="row">
          <div>
            <div class="kTitle">Campañas</div>
            <div class="muted" style="margin-top:6px;">Filtros por estado. Muestra pendientes sin nombres.</div>
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
                  Recaudado ${clp(r.recaudadoCurso||0)} · Rendido ${clp(r.gastadoCurso||0)} · Saldo ${clp(r.disponibleCurso||0)}
                </div>
              </div>
            `).join("")
            : `<div class="muted">Sin informes publicados.</div>`
          }
        </div>
      </div>
    `;
  }

  // ----- Create/Edit/Delete Campaign -----
  window.openCreateCampaign = function(){
    openModal(`
      <div class="row">
        <div>
          <div style="font-weight:950;font-size:18px;">Crear campaña</div>
          <div class="muted" style="margin-top:6px;">Mínimo: nombre + fechas. (Monto se define en cobros/pack después)</div>
        </div>
        <button class="btnx" onclick="closeModal()">Cerrar</button>
      </div>

      <div style="margin-top:12px;">
        <label style="font-weight:900;">Nombre</label>
        <input id="cc_title" placeholder="Ej: Cuota paseo" />
      </div>

      <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;">
        <div style="flex:1;min-width:140px;">
          <label style="font-weight:900;">Inicio</label>
          <input id="cc_start" type="date" value="${todayISO()}" />
        </div>
        <div style="flex:1;min-width:140px;">
          <label style="font-weight:900;">Fin</label>
          <input id="cc_due" type="date" value="${todayISO()}" />
        </div>
      </div>

      <div class="actions" style="margin-top:14px;justify-content:flex-end;">
        <button class="btnx" onclick="closeModal()">Cancelar</button>
        <button class="btnx primary" onclick="saveCreateCampaign()">Crear</button>
      </div>
    `);
  };

  window.saveCreateCampaign = function(){
    const title = (document.getElementById("cc_title").value||"").trim();
    const startDate = document.getElementById("cc_start").value || todayISO();
    const dueDate = document.getElementById("cc_due").value || todayISO();
    if(!title){ alert("Debes ingresar nombre."); return; }

    const ts = tasks();
    ts.unshift({
      id: uid("t"),
      title,
      startDate,
      dueDate,
      closed:false,
      closeType:"",
      closeReason:"",
      mandatoryParticipation:true,
      type:"single"
    });
    save(KEY_TASKS, ts);
    markDirty();
    closeModal();
    alert("Campaña creada ✅");
    go("campanas");
  };

  window.openEditCampaign = function(taskId){
    const ts = tasks();
    const t = ts.find(x=>x.id===taskId);
    if(!t) return;

    openModal(`
      <div class="row">
        <div>
          <div style="font-weight:950;font-size:18px;">Editar campaña</div>
          <div class="muted" style="margin-top:6px;">Esto marcará “requiere nuevo informe”.</div>
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
          <input id="ec_start" type="date" value="${t.startDate||todayISO()}" />
        </div>
        <div style="flex:1;min-width:140px;">
          <label style="font-weight:900;">Fin</label>
          <input id="ec_due" type="date" value="${t.dueDate||todayISO()}" />
        </div>
      </div>

      <div class="actions" style="margin-top:14px;justify-content:flex-end;">
        <button class="btnx" onclick="closeModal()">Cancelar</button>
        <button class="btnx primary" onclick="saveEditCampaign('${taskId}')">Guardar</button>
      </div>
    `);
  };

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
    go("campanas");
  };

  window.deleteCampaign = function(taskId){
    const t = tasks().find(x=>x.id===taskId);
    if(!t) return;

    if(t.closed){ alert("No se puede eliminar una campaña cerrada."); return; }
    if(isExpired(t)){ alert("No se puede eliminar una campaña caducada."); return; }

    if(!confirm(`¿Eliminar campaña "${t.title}"?\n\nPagos pagados quedarán como saldo a favor.`)) return;

    // Remove campaign
    save(KEY_TASKS, tasks().filter(x=>x.id!==taskId));

    // Remove expenses associated
    save(KEY_EXPENSES, expenses().filter(e=>!(e.scope==="campaign" && e.campaignId===taskId)));

    // Convert paid payments to credit
    const ps = payments().map(p=>{
      if(p.fromTaskId===taskId && isPaid(p)){
        return {...p, status:"credit", creditFromTaskId:taskId, note:"Saldo a favor por campaña eliminada"};
      }
      return p;
    });
    save(KEY_PAYMENTS, ps);

    markDirty();
    alert("Campaña eliminada ✅");
    go("campanas");
  };

  // ----- Close Campaign -----
  window.openCloseCampaign = function(){
    const list = activeTasks();
    if(!list.length){ alert("No hay campañas activas para cerrar."); return; }

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
          ${list.map(t=>`<option value="${t.id}">${esc(t.title)}</option>`).join("")}
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
        <label style="font-weight:900;">Motivo (obligatorio)</label>
        <input id="cl_reason" placeholder="Ej: Actividad cancelada / Cambio de plan" />
      </div>

      <div class="actions" style="margin-top:14px;justify-content:flex-end;">
        <button class="btnx" onclick="closeModal()">Cancelar</button>
        <button class="btnx primary" onclick="saveCloseCampaign()">Cerrar campaña</button>
      </div>
    `);
  };

  window.saveCloseCampaign = function(){
    const taskId = document.getElementById("cl_task").value;
    const type = document.getElementById("cl_type").value;
    const reason = (document.getElementById("cl_reason").value||"").trim();
    if(!reason){ alert("Debes ingresar el motivo."); return; }

    const ts = tasks();
    const i = ts.findIndex(x=>x.id===taskId);
    if(i<0) return;

    ts[i].closed = true;
    ts[i].closeType = type;
    ts[i].closeReason = reason;

    save(KEY_TASKS, ts);
    markDirty();
    closeModal();
    alert("Campaña cerrada ✅");
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
  ensureDemo();
  initMenu();
  go("home");
})();
