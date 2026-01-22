/* Cursapp · Tesorero (Rendiciones) — Optimizado (auto-keys) */
(function () {
  const app = document.getElementById("app");
  const modalRoot = document.getElementById("modalRoot");
  const navItems = Array.from(document.querySelectorAll(".navItem"));
  const menuBtn = document.getElementById("menuBtn");
  const menuDropdown = document.getElementById("menuDropdown");
  const resetBtn = document.getElementById("resetBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  // ---------- utils ----------
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>'"]/g, (c) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"
  }[c]));
  const clp = (n) => "$" + Number(n || 0).toLocaleString("es-CL");
  const uid = (p="id") => `${p}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
  const todayISO = () => new Date().toISOString().slice(0,10);

  function sum(arr, fn) {
    return (arr || []).reduce((a, x) => a + Number(fn ? fn(x) : x || 0), 0);
  }
  function hasBoleta(exp) {
    // soporta: exp.attachments[], exp.receipt, exp.boleta boolean
    if (Array.isArray(exp.attachments) && exp.attachments.length) return true;
    if (exp.receipt) return true;
    if (exp.boleta === true) return true;
    return false;
  }
  function missingBoletaCount(arr){
    return (arr || []).filter(e => !hasBoleta(e)).length;
  }

  // ---------- key auto-detect ----------
  // Buscamos keys existentes en localStorage (si no existen, usamos las estándar).
  const KEY_TASKS = detectKey(["cursapp_tasks_v1","cursapp_tasks","tasks","campanas","cursapp_campaigns_v1"]) || "cursapp_tasks_v1";
  const KEY_PAYMENTS = detectKey(["cursapp_payments_v1","cursapp_payments","pagos","payments"]) || "cursapp_payments_v1";
  const KEY_EXPENSES = detectKey(["cursapp_expenses_v1","cursapp_expenses","gastos","expenses","rendiciones"]) || "cursapp_expenses_v1";
  const KEY_REPORTS_DIRTY = detectKey(["cursapp_reports_dirty_v1","cursapp_dirty_reports","reportsDirty"]) || "cursapp_reports_dirty_v1";
  const KEY_MONTHLY_REPORTS = detectKey(["cursapp_monthly_reports_v1","monthly_reports","informesMensuales"]) || "cursapp_monthly_reports_v1";

  function detectKey(candidates){
    for (const k of candidates){
      if (localStorage.getItem(k) != null) return k;
    }
    return "";
  }

  function load(key, fallback){
    try{
      const v = localStorage.getItem(key);
      if(v==null) return fallback;
      return JSON.parse(v);
    }catch(e){
      return fallback;
    }
  }
  function save(key, val){
    localStorage.setItem(key, JSON.stringify(val));
  }

  function markDirty(){
    localStorage.setItem(KEY_REPORTS_DIRTY, "1");
  }
  function clearDirty(){
    localStorage.removeItem(KEY_REPORTS_DIRTY);
  }
  function isDirty(){
    return localStorage.getItem(KEY_REPORTS_DIRTY)==="1";
  }

  // ---------- demo seed (si no hay nada) ----------
  function ensureDemo(){
    const tasks = load(KEY_TASKS, []);
    if (Array.isArray(tasks) && tasks.length) return;

    save(KEY_TASKS, [
      {id:"t1", title:"Rifa del curso", startDate:"2026-01-10", dueDate:"2026-01-31", closed:false, mandatoryParticipation:true, type:"single"},
      {id:"t2", title:"Paseo de curso", startDate:"2026-01-01", dueDate:"2026-03-31", closed:false, mandatoryParticipation:false, type:"monthly"},
    ]);

    save(KEY_PAYMENTS, [
      {id:"p1", fromTaskId:"t1", concept:"Rifa del curso", amount:10000, status:"paid"},
      {id:"p2", fromTaskId:"t1", concept:"Rifa del curso", amount:10000, status:"paid"},
      {id:"p3", fromTaskId:"t2", concept:"Paseo de curso", amount:20000, status:"paid"},
    ]);

    save(KEY_EXPENSES, [
      {id:"e1", scope:"general", title:"Compra materiales urgentes", category:"Materiales", vendor:"Librería", date:"2026-01-18", amount:8500, note:"", attachments:[]},
      {id:"e2", scope:"campaign", campaignId:"t1", title:"Flores", category:"Regalos", vendor:"Florería", date:"2026-01-18", amount:25000, note:"", attachments:[{name:"boleta.jpg"}]},
      {id:"e3", scope:"campaign", campaignId:"t1", title:"Transporte", category:"Transporte", vendor:"Bus", date:"2026-01-18", amount:30000, note:"", attachments:[]},
      {id:"e4", scope:"campaign", campaignId:"t2", title:"Reserva", category:"Otros", vendor:"", date:"2026-01-18", amount:60000, note:"", attachments:[]},
    ]);

    save(KEY_MONTHLY_REPORTS, []);
    clearDirty();
  }

  // ---------- computed ----------
  function tasksAll(){
    return load(KEY_TASKS, []);
  }
  function tasksActive(){
    return tasksAll().filter(t => !t.closed);
  }
  function paymentsAll(){
    return load(KEY_PAYMENTS, []);
  }
  function expensesAll(){
    return load(KEY_EXPENSES, []);
  }
  function expensesGeneral(){
    return expensesAll().filter(e => e.scope==="general");
  }
  function expensesForTask(taskId){
    return expensesAll().filter(e => e.scope==="campaign" && e.campaignId===taskId);
  }

  function collectedCourse(){
    return sum(paymentsAll().filter(p => p.status==="paid"), p=>p.amount);
  }
  function collectedForTask(taskId){
    return sum(paymentsAll().filter(p => p.status==="paid" && p.fromTaskId===taskId), p=>p.amount);
  }

  // ---------- modal ----------
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

  // ---------- UI: menu ----------
  function initMenu(){
    if(menuBtn && menuDropdown){
      menuBtn.onclick = (e)=>{ e.stopPropagation(); menuDropdown.style.display = (menuDropdown.style.display==="block"?"none":"block"); };
      document.addEventListener("click", ()=> menuDropdown.style.display="none");
    }
    if(resetBtn){
      resetBtn.onclick = ()=>{
        if(!confirm("Esto eliminará datos demo. ¿Continuar?")) return;
        localStorage.removeItem(KEY_TASKS);
        localStorage.removeItem(KEY_PAYMENTS);
        localStorage.removeItem(KEY_EXPENSES);
        localStorage.removeItem(KEY_MONTHLY_REPORTS);
        localStorage.removeItem(KEY_REPORTS_DIRTY);
        alert("Datos reseteados.");
        ensureDemo();
        go("home");
      };
    }
    if(logoutBtn){
      logoutBtn.onclick = ()=> location.href="login.html";
    }
  }

  // ---------- Navigation ----------
  let state = { tab:"home", taskId:"" };

  function setActiveTab(tab){
    navItems.forEach(b=> b.classList.toggle("active", b.dataset.tab===tab));
  }
  function go(tab, taskId){
    state.tab = tab;
    state.taskId = taskId || "";
    setActiveTab(tab);
    if(tab==="home") renderHome();
    if(tab==="rendiciones") renderRendiciones(state.taskId);
    if(tab==="informes") renderInformes();
  }

  navItems.forEach(b=> b.onclick = ()=> go(b.dataset.tab));

  // ---------- Render: Home ----------
  function renderHome(){
    const exp = expensesAll();
    const collected = collectedCourse();
    const spent = sum(exp, e=>e.amount);
    const saldo = collected - spent;
    const sinBoleta = missingBoletaCount(exp);
    const pendienteRendir = sum(exp.filter(e=>!hasBoleta(e)), e=>e.amount);

    const t = tasksActive();
    const cards = t.map(x=>{
      const rec = collectedForTask(x.id);
      const gas = sum(expensesForTask(x.id), e=>e.amount);
      const s = rec - gas;
      const miss = missingBoletaCount(expensesForTask(x.id));
      return `
        <div class="lineItem clickable" style="cursor:pointer" onclick="window.__goRend('${x.id}')">
          <div style="font-weight:950;">${esc(x.title)}</div>
          <div class="muted" style="margin-top:6px;display:flex;gap:10px;flex-wrap:wrap;">
            <span class="pill ok">Rec ${clp(rec)}</span>
            <span class="pill warn">Gas ${clp(gas)}</span>
            <span class="pill ${s<0?'danger':''}">Saldo ${clp(s)}</span>
            ${miss?`<span class="pill danger">⚠️ sin boleta ${miss}</span>`:""}
          </div>
        </div>
      `;
    }).join("");

    app.innerHTML = `
      ${isDirty()?`<div class="alertBox">📄 Cambios detectados: requiere nuevo informe</div>`:""}

      <div class="card">
        <div class="kTitle">Estado financiero del curso</div>
        <div class="kpiGrid">
          <div class="kpi"><div class="lbl">💰 Recaudado</div><div class="val">${clp(collected)}</div></div>
          <div class="kpi"><div class="lbl">🧾 Gastado / rendido</div><div class="val">${clp(spent)}</div></div>
          <div class="kpi"><div class="lbl">⚖️ Saldo disponible</div><div class="val">${clp(saldo)}</div></div>
          <div class="kpi"><div class="lbl">⏳ Pendiente de rendir</div><div class="val">${clp(pendienteRendir)}</div></div>
        </div>
        <div style="margin-top:10px;display:flex;gap:10px;flex-wrap:wrap;">
          ${sinBoleta?`<span class="pill danger">⚠️ Sin boleta ${sinBoleta}</span>`:`<span class="pill ok">✅ Boletas al día</span>`}
        </div>
      </div>

      <div class="card">
        <div class="row">
          <div class="kTitle">📌 Campañas activas</div>
          <div class="muted" style="font-weight:900;">${t.length} activas</div>
        </div>
        <div class="listLines" style="margin-top:10px;">
          ${cards || `<div class="muted">Sin campañas activas.</div>`}
        </div>
      </div>
    `;

    window.__goRend = (id)=> go("rendiciones", id);
  }

  // ---------- Render: Rendiciones ----------
  function renderRendiciones(selectedTaskId){
    const t = tasksActive();
    const expAll = expensesAll();
    const collected = collectedCourse();
    const spent = sum(expAll, e=>e.amount);
    const saldo = collected - spent;

    const sinBoleta = missingBoletaCount(expAll);

    const expGen = expensesGeneral();

    app.innerHTML = `
      ${isDirty()?`<div class="alertBox">📄 Cambios detectados: requiere nuevo informe</div>`:""}

      <div class="card">
        <div class="row">
          <div class="kTitle">Rendiciones del curso</div>
          <div class="muted" style="font-weight:900;">${sinBoleta?`⚠️ Sin boleta ${sinBoleta}`:"✅ OK"}</div>
        </div>
        <div style="margin-top:10px;display:flex;gap:10px;flex-wrap:wrap;">
          <span class="pill ok">💰 Recaudado ${clp(collected)}</span>
          <span class="pill warn">🧾 Gastado ${clp(spent)}</span>
          <span class="pill ${saldo<0?'danger':''}">⚖️ Saldo ${clp(saldo)}</span>
        </div>
      </div>

      <div class="card exp-general">
        <div class="kTitle">🏦 Fondo del curso (sin campaña)</div>
        <div class="noteBox">
          <div style="font-weight:950;">ℹ️ Gasto general</div>
          <div class="muted" style="margin-top:6px;">
            Gasto sin campaña y de uso rápido del fondo del curso (imprevistos/operativos).
          </div>
        </div>
        <div class="row" style="margin-top:12px;">
          <div class="muted" style="font-weight:900;">${expGen.length} gasto(s)</div>
          <div class="actions">
            <button class="btnPrimaryMini" onclick="openCreateExpense('general','')">+ Agregar gasto general</button>
          </div>
        </div>
        <div class="listLines" style="margin-top:10px;">
          ${expGen.length?expGen.map(renderExpenseRow).join(""):`<div class="muted">Sin gastos generales.</div>`}
        </div>
      </div>

      <div class="card">
        <div class="row">
          <div class="kTitle">🎯 Rendiciones por campaña</div>
          <div class="actions">
            <select id="taskSel" class="btnMini">
              <option value="">Ver todas</option>
              ${t.map(x=>`<option value="${x.id}" ${selectedTaskId===x.id?"selected":""}>${esc(x.title)}</option>`).join("")}
            </select>
          </div>
        </div>
        <div id="campaignWrap" style="margin-top:10px;"></div>
      </div>
    `;

    const sel = $("taskSel");
    sel.onchange = ()=> renderRendiciones(sel.value||"");

    const wrap = $("campaignWrap");
    const show = selectedTaskId ? t.filter(x=>x.id===selectedTaskId) : t;

    wrap.innerHTML = show.map(renderCampaignCard).join("");

    // global handlers
    window.openEditCampaign = openEditCampaign;
    window.saveEditCampaign = saveEditCampaign;
    window.openCreateExpense = openCreateExpense;
    window.saveExpense = saveExpense;
    window.editExpense = editExpense;
    window.saveEditExpense = saveEditExpense;
    window.deleteExpense = deleteExpense;
    window.uploadBoleta = uploadBoleta;
    window.replaceBoleta = replaceBoleta;
    window.viewBoleta = viewBoleta;
  }

  function renderCampaignCard(task){
    const exp = expensesForTask(task.id);
    const rec = collectedForTask(task.id);
    const gas = sum(exp, e=>e.amount);
    const s = rec - gas;
    const miss = missingBoletaCount(exp);

    return `
      <div class="card exp-campaign" style="margin-top:12px;">
        <div class="row">
          <div>
            <div style="font-weight:950;">${esc(task.title)} <span class="pill" style="margin-left:8px;">Campaña</span></div>
            <div class="muted" style="margin-top:6px;font-weight:800;font-size:12px;">${task.startDate||""} → ${task.dueDate||""}</div>
            <div style="margin-top:10px;display:flex;gap:10px;flex-wrap:wrap;">
              <span class="pill ok">Recaudado ${clp(rec)}</span>
              <span class="pill warn">Gastado ${clp(gas)}</span>
              <span class="pill ${s<0?'danger':''}">Saldo ${clp(s)}</span>
              ${miss?`<span class="pill danger">⚠️ sin boleta ${miss}</span>`:""}
            </div>
          </div>
          <div class="actions">
            <button class="btnMini" onclick="openEditCampaign('${task.id}')">✏️ Editar campaña</button>
            <button class="btnPrimaryMini" onclick="openCreateExpense('campaign','${task.id}')">+ Agregar gasto</button>
          </div>
        </div>

        <div class="listLines" style="margin-top:10px;">
          ${exp.length?exp.map(renderExpenseRow).join(""):`<div class="muted">Sin gastos asociados.</div>`}
        </div>
      </div>
    `;
  }

  function renderExpenseRow(e){
    const has = hasBoleta(e);

    const badge = has
      ? `<span class="pill ok">Con boleta</span>`
      : `<span class="pill danger">Sin boleta</span>`;

    const boletaActions = has
      ? `<button class="btnMini" onclick="replaceBoleta('${e.id}')">🔁 Reemplazar</button>
         <button class="btnMini" onclick="viewBoleta('${e.id}')">👁 Ver boleta</button>`
      : `<button class="btnPrimaryMini" onclick="uploadBoleta('${e.id}')">📎 Subir boleta</button>`;

    const scopeLabel = e.scope==="general"
      ? "🏦 Fondo del curso"
      : "🎯 Campaña";

    return `
      <div class="lineItem">
        <div class="lineTop">
          <div>
            <div style="font-weight:950;">${esc(e.title)}</div>
            <div class="muted" style="margin-top:4px;font-weight:800;font-size:12px;">
              ${scopeLabel} · ${esc(e.category||"Otros")} · ${esc(e.vendor||"—")} · ${esc(e.date||"")}
            </div>
            <div style="font-weight:950;margin-top:6px;">${clp(e.amount)}</div>
          </div>
          <div class="actions">
            ${badge}
            ${boletaActions}
            <button class="btnMini" onclick="editExpense('${e.id}')">✏️ Editar</button>
            <button class="btnMini" onclick="deleteExpense('${e.id}')">🗑️ Eliminar</button>
          </div>
        </div>
      </div>
    `;
  }

  // ---------- Edit Campaign ----------
  function openEditCampaign(taskId){
    const tasks = tasksAll();
    const t = tasks.find(x=>x.id===taskId);
    if(!t) return;

    openModal(`
      <div class="row">
        <div>
          <div style="font-weight:950;font-size:18px;">Editar campaña</div>
          <div class="muted" style="margin-top:6px;">Los cambios marcarán “Requiere nuevo informe”.</div>
        </div>
        <button class="btnMini" onclick="(${closeModal.toString()})()">Cerrar</button>
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

      <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;">
        <div style="flex:1;min-width:140px;">
          <label style="font-weight:900;">Tipo</label>
          <select id="ec_type">
            <option value="single" ${t.type==="single"?"selected":""}>Pago único</option>
            <option value="monthly" ${t.type==="monthly"?"selected":""}>Mensual</option>
          </select>
        </div>
        <div style="flex:1;min-width:140px;">
          <label style="font-weight:900;">Participación</label>
          <select id="ec_mandatory">
            <option value="true" ${t.mandatoryParticipation?"selected":""}>Obligatoria</option>
            <option value="false" ${!t.mandatoryParticipation?"selected":""}>No obligatoria</option>
          </select>
        </div>
      </div>

      <div class="actions" style="margin-top:14px;justify-content:flex-end;">
        <button class="btnMini" onclick="(${closeModal.toString()})()">Cancelar</button>
        <button class="btnPrimaryMini" onclick="saveEditCampaign('${taskId}')">Guardar</button>
      </div>
    `);
  }

  function saveEditCampaign(taskId){
    const tasks = tasksAll();
    const i = tasks.findIndex(x=>x.id===taskId);
    if(i<0) return;

    tasks[i].title = ($("ec_title").value||"").trim() || tasks[i].title;
    tasks[i].startDate = $("ec_start").value || tasks[i].startDate;
    tasks[i].dueDate = $("ec_due").value || tasks[i].dueDate;
    tasks[i].type = $("ec_type").value || tasks[i].type;
    tasks[i].mandatoryParticipation = $("ec_mandatory").value === "true";

    save(KEY_TASKS, tasks);
    markDirty();
    closeModal();
    renderRendiciones(taskId);
  }

  // ---------- Create / Edit Expense ----------
  let _draftExpense = null;

  function openCreateExpense(scope, taskId){
    _draftExpense = { scope, campaignId: scope==="campaign"?taskId:null, attached:false };

    const taskOptions = tasksActive().map(t=>`<option value="${t.id}" ${t.id===taskId?"selected":""}>${esc(t.title)}</option>`).join("");

    openModal(`
      <div class="row">
        <div>
          <div style="font-weight:950;font-size:18px;">Agregar gasto</div>
          <div class="muted" style="margin-top:6px;">Puedes adjuntar boleta ahora o después.</div>
        </div>
        <button class="btnMini" onclick="(${closeModal.toString()})()">Cerrar</button>
      </div>

      <div style="margin-top:12px;">
        <label style="font-weight:900;">Tipo</label>
        <select id="ex_scope">
          <option value="general" ${scope==="general"?"selected":""}>🏦 Fondo del curso (sin campaña)</option>
          <option value="campaign" ${scope==="campaign"?"selected":""}>🎯 Asociado a campaña</option>
        </select>
      </div>

      <div id="ex_campaign_wrap" style="margin-top:12px;${scope==="campaign"?"":"display:none;"}">
        <label style="font-weight:900;">Campaña</label>
        <select id="ex_campaign">${taskOptions}</select>
      </div>

      <div style="margin-top:12px;">
        <label style="font-weight:900;">Concepto</label>
        <input id="ex_title" placeholder="Ej: Transporte" />
      </div>

      <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;">
        <div style="flex:1;min-width:140px;">
          <label style="font-weight:900;">Categoría</label>
          <input id="ex_cat" placeholder="Ej: Transporte" />
        </div>
        <div style="flex:1;min-width:140px;">
          <label style="font-weight:900;">Proveedor</label>
          <input id="ex_vendor" placeholder="Ej: Bus" />
        </div>
      </div>

      <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;">
        <div style="flex:1;min-width:140px;">
          <label style="font-weight:900;">Fecha</label>
          <input id="ex_date" type="date" value="${todayISO()}" />
        </div>
        <div style="flex:1;min-width:140px;">
          <label style="font-weight:900;">Monto</label>
          <input id="ex_amount" inputmode="numeric" placeholder="5000" />
        </div>
      </div>

      <div class="noteBox">
        <div style="font-weight:950;">📎 Boleta</div>
        <div class="muted" style="margin-top:6px;">Si no adjuntas boleta, quedará marcada como pendiente.</div>
        <button class="btnMini" id="btn_attach">Adjuntar boleta (demo)</button>
        <div id="attach_state" class="muted" style="margin-top:6px;font-size:12px;">Sin boleta</div>
      </div>

      <div class="actions" style="margin-top:14px;justify-content:flex-end;">
        <button class="btnMini" onclick="(${closeModal.toString()})()">Cancelar</button>
        <button class="btnPrimaryMini" onclick="saveExpense()">Guardar</button>
      </div>
    `);

    $("ex_scope").onchange = ()=>{
      const v = $("ex_scope").value;
      $("ex_campaign_wrap").style.display = (v==="campaign")?"block":"none";
    };
    const btnAttach = $("btn_attach");
    btnAttach.onclick = ()=>{
      _draftExpense.attached = true;
      $("attach_state").textContent = "Boleta adjunta (demo)";
    };
  }

  function saveExpense(){
    const scope = $("ex_scope").value;
    const title = ($("ex_title").value||"").trim();
    const amount = Number($("ex_amount").value||0);
    if(!title || !amount){ alert("Completa concepto y monto."); return; }

    const ex = expensesAll();
    const e = {
      id: uid("e"),
      scope,
      campaignId: scope==="campaign" ? $("ex_campaign").value : null,
      title,
      category: ($("ex_cat").value||"").trim(),
      vendor: ($("ex_vendor").value||"").trim(),
      date: $("ex_date").value,
      amount,
      note: "",
      attachments: _draftExpense && _draftExpense.attached ? [{name:"boleta.jpg"}] : []
    };
    ex.unshift(e);
    save(KEY_EXPENSES, ex);
    markDirty();
    closeModal();
    renderRendiciones(e.campaignId || "");
  }

  function editExpense(expenseId){
    const ex = expensesAll();
    const e = ex.find(x=>x.id===expenseId);
    if(!e) return;

    openModal(`
      <div class="row">
        <div>
          <div style="font-weight:950;font-size:18px;">Editar gasto</div>
          <div class="muted" style="margin-top:6px;">Esto marcará “Requiere nuevo informe”.</div>
        </div>
        <button class="btnMini" onclick="(${closeModal.toString()})()">Cerrar</button>
      </div>

      <div style="margin-top:12px;">
        <label style="font-weight:900;">Concepto</label>
        <input id="ee_title" value="${esc(e.title)}" />
      </div>

      <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;">
        <div style="flex:1;min-width:140px;">
          <label style="font-weight:900;">Fecha</label>
          <input id="ee_date" type="date" value="${e.date||todayISO()}" />
        </div>
        <div style="flex:1;min-width:140px;">
          <label style="font-weight:900;">Monto</label>
          <input id="ee_amount" inputmode="numeric" value="${Number(e.amount||0)}" />
        </div>
      </div>

      <div style="margin-top:12px;">
        <label style="font-weight:900;">Categoría</label>
        <input id="ee_cat" value="${esc(e.category||"")}" />
      </div>

      <div style="margin-top:12px;">
        <label style="font-weight:900;">Proveedor</label>
        <input id="ee_vendor" value="${esc(e.vendor||"")}" />
      </div>

      <div class="actions" style="margin-top:14px;justify-content:flex-end;">
        <button class="btnMini" onclick="(${closeModal.toString()})()">Cancelar</button>
        <button class="btnPrimaryMini" onclick="saveEditExpense('${expenseId}')">Guardar</button>
      </div>
    `);
  }

  function saveEditExpense(expenseId){
    const ex = expensesAll();
    const i = ex.findIndex(x=>x.id===expenseId);
    if(i<0) return;

    ex[i].title = ($("ee_title").value||"").trim() || ex[i].title;
    ex[i].date = $("ee_date").value || ex[i].date;
    ex[i].amount = Number($("ee_amount").value||ex[i].amount);
    ex[i].category = ($("ee_cat").value||"").trim();
    ex[i].vendor = ($("ee_vendor").value||"").trim();

    save(KEY_EXPENSES, ex);
    markDirty();
    closeModal();
    renderRendiciones(ex[i].campaignId || "");
  }

  function deleteExpense(expenseId){
    if(!confirm("¿Eliminar este gasto? Esto marcará “Requiere nuevo informe”."))
      return;
    const ex = expensesAll().filter(x=>x.id!==expenseId);
    save(KEY_EXPENSES, ex);
    markDirty();
    renderRendiciones("");
  }

  function uploadBoleta(expenseId){
    const ex = expensesAll();
    const i = ex.findIndex(x=>x.id===expenseId);
    if(i<0) return;
    ex[i].attachments = [{name:"boleta.jpg"}];
    save(KEY_EXPENSES, ex);
    markDirty();
    renderRendiciones(ex[i].campaignId || "");
  }

  function replaceBoleta(expenseId){
    const ex = expensesAll();
    const i = ex.findIndex(x=>x.id===expenseId);
    if(i<0) return;
    ex[i].attachments = [{name:"boleta_reemplazada.jpg"}];
    save(KEY_EXPENSES, ex);
    markDirty();
    alert("Boleta reemplazada ✅ (demo)");
    renderRendiciones(ex[i].campaignId || "");
  }

  function viewBoleta(){
    alert("Ver boleta (demo). Aquí se abriría la imagen/PDF.");
  }

  // ---------- Informes ----------
  function renderInformes(){
    const reports = load(KEY_MONTHLY_REPORTS, []);
    app.innerHTML = `
      ${isDirty()?`<div class="alertBox">📄 Cambios detectados: requiere nuevo informe</div>`:""}
      <div class="card">
        <div class="kTitle">📊 Informes</div>
        <div class="muted" style="margin-top:6px;">Si editas o eliminas rendiciones, debes emitir un nuevo informe.</div>

        <div class="actions" style="margin-top:12px;">
          <button class="btnPrimaryMini" onclick="generateMonthly()">Generar informe mensual (demo)</button>
          <button class="btnMini" onclick="clearDirty();renderInformes()">Marcar como resuelto</button>
        </div>

        <div class="listLines" style="margin-top:12px;">
          ${reports.length
            ? reports.map(r=>`<div class="lineItem"><b>${esc(r.period)}</b> · Emitido ${esc(r.generatedAt)}</div>`).join("")
            : `<div class="muted">Sin informes generados.</div>`
          }
        </div>
      </div>
    `;
    window.generateMonthly = generateMonthly;
  }

  function generateMonthly(){
    const period = prompt("Mes (YYYY-MM)", "2026-01");
    if(!period) return;
    if(!/^\d{4}-\d{2}$/.test(period)){ alert("Formato inválido (YYYY-MM)"); return; }

    const expAll = expensesAll();
    const collected = collectedCourse();
    const spent = sum(expAll, e=>e.amount);

    const rep = {
      id: uid("repM"),
      period,
      generatedAt: new Date().toLocaleString("es-CL"),
      recaudadoCurso: collected,
      gastadoCurso: spent,
      disponibleCurso: collected - spent
    };
    const reps = load(KEY_MONTHLY_REPORTS, []);
    reps.unshift(rep);
    save(KEY_MONTHLY_REPORTS, reps);
    clearDirty();
    alert("Informe generado ✅ (demo)");
    renderInformes();
  }

  // ---------- Boot ----------
  ensureDemo();
  initMenu();
  go("home");

  function initMenu(){
    if(menuBtn && menuDropdown){
      menuBtn.onclick=(e)=>{e.stopPropagation(); menuDropdown.style.display=(menuDropdown.style.display==="block"?"none":"block");};
      document.addEventListener("click",()=> menuDropdown.style.display="none");
    }
    if(resetBtn){
      resetBtn.onclick=()=>{
        if(!confirm("Esto eliminará datos. ¿Continuar?")) return;
        localStorage.removeItem(KEY_TASKS);
        localStorage.removeItem(KEY_PAYMENTS);
        localStorage.removeItem(KEY_EXPENSES);
        localStorage.removeItem(KEY_MONTHLY_REPORTS);
        localStorage.removeItem(KEY_REPORTS_DIRTY);
        alert("Datos reseteados.");
        ensureDemo();
        go("home");
      };
    }
    if(logoutBtn){
      logoutBtn.onclick=()=> location.href="login.html";
    }
  }

})(); 
