/* Cursapp · Tesorero (Rendiciones) — FULL FINAL (auto-keys + no-loss) */
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

  function sum(arr, fn) { return (arr || []).reduce((a, x) => a + Number(fn ? fn(x) : x || 0), 0); }

  function hasBoleta(exp) {
    if (Array.isArray(exp.attachments) && exp.attachments.length) return true;
    if (exp.receipt) return true;
    if (exp.boleta === true) return true;
    return false;
  }
  function missingBoletaCount(arr){ return (arr || []).filter(e => !hasBoleta(e)).length; }

  // ---------- keys (scoped por curso; listo para producción) ----------
  const sk = (base)=> (window.CURSAPP && window.CURSAPP.scopedKey) ? window.CURSAPP.scopedKey(base) : `cursapp_${base}`;
  const KEY_TASKS = sk("tasks_v1");
  const KEY_PAYMENTS = sk("payments_v1");
  const KEY_EXPENSES = sk("expenses_v1");
  const KEY_REPORTS_DIRTY = detectKey(["cursapp_reports_dirty_v1","cursapp_dirty_reports","reportsDirty"]) || "cursapp_reports_dirty_v1";
  const KEY_MONTHLY_REPORTS = sk("monthly_reports_v1");

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
  function save(key, val){ localStorage.setItem(key, JSON.stringify(val)); }

  function markDirty(){ localStorage.setItem(KEY_REPORTS_DIRTY, "1"); }
  function clearDirty(){ localStorage.removeItem(KEY_REPORTS_DIRTY); }
  function isDirty(){ return localStorage.getItem(KEY_REPORTS_DIRTY)==="1"; }

  // ---------- demo seed ----------
  function ensureDemo(){
    const tasks = load(KEY_TASKS, []);
    if (Array.isArray(tasks) && tasks.length) return;

    save(KEY_TASKS, [
      {id:"t1", title:"Rifa del curso", startDate:"2026-01-10", dueDate:"2026-01-31", closed:false, mandatoryParticipation:true, type:"single"},
      {id:"t2", title:"Paseo de curso", startDate:"2026-01-01", dueDate:"2026-03-31", closed:false, mandatoryParticipation:false, type:"monthly"},
      {id:"t3", title:"Prueba filtrooooooo", startDate:"2026-01-19", dueDate:"2026-01-28", closed:false, mandatoryParticipation:true, type:"single"},
    ]);

    save(KEY_PAYMENTS, [
      {id:"p1", fromTaskId:"t1", concept:"Rifa del curso", amount:10000, status:"paid"},
      {id:"p2", fromTaskId:"t1", concept:"Rifa del curso", amount:10000, status:"paid"},
      {id:"p3", fromTaskId:"t2", concept:"Paseo de curso", amount:20000, status:"paid"},
      {id:"p4", fromTaskId:"t3", concept:"Prueba filtro", amount:1500, status:"paid"},
      {id:"p5", fromTaskId:"t3", concept:"Prueba filtro", amount:1500, status:"paid"},
    ]);

    save(KEY_EXPENSES, [
      {id:"e1", scope:"general", title:"Compra materiales urgentes", category:"Materiales", vendor:"Librería", date:"2026-01-18", amount:8500, note:"Gasto general del curso (demo)", attachments:[]},
      {id:"e2", scope:"campaign", campaignId:"t1", title:"Flores", category:"Regalos", vendor:"Florería", date:"2026-01-18", amount:25000, note:"", attachments:[{name:"boleta.jpg"}]},
      {id:"e3", scope:"campaign", campaignId:"t1", title:"Transporte", category:"Transporte", vendor:"Bus", date:"2026-01-18", amount:30000, note:"", attachments:[]},
      {id:"e4", scope:"campaign", campaignId:"t2", title:"Reserva", category:"Otros", vendor:"", date:"2026-01-18", amount:60000, note:"", attachments:[]},
      {id:"e5", scope:"campaign", campaignId:"t3", title:"Ccccc", category:"Gg", vendor:"Vvv", date:"2026-01-25", amount:2000, note:"", attachments:[]},
      {id:"e6", scope:"campaign", campaignId:"t3", title:"Qqqqqq", category:"F", vendor:"H", date:"2026-01-25", amount:200, note:"", attachments:[]},
    ]);

    save(KEY_MONTHLY_REPORTS, []);
    clearDirty();
  }

  // ---------- computed ----------
  function tasksAll(){ return load(KEY_TASKS, []); }
  function tasksActive(){ return tasksAll().filter(t => !t.closed); }
  function paymentsAll(){ return load(KEY_PAYMENTS, []); }
  function expensesAll(){ return load(KEY_EXPENSES, []); }
  function expensesGeneral(){ return expensesAll().filter(e => e.scope==="general"); }
  function expensesForTask(taskId){ return expensesAll().filter(e => e.scope==="campaign" && e.campaignId===taskId); }

  function collectedCourse(){ return sum(paymentsAll().filter(p => p.status==="paid"), p=>p.amount); }
  function collectedForTask(taskId){ return sum(paymentsAll().filter(p => p.status==="paid" && p.fromTaskId===taskId), p=>p.amount); }

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
  window.openModal = openModal;
  window.closeModal = closeModal;

  // ---------- menu ----------
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
        go("home");
      };
    }
    if(logoutBtn){
      logoutBtn.onclick = ()=> location.href="/index.html";
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
  window.go = go;
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
  <div class="tes-campCard clickable" style="cursor:pointer" onclick="go('rendiciones','${x.id}')">
    <div class="tes-campHead">
      <div>
        <div class="tes-campTitle">${esc(x.title)}</div>
        <div class="tes-campDates">${esc(x.startDate||"")} → ${esc(x.dueDate||"")}</div>
      </div>
      ${miss?`<span class="tes-badgeWarn">⚠️ sin boleta ${miss}</span>`:""}
    </div>

    <div class="tes-metrics">
      <div class="tes-metricBox">
        <div class="tes-metricLbl">Recaudado</div>
        <div class="tes-metricVal">${clp(rec)}</div>
      </div>
      <div class="tes-metricBox">
        <div class="tes-metricLbl">Gastado</div>
        <div class="tes-metricVal">${clp(gas)}</div>
      </div>
      <div class="tes-metricBox tes-metricWide">
        <div class="tes-metricLbl">Saldo</div>
        <div class="tes-metricVal">${clp(s)}</div>
      </div>
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
  }

  // ---------- Rendiciones ----------
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

      <div class="card">
        <div class="kTitle">🏦 Fondo del curso (sin campaña)</div>
        <div class="muted" style="margin-top:6px;font-weight:900;">
          Gasto general sin campaña y de uso rápido del fondo del curso.
        </div>
        <div class="actions" style="margin-top:10px;">
          <button class="btnPrimaryMini" onclick="openCreateExpense('general','')">+ Agregar gasto general</button>
        </div>
        <div style="margin-top:10px;">
          ${expGen.length?expGen.map(renderExpenseCard).join(""):`<div class="muted">Sin gastos generales.</div>`}
        </div>
      </div>

      <div class="card">
        <div class="row">
          <div class="kTitle">🎯 Rendiciones por campaña</div>
          <div class="actions actionsRow">
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
  }

  function renderCampaignCard(task){
    const exp = expensesForTask(task.id);
    const rec = collectedForTask(task.id);
    const gas = sum(exp, e=>e.amount);
    const s = rec - gas;
    const miss = missingBoletaCount(exp);

    return `
      <div class="card" style="margin-top:12px;">
        <div class="row">
          <div>
            <div style="font-weight:950;">${esc(task.title)} <span class="pill" style="margin-left:8px;">Campaña</span></div>
            <div class="muted" style="margin-top:6px;font-weight:800;font-size:12px;">${task.startDate||""} → ${task.dueDate||""}</div>
            <div class="metricsRow"><span class="pill ok">Recaudado ${clp(rec)}</span>
              <span class="pill warn">Gastado ${clp(gas)}</span>
              <span class="pill ${s<0?'danger':''}">Saldo ${clp(s)}</span>
              ${miss?`<span class="pill danger">⚠️ sin boleta ${miss}</span>`:""}
            </div>
          </div>
          <div class="actions actionsRow">
            <button class="btnMini" onclick="openEditCampaign('${task.id}')">✏️ Editar campaña</button>
            <button class="btnPrimaryMini" onclick="openCreateExpense('campaign','${task.id}')">+ Agregar gasto</button>
          </div>
        </div>

        <div style="margin-top:10px;">
          ${exp.length?exp.map(renderExpenseCard).join(""):`<div class="muted">Sin rendiciones asociadas.</div>`}
        </div>
      </div>
    `;
  }

  function scopeLabel(e){ return e.scope==="general" ? "🏦 Fondo del curso" : "🎯 Campaña"; }

  function renderExpenseCard(e){
    const has = hasBoleta(e);
    const badge = has ? `<span class="pill ok">Con boleta</span>` : `<span class="pill danger">Sin boleta</span>`;

    const boletaButtons = has
      ? `<button class="btnMini" onclick="viewBoleta('${e.id}')">👁 Ver boleta</button>
         <button class="btnMini" onclick="replaceBoleta('${e.id}')">🔁 Reemplazar</button>`
      : `<button class="btnPrimaryMini" onclick="uploadBoleta('${e.id}')">📎 Subir boleta</button>`;

    // Nombre de campaña para "Rendición — Campaña"
    const campName = (e.scope==="campaign")
      ? (tasksAll().find(t=>t.id===e.campaignId)?.title || "Campaña")
      : "Fondo del curso";

    const desc = (e.note && String(e.note).trim()) ? String(e.note).trim() : "";

    return `
      <div class="expenseCard">
        <div class="expenseHeader">
          <div class="expenseTitle">Rendición — ${esc(campName)}</div>
          ${badge}
        </div>

        <div class="expenseBody">
          <div class="expenseItem">Ítem: <b>${esc(e.title)}</b></div>
          <div class="expenseMeta">Fecha rendición: ${esc(e.date||"")}</div>
          <div class="expenseMeta">Monto: <b>${clp(e.amount)}</b></div>
          ${desc ? `<div class="expenseMeta">Descripción: ${esc(desc)}</div>` : ``}
          <div class="expenseSubMeta">${esc(scopeLabel(e))} · ${esc(e.category||"Otros")} · ${esc(e.vendor||"—")}</div>
        </div>

        <div class="expenseActions actionBar">
          ${boletaButtons}
          <button class="btnMini" onclick="editExpense('${e.id}')">✏️ Editar</button>
          <button class="btnDangerMini" onclick="deleteExpense('${e.id}')">🗑️ Eliminar</button>
        </div>
      </div>
    `;
  }

  // ---------- Campaign edit ----------
  function openEditCampaign(taskId){
    const ts = tasksAll();
    const t = ts.find(x=>x.id===taskId);
    if(!t) return;

    openModal(`
      <div class="row">
        <div>
          <div style="font-weight:950;font-size:18px;">Editar campaña</div>
          <div class="muted" style="margin-top:6px;">Los cambios marcarán “Requiere nuevo informe”.</div>
        </div>
        <button class="btnMini" onclick="closeModal()">Cerrar</button>
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
        <button class="btnMini" onclick="closeModal()">Cancelar</button>
        <button class="btnPrimaryMini" onclick="saveEditCampaign('${taskId}')">Guardar</button>
      </div>
    `);
  }

  function saveEditCampaign(taskId){
    const ts = tasksAll();
    const i = ts.findIndex(x=>x.id===taskId);
    if(i<0) return;

    ts[i].title = ($("ec_title").value||"").trim() || ts[i].title;
    ts[i].startDate = $("ec_start").value || ts[i].startDate;
    ts[i].dueDate = $("ec_due").value || ts[i].dueDate;

    save(KEY_TASKS, ts);
    markDirty();
    closeModal();
    renderRendiciones(taskId);
  }

  // ---------- Expense create/edit/delete + boleta ----------
  let draft = null;

  function openCreateExpense(scope, taskId){
    draft = { scope, campaignId: (scope==="campaign"?taskId:null), attached:false };

    const taskOptions = tasksActive().map(t=>`<option value="${t.id}" ${t.id===taskId?"selected":""}>${esc(t.title)}</option>`).join("");

    openModal(`
      <div class="row">
        <div>
          <div style="font-weight:950;font-size:18px;">Agregar gasto</div>
          <div class="muted" style="margin-top:6px;">Puedes adjuntar boleta ahora o después.</div>
        </div>
        <button class="btnMini" onclick="closeModal()">Cerrar</button>
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

      <div class="card" style="background:#f8fafc;">
        <div style="font-weight:950;">📎 Boleta</div>
        <div class="muted" style="margin-top:6px;">Si no adjuntas, quedará como pendiente.</div>
        <button class="btnMini" id="btn_attach" style="margin-top:10px;">Adjuntar boleta (demo)</button>
        <div id="attach_state" class="muted" style="margin-top:6px;font-size:12px;">Sin boleta</div>
      </div>

      <div class="actions" style="margin-top:14px;justify-content:flex-end;">
        <button class="btnMini" onclick="closeModal()">Cancelar</button>
        <button class="btnPrimaryMini" onclick="saveExpense()">Guardar</button>
      </div>
    `);

    $("ex_scope").onchange = ()=>{
      const v = $("ex_scope").value;
      $("ex_campaign_wrap").style.display = (v==="campaign")?"block":"none";
    };
    $("btn_attach").onclick = ()=>{
      draft.attached = true;
      $("attach_state").textContent = "Boleta adjunta (demo)";
    };
  }

  function saveExpense(){
    const scope = $("ex_scope").value;
    const title = ($("ex_title").value||"").trim();
    const amount = Number($("ex_amount").value||0);
    if(!title || !amount){ alert("Completa concepto y monto."); return; }

    const ex = expensesAll();
    ex.unshift({
      id: uid("e"),
      scope,
      campaignId: scope==="campaign" ? $("ex_campaign").value : null,
      title,
      category: ($("ex_cat").value||"").trim(),
      vendor: ($("ex_vendor").value||"").trim(),
      date: $("ex_date").value||todayISO(),
      amount,
      note: "",
      attachments: draft && draft.attached ? [{name:"boleta.jpg"}] : []
    });

    save(KEY_EXPENSES, ex);
    markDirty();
    closeModal();
    renderRendiciones(scope==="campaign"?$("ex_campaign").value:"");
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
        <button class="btnMini" onclick="closeModal()">Cerrar</button>
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
        <button class="btnMini" onclick="closeModal()">Cancelar</button>
        <button class="btnPrimaryMini" onclick="saveEditExpense('${expenseId}')">Guardar</button>
      </div>
    `);
  }

  function saveEditExpense(expenseId){
    if(!confirm("Guardar cambios y marcar “Requiere nuevo informe”?")) return;

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

  function viewBoleta(expenseId){
    const ex = expensesAll();
    const e = ex.find(x=>x.id===expenseId);
    if(!e || !hasBoleta(e)){ alert("No hay boleta adjunta."); return; }
    alert("Ver boleta (demo). Aquí se abriría la imagen/PDF.");
  }

  // ---------- Informes ----------
  function renderInformes(){
    const reps = load(KEY_MONTHLY_REPORTS, []);
    app.innerHTML = `
      ${isDirty()?`<div class="alertBox">📄 Cambios detectados: requiere nuevo informe</div>`:""}
      <div class="card">
        <div class="kTitle">📊 Informes</div>
        <div class="muted" style="margin-top:6px;">Si editas o eliminas rendiciones, debes emitir un nuevo informe.</div>

        <div class="actions" style="margin-top:12px;">
          <button class="btnPrimaryMini" onclick="generateMonthly()">Generar informe mensual (demo)</button>
          <button class="btnMini" onclick="clearDirty();renderInformes()">Marcar como resuelto</button>
        </div>

        <div style="margin-top:12px;">
          ${reps.length
            ? reps.map(r=>`<div class="card" style="margin-top:10px;"><b>${esc(r.period)}</b><div class="muted">Emitido ${esc(r.generatedAt)}</div></div>`).join("")
            : `<div class="muted">Sin informes generados.</div>`
          }
        </div>
      </div>
    `;
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

  // ---------- expose handlers ----------
  window.openCreateExpense = openCreateExpense;
  window.saveExpense = saveExpense;
  window.editExpense = editExpense;
  window.saveEditExpense = saveEditExpense;
  window.deleteExpense = deleteExpense;
  window.uploadBoleta = uploadBoleta;
  window.replaceBoleta = replaceBoleta;
  window.viewBoleta = viewBoleta;
  window.openEditCampaign = openEditCampaign;
  window.saveEditCampaign = saveEditCampaign;
  window.generateMonthly = generateMonthly;

  // ---------- Boot ----------
  // ----- boot -----
// ✅ Seed demo SOLO si está activado globalmente (core.js) o por URL (?demo=1)
const DEMO_SEED = (
  (window.CURSAPP && window.CURSAPP.DEMO_MODE === true) ||
  (new URLSearchParams(location.search).get("demo") === "1") ||
  (localStorage.getItem("cursapp_demo_mode") === "1")
);
if (DEMO_SEED) ensureDemo();

initMenu();
go("home");

})();
