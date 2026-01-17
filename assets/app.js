/* ========= Cursapp · app.js (ESTABLE + PAGOS + CREAR COBRO) ========= */

const KEY_USER = "cursapp_demo_user";
const KEY_PAYMENTS = "cursapp_payments_v1";
const KEY_RECEIPTS = "cursapp_receipts_v1";
const KEY_TASKS = "cursapp_tasks_v1";

/* ---------- helpers ---------- */
function formatCLP(v){ return '$' + Number(v||0).toLocaleString('es-CL'); }
function formatCLPNoSign(v){ return Number(v||0).toLocaleString("es-CL"); }
function uid(prefix="id"){ return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`; }
function isoDate(){ return new Date().toISOString(); }
function monthKey(dateStr){
  // YYYY-MM from YYYY-MM-DD
  if(!dateStr || dateStr.length < 7) return "";
  return dateStr.slice(0,7);
}

function todayISO(){ return new Date().toISOString().slice(0,10); }
function daysTo(dueDate){
  if(!dueDate) return null;
  const a = new Date(todayISO() + "T00:00:00");
  const b = new Date(dueDate + "T00:00:00");
  return Math.round((b - a) / (1000*60*60*24));
}
function dueBadge(dueDate){
  const d = daysTo(dueDate);
  if(d === null) return "";
  if(d < 0) return `<span class="tag danger">🔴 Vencido</span>`;
  if(d === 0) return `<span class="tag warn">🟡 Vence hoy</span>`;
  const daysText = (d === 1) ? "Queda 1 día" : `Quedan ${d} días`;
  if(d <= 5) return `<span class="tag warn">🟡 Por vencer · ${daysText}</span>`;
  return `<span class="tag">🟢 ${daysText}</span>`;
}


function getUser(){ return JSON.parse(localStorage.getItem(KEY_USER) || "null"); }
function isDirectiva(role){ return role === "tesorero" || role === "presidente"; }
function logout(){
  localStorage.removeItem(KEY_USER);
  window.location.href = "login.html";
}

/* ---------- storage ---------- */
function loadPayments(){ return JSON.parse(localStorage.getItem(KEY_PAYMENTS) || "[]"); }
function savePayments(p){ localStorage.setItem(KEY_PAYMENTS, JSON.stringify(p)); }

function loadReceipts(){ return JSON.parse(localStorage.getItem(KEY_RECEIPTS) || "[]"); }
function saveReceipts(r){ localStorage.setItem(KEY_RECEIPTS, JSON.stringify(r)); }


function findTaskById(id){
  return loadTasks().find(t => t.id === id) || null;
}
function taskTypeLabel(task){
  if(!task) return "";
  return task.type === "monthly" ? "Pago mensual" : "Pago único";
}
function cleanConcept(concept){
  return String(concept||"").replace(/\s\(\d{4}-\d{2}\)\s*$/,"");
}
function paymentUrgencyRank(p){
  if(p.status === "paid") return 4;
  const d = p.dueDate ? daysTo(p.dueDate) : null;
  if(d === null) return 3;
  if(d < 0) return 0;
  if(d === 0) return 1;
  return 2;
}
function comparePayments(a,b){
  const ra = paymentUrgencyRank(a), rb = paymentUrgencyRank(b);
  if(ra !== rb) return ra - rb;
  const da = a.dueDate ? daysTo(a.dueDate) : 99999;
  const db = b.dueDate ? daysTo(b.dueDate) : 99999;
  if(da !== db) return da - db;
  return String(a.concept||"").localeCompare(String(b.concept||""));
}
function studentsCount(){
  return new Set(loadPayments().map(p=>p.alumno)).size || 1;
}
function taskStats(taskId){
  const pays = loadPayments().filter(p=>p.fromTaskId===taskId);
  const paid = pays.filter(p=>p.status==="paid");
  const pend = pays.filter(p=>p.status!=="paid");
  const overdue = pend.filter(p=>p.dueDate && daysTo(p.dueDate) < 0);
  const dueSoon = pend.filter(p=>p.dueDate && daysTo(p.dueDate) >= 0 && daysTo(p.dueDate) <= 5);
  return {
    paidCount: paid.length,
    pendingCount: pend.length,
    overdueCount: overdue.length,
    dueSoonCount: dueSoon.length,
    recaudado: paid.reduce((a,b)=>a+Number(b.amount||0),0),
  };
}
function taskMeta(task){
  return Number(task.amount||0) * studentsCount();
}
function taskProgress(task){
  const stats = taskStats(task.id);
  const meta = taskMeta(task);
  const pct = meta ? Math.round((stats.recaudado/meta)*100) : 0;
  return { stats, meta, pct };
}

function isTaskClosed(task){
  return !!(task && (task.status === "closed" || task.closedAt));
}
function markTaskClosed(taskId, closedBy, closeReason){
  const tasks = loadTasks();
  const idx = tasks.findIndex(t=>t.id===taskId);
  if(idx<0) return;
  tasks[idx].status = "closed";
  tasks[idx].closedAt = isoDate();
  tasks[idx].closedBy = closedBy;        // "auto" | "manual"
  tasks[idx].closeReason = closeReason;  // "completed_100" | "expired"
  saveTasks(tasks);
}
function taskIsExpired(task){
  if(!task || !task.dueDate) return false;
  const d = daysTo(task.dueDate);
  return d !== null && d < 0;
}
function ensureAutoClose(task){
  if(!task || isTaskClosed(task)) return;
  const pr = taskProgress(task);
  if(pr.pct >= 100){
    markTaskClosed(task.id, "auto", "completed_100");
  }
}
function activeTasks(){
  return loadTasks().filter(t=>!isTaskClosed(t));
}
function closedTasks(limit=3){
  return loadTasks().filter(t=>isTaskClosed(t)).slice(0,limit);
}

function listTasksSorted(limit=3){
  const tasks = loadTasks().slice();
  tasks.sort((a,b)=>{
    const da = a.dueDate ? daysTo(a.dueDate) : null;
    const db = b.dueDate ? daysTo(b.dueDate) : null;
    const ra = (da===null)?3:(da<0?0:(da===0?1:2));
    const rb = (db===null)?3:(db<0?0:(db===0?1:2));
    if(ra!==rb) return ra-rb;
    if(da!==null && db!==null && da!==db) return da-db;
    return String(b.createdAt||"").localeCompare(String(a.createdAt||""));
  });
  return tasks.slice(0,limit);
}
function setSelectedTask(id){ localStorage.setItem("cursapp_selected_task", id||""); }
function getSelectedTask(){ return localStorage.getItem("cursapp_selected_task") || ""; }
function clearSelectedTask(){ localStorage.removeItem("cursapp_selected_task"); }
function loadTasks(){ return JSON.parse(localStorage.getItem(KEY_TASKS) || "[]"); }
function saveTasks(t){ localStorage.setItem(KEY_TASKS, JSON.stringify(t)); }

function getReceiptByPaymentId(pid){
  return loadReceipts().find(r => r.paymentId === pid) || null;
}
function upsertReceipt(receipt){
  const list = loadReceipts().filter(r => r.paymentId !== receipt.paymentId);
  list.unshift(receipt);
  saveReceipts(list);
}

/* ---------- seed demo payments ---------- */
function ensureSeedPayments(){
  const existing = loadPayments();
  if(existing && existing.length) return;

  const seed = [
    { id: uid("pay"), alumno:"Hermano 1", apoderadoRole:"apoderado", concept:"Cuota Marzo", amount:20000, status:"paid" },
    { id: uid("pay"), alumno:"Hermano 1", apoderadoRole:"apoderado", concept:"Cuota Abril", amount:30000, status:"pending" },
    { id: uid("pay"), alumno:"Hermano 2", apoderadoRole:"apoderado", concept:"Cuota Marzo", amount:20000, status:"pending" },

    { id: uid("pay"), alumno:"Ana Soto (Hija)", apoderadoRole:"apoderado_other", concept:"Cuota Abril", amount:12000, status:"pending" },
    { id: uid("pay"), alumno:"Carlos Díaz (Hijo)", apoderadoRole:"apoderado_other", concept:"Cuota Abril", amount:12000, status:"paid" },
    { id: uid("pay"), alumno:"María Pérez (Hija)", apoderadoRole:"apoderado_other", concept:"Cuota Abril", amount:12000, status:"pending" },
  ];

  savePayments(seed);

  seed.filter(p => p.status === "paid").forEach(p => {
    if(!getReceiptByPaymentId(p.id)){
      upsertReceipt({
        id: uid("rc"),
        paymentId: p.id,
        alumno: p.alumno,
        concept: p.concept,
        amount: p.amount,
        method: "Conciliación inicial (Demo)",
        ref: "SEED",
        note: "Pago seed",
        paidAt: isoDate()
      });
    }
  });
}

/* ---------- UI components ---------- */
function tabbar(active){
  return `
    <nav class="tabbar">
      <button class="tab ${active==="home"?"active":""}" onclick="goTab('home')">
        <span class="ico">🏠</span><span>Inicio</span>
      </button>
      <button class="tab ${active==="payments"?"active":""}" onclick="goTab('payments')">
        <span class="ico">💳</span><span>Pagos</span>
      </button>
      <button class="tab ${active==="withdraws"?"active":""}" onclick="goTab('withdraws')">
        <span class="ico">🏦</span><span>Retiros</span>
      </button>
    </nav>
  `;
}

function kpiCard(icon, label, value){
  return `
    <div class="card">
      <div class="kpiHead">
        <span class="kpiIcon">${icon}</span>
        <span class="kpiLabel">${label}</span>
      </div>
      <div class="kpi">${value}</div>
    </div>
  `;
}

function viewShell(title, subtitle, body, tab){
  const app = document.getElementById("app");
  if(!app) return;
  app.innerHTML = `
    <h1>${title}</h1>
    <p class="muted">${subtitle}</p>
    ${body}
    ${tabbar(tab)}
    <div id="modalRoot"></div>
  `;
}

/* ---------- summaries ---------- */
function getVisiblePayments(role){
  const payments = loadPayments();
  return isDirectiva(role)
    ? payments
    : payments.filter(p => p.apoderadoRole === "apoderado");
}

function computeSummary(role){
  const visible = getVisiblePayments(role);
  const collected = visible.filter(p=>p.status==="paid").reduce((a,b)=>a+Number(b.amount||0),0);
  const pending = visible.filter(p=>p.status!=="paid").reduce((a,b)=>a+Number(b.amount||0),0);
  const alumnos = new Set(visible.map(p=>p.alumno)).size;
  return { collected, pending, alumnos };
}

function pendingMy(){
  const mine = loadPayments().filter(p => p.apoderadoRole === "apoderado");
  const pending = mine.filter(p => p.status !== "paid");
  const total = pending.reduce((a,b)=>a+Number(b.amount||0),0);
  return { count: pending.length, amount: total };
}

function listMyStudents(){
  const mine = loadPayments().filter(p => p.apoderadoRole === "apoderado");
  return [...new Set(mine.map(p=>p.alumno))];
}

function coursePending(){
  const all = loadPayments();
  const pending = all.filter(p=>p.status!=="paid");
  return {
    count: pending.length,
    amount: pending.reduce((a,b)=>a+Number(b.amount||0),0)
  };
}

function topPendingList(limit=5){
  return loadPayments().filter(p=>p.status!=="paid").slice(0,limit);
}

/* ---------- payments list ---------- */
function renderPaymentsList(role){
  const payments = loadPayments();
  const visible = isDirectiva(role)
    ? payments
    : payments.filter(p => p.apoderadoRole === "apoderado");
  visible.sort(comparePayments);

  const groups = {};
  visible.forEach(p => {
    groups[p.alumno] = groups[p.alumno] || [];
    groups[p.alumno].push(p);
  });

  const alumnoNames = Object.keys(groups);
  if(!alumnoNames.length){
    return `<div class="card"><div class="muted">Sin pagos.</div></div>`;
  }

  return alumnoNames.map(al => {
    const rows = groups[al].map(p => paymentRow(role, p)).join("");
    return `
      <div class="card" style="margin-top:12px;">
        <div style="font-weight:900; margin-bottom:8px;">${al}</div>
        ${rows}
      </div>
    `;
  }).join("");
}

function paymentRow(role, p){
  const paid = p.status === "paid";
  const tag = paid
    ? `<span class="tag ok">Pagado</span>`
    : `<span class="tag warn">Pendiente</span>`;

  const receipt = getReceiptByPaymentId(p.id);

  let action = `<span class="muted">—</span>`;

  if(isDirectiva(role)){
    if(!paid){
      action = `<button class="btn ghost" onclick="openRecon('${p.id}')">Conciliar</button>`;
    } else if(receipt){
      action = `<button class="btn ghost" onclick="openReceipt('${p.id}')">Comprobante</button>`;
    }
  } else {
    if(!paid){
      action = `<button class="btn primary" onclick="openPay('${p.id}')">Pagar</button>`;
    } else if(receipt){
      action = `<button class="btn ghost" onclick="openReceipt('${p.id}')">Comprobante</button>`;
    }
  }

  const task = p.fromTaskId ? findTaskById(p.fromTaskId) : null;
  const typeTag = task ? `<span class="tag">${taskTypeLabel(task)}</span>` : ``;
  const meta = (p.dueDate || task)
    ? `<div style="margin-top:6px; display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
        ${p.dueDate ? dueBadge(p.dueDate) : ``}
       </div>`
    : ``;

  return `
    <div style="display:flex; justify-content:space-between; gap:12px; padding:10px 0; border-top:1px solid rgba(229,231,235,.6);">
      <div style="min-width:0;">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:2px;">${typeTag}<div style="font-weight:800;">${cleanConcept(p.concept)}</div></div>
        <div class="muted">${formatCLP(p.amount)}</div>
        ${meta}
      </div>
      <div style="display:flex; align-items:center; gap:10px; flex-shrink:0;">
        ${tag}
        ${action}
      </div>
    </div>
  `;
}

/* ---------- actions: pay / recon / receipt ---------- */
function openPay(paymentId){
  const p = loadPayments().find(x => x.id === paymentId);
  if(!p) return;

  p.status = "paid";
  savePayments(loadPayments().map(x => x.id===p.id ? p : x));

  upsertReceipt({
    id: uid("rc"),
    paymentId: p.id,
    alumno: p.alumno,
    concept: p.concept,
    amount: p.amount,
    method: "Webpay (Demo)",
    ref: uid("trx"),
    note: "Pago automático (demo)",
    paidAt: isoDate()
  });

  alert("Pago aprobado (demo). Comprobante generado.");
  goTab("payments");
}

function openRecon(paymentId){
  const p = loadPayments().find(x => x.id === paymentId);
  if(!p) return;

  const ref = prompt("Ingresa folio / referencia (obligatorio):");
  if(!ref) return;

  p.status = "paid";
  savePayments(loadPayments().map(x => x.id===p.id ? p : x));

  upsertReceipt({
    id: uid("rc"),
    paymentId: p.id,
    alumno: p.alumno,
    concept: p.concept,
    amount: p.amount,
    method: "Conciliación manual",
    ref,
    note: "Conciliación (demo)",
    paidAt: isoDate()
  });

  alert("Conciliado (demo). Comprobante generado.");
  goTab("payments");
}

function openReceipt(paymentId){
  const r = getReceiptByPaymentId(paymentId);
  if(!r){ alert("No hay comprobante."); return; }

  const html = `
  <html lang="es"><head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width,initial-scale=1"/>
    <title>Comprobante</title>
    <style>
      body{font-family:system-ui,-apple-system;background:#f5f7fb;margin:0;padding:16px}
      .card{background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:16px;max-width:560px;margin:0 auto}
      .muted{color:#64748b;font-size:13px}
      .row{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:10px}
      .k{color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:.04em;font-weight:800}
      .v{font-weight:900}
      button{border:none;padding:10px 12px;border-radius:12px;background:#5b5ce2;color:#fff;font-weight:800;width:100%;margin-top:14px}
    </style>
  </head><body>
    <div class="card">
      <h1 style="margin:0 0 6px;">Comprobante</h1>
      <div class="muted">ID: ${r.id}</div>
      <div class="row"><div><div class="k">Alumno</div><div class="v">${r.alumno}</div></div><div><div class="k">Monto</div><div class="v">${formatCLP(r.amount)}</div></div></div>
      <div class="row"><div><div class="k">Concepto</div><div class="v">${r.concept}</div></div><div><div class="k">Método</div><div class="v">${r.method}</div></div></div>
      <div class="row"><div><div class="k">Ref</div><div class="v">${r.ref || "-"}</div></div><div><div class="k">Fecha</div><div class="v">${new Date(r.paidAt).toLocaleString("es-CL")}</div></div></div>
      <div class="row"><div><div class="k">Nota</div><div class="v">${r.note || "-"}</div></div></div>
      <button onclick="window.print()">Imprimir / Guardar PDF</button>
    </div>
  </body></html>`;

  const w = window.open("", "_blank");
  if(!w){ alert("Popup bloqueado"); return; }
  w.document.open(); w.document.write(html); w.document.close();
}

/* ---------- Crear cobro (Presidente) ---------- */
function openCreateCobro(){
  const root = document.getElementById("modalRoot");
  if(!root) return;

  root.innerHTML = `
    <div style="position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:10000;display:flex;align-items:flex-end;justify-content:center;padding:14px;">
      <div class="card" style="width:min(620px,100%);margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;">
          <div>
            <div style="font-weight:950;font-size:18px;">Crear cobro (para todos)</div>
            <div class="muted">Se creará para todos los apoderados del curso.</div>
          </div>
          <button class="btn ghost" onclick="closeModal()">Cerrar</button>
        </div>

        <div style="margin-top:12px;">
          <label style="font-weight:800;">Título</label>
          <input id="tTitle" placeholder="Ej: Cuota Mayo / Fondo emergencia" />
        </div>

        <div style="display:flex;gap:10px;margin-top:12px;flex-wrap:wrap;">
          <div style="flex:1;min-width:180px;">
            <label style="font-weight:800;">Fecha inicio</label>
            <input id="tStart" type="date" />
          </div>
          <div style="flex:1;min-width:180px;">
            <label style="font-weight:800;">Fecha límite</label>
            <input id="tDue" type="date" />
          </div>
        </div>

        <div style="display:flex;gap:10px;margin-top:12px;flex-wrap:wrap;">
          <div style="flex:1;min-width:180px;">
            <label style="font-weight:800;">Monto</label>
            <input id="tAmount" inputmode="numeric" placeholder="Ej: 12000" />
          </div>
          <div style="flex:1;min-width:180px;">
            <label style="font-weight:800;">Tipo</label>
            <select id="tType">
              <option value="once">Único</option>
              <option value="monthly">Mensual</option>
            </select>
          </div>
        </div>

        <div class="actions" style="justify-content:flex-end;margin-top:14px;">
          <button class="btn ghost" onclick="closeModal()">Cancelar</button>
          <button class="btn primary" onclick="createCobro()">Crear cobro</button>
        </div>
      </div>
    </div>
  `;
}

function closeModal(){
  const root = document.getElementById("modalRoot");
  if(root) root.innerHTML = "";
}

function createCobro(){
  const title = (document.getElementById("tTitle")?.value || "").trim();
  const startDate = document.getElementById("tStart")?.value || "";
  const dueDate = document.getElementById("tDue")?.value || "";
  const amount = Number((document.getElementById("tAmount")?.value || "").trim());
  const type = document.getElementById("tType")?.value || "once";

  if(!title || !startDate || !dueDate || !amount || amount <= 0){
    alert("Completa título, fechas y monto.");
    return;
  }

  // Guardar tarea
  const tasks = loadTasks();
  const task = {
    id: uid("task"),
    title,
    startDate,
    dueDate,
    amount,
    type,
    createdAt: isoDate(),
    target: "all"
  };
  tasks.unshift(task);
  saveTasks(tasks);

  // Generar cobros para TODOS los alumnos (todos los apoderados)
  generatePaymentsForTask(task);

  closeModal();
  alert("Cobro creado para todos (demo).");
  goTab("payments");
}

function loadTasks(){ return JSON.parse(localStorage.getItem(KEY_TASKS) || "[]"); }
function saveTasks(t){ localStorage.setItem(KEY_TASKS, JSON.stringify(t)); }

function generatePaymentsForTask(task){
  let payments = loadPayments();

  // Lista de alumnos existentes (esto representa a todos los apoderados del curso)
  const alumnos = [...new Set(payments.map(p => `${p.alumno}|||${p.apoderadoRole}`))].map(s=>{
    const [alumno, apoderadoRole] = s.split("|||");
    return { alumno, apoderadoRole };
  });

  // Mensual: añadimos un sufijo para distinguir el periodo
  const concept =
    task.type === "monthly"
      ? `${task.title} (${monthKey(task.dueDate)})`
      : task.title;

  alumnos.forEach(a=>{
    const exists = payments.some(p =>
      p.alumno === a.alumno &&
      p.concept === concept &&
      p.dueDate === task.dueDate
    );
    if(exists) return;

    payments.unshift({
      id: uid("pay"),
      alumno: a.alumno,
      apoderadoRole: a.apoderadoRole,
      concept,
      amount: task.amount,
      status: "pending",
      startDate: task.startDate,
      dueDate: task.dueDate,
      createdAt: isoDate(),
      fromTaskId: task.id
    });
  });

  savePayments(payments);
}

/* ---------- views ---------- */
function renderApoderado(tab){
  if(tab === "home"){
    const { count, amount } = pendingMy();
    const recaudadoCurso = loadPayments().filter(p=>p.status==="paid").reduce((a,b)=>a+Number(b.amount||0),0);
    const students = listMyStudents();

    const body = `
      ${kpiCard("⏳","Cuotas pendientes", `${formatCLPNoSign(amount)} · ${count} cuotas pendientes`)}
      <button class="btn primary" style="width:100%; margin-top:10px;" onclick="goTab('payments')">Ver pagos</button>

      <div style="margin-top:12px;">
        ${kpiCard("💰","Recaudación del curso", formatCLP(recaudadoCurso))}
      </div>

      <div class="card" style="margin-top:12px;">
        <div class="kpiHead">
          <span class="kpiIcon">🎓</span>
          <span class="kpiLabel">Mis estudiantes</span>
        </div>
        ${students.map(n=>`<div style="font-weight:800; padding:10px 0; border-top:1px solid rgba(229,231,235,.6);">${n}</div>`).join("")}
      </div>
    `;

    viewShell("Apoderado","2°B 2026 · Colegio X", body, tab);
    return;
  }

  const body =
    tab==="payments"
      ? `${renderPaymentsList("apoderado")}`
      : `<div class="card"><div class="kpiLabel">Retiros</div><div class="muted">Apoderado: lectura/votación (demo).</div></div>`;

  viewShell("Apoderado","2°B 2026 · Colegio X", body, tab);
}

function renderTesorero(tab){
  if(tab === "home"){
    const sum = computeSummary("tesorero");
    const pend = coursePending();
    const tasks = listTasksSorted(3);

    const tasksHtml = tasks.map(t=>{
      const pr = taskProgress(t);
      const pct = Math.max(0, Math.min(100, pr.pct));
      const title = t.type==="monthly" ? `${t.title} (${monthKey(t.dueDate)})` : t.title;
      return `
        <div class="card" style="margin-top:12px;">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap;">
            <div>
              <div style="font-weight:950;">${title}</div>
              <div class="muted">${pct}% recaudado · ${formatCLP(pr.stats.recaudado)} de ${formatCLP(pr.meta)}</div>
              <div style="margin-top:6px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
                ${t.dueDate ? dueBadge(t.dueDate) : ``}
                <span class="tag">${taskTypeLabel(t)}</span>
              </div>
            </div>
            <button class="btn ghost" onclick="setSelectedTask('${t.id}');goTab('payments')">Ver detalle</button>
          </div>

          <div class="bar" style="margin-top:10px;">
            <div class="barFill primary" style="width:${pct}%"></div>
          </div>

          <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">
            <span class="tag ok">🟢 ${pr.stats.paidCount} pagadas</span>
            <span class="tag warn">🟡 ${pr.stats.dueSoonCount} por vencer</span>
            <span class="tag danger">🔴 ${pr.stats.overdueCount} vencidas</span>
          </div>
        </div>
      `;
    }).join("");

    const body = `
      ${kpiCard("💰","Recaudación del curso", formatCLP(sum.collected))}
      ${kpiCard("⏳","Cuotas pendientes", `${formatCLP(pend.amount)} · ${pend.count} pendientes`)}
      ${tasksHtml || `<div class="card" style="margin-top:12px;"><div class="muted">Aún no hay cobros creados.</div></div>`}
    `;

    viewShell("Tesorero","Administración del curso", body, tab);

    return;
  }

  const body =
    tab==="payments"
      ? `${renderTesoreroPayments()}`
      : `<div class="card"><div class="kpiLabel">Retiros</div><div class="muted">Tesorero: gestiona retiros (demo).</div></div>`;

  viewShell("Tesorero","Administración del curso", body, tab);
}

function renderPresidente(tab){
  if(tab === "home"){
    const sum = computeSummary("presidente");
    const pend = coursePending();

    const body = `
      ${kpiCard("💰","Recaudación del curso", formatCLP(sum.collected))}
      ${kpiCard("⏳","Pendiente del curso", `${formatCLP(pend.amount)} · ${pend.count} pendientes`)}

      <button class="btn primary" style="width:100%; margin-top:10px;" onclick="openCreateCobro()">Crear cobro</button>

      <div class="card" style="margin-top:12px;">
        <div class="kpiHead">
          <span class="kpiIcon">🎯</span>
          <span class="kpiLabel">Campañas</span>
        </div>
        ${renderPresidenteCampaigns()}
      </div>
    `;

    viewShell("Presidente","Administración del curso", body, tab);


    return;
  }

  const body =
    tab==="payments"
      ? `${renderPresidentePayments()}`
      : `<div class="card"><div class="kpiLabel">Retiros</div><div class="muted">Presidente: cierra votación (demo).</div></div>`;

  viewShell("Presidente","Administración del curso", body, tab);
}


function renderTesoreroPayments(){
  const taskId = getSelectedTask();
  if(!taskId) return renderPaymentsList("tesorero");
  const task = findTaskById(taskId);
  const pays = loadPayments().filter(p=>p.fromTaskId===taskId).slice().sort(comparePayments);
  const groups = {};
  pays.forEach(p=>{ groups[p.alumno]=groups[p.alumno]||[]; groups[p.alumno].push(p); });
  const names = Object.keys(groups);

  const header = `
    <div class="card" style="margin-top:12px;">
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;">
        <div>
          <div style="font-weight:950;">${task ? task.title : "Detalle de tarea"}</div>
          <div class="muted">Pagos por alumno / cuota</div>
        </div>
        <button class="btn ghost" onclick="clearSelectedTask();goTab('payments')">Volver</button>
      </div>
    </div>
  `;

  const blocks = names.map(n=>{
    const rows = groups[n].map(p=>paymentRow("tesorero", p)).join("");
    return `<div class="card" style="margin-top:12px;"><div style="font-weight:900;margin-bottom:8px;">${n}</div>${rows}</div>`;
  }).join("");

  return header + blocks;
}


function closeCampaign(taskId){
  const task = findTaskById(taskId);
  if(!task) return;

  ensureAutoClose(task);
  if(isTaskClosed(task)){
    alert("Esta campaña ya está cerrada.");
    return;
  }

  const pr = taskProgress(task);
  if(pr.pct >= 100){
    markTaskClosed(taskId, "auto", "completed_100");
    alert("Campaña cerrada automáticamente (100%).");
    goTab('home');
    return;
  }

  if(!taskIsExpired(task)){
    alert("Solo puedes cerrar manualmente cuando la campaña está expirada.");
    return;
  }

  if(!confirm("¿Cerrar campaña por expiración? (no alcanzó 100%)")) return;
  markTaskClosed(taskId, "manual", "expired");
  alert("Campaña cerrada (expirada).");
  goTab('home');
}

function renderPresidenteCampaigns(){
  const tasks = loadTasks().slice();
  tasks.forEach(t=>ensureAutoClose(t));

  tasks.sort((a,b)=>{
    const da = a.dueDate ? daysTo(a.dueDate) : null;
    const db = b.dueDate ? daysTo(b.dueDate) : null;
    const ra = (da===null)?3:(da<0?0:(da===0?1:2));
    const rb = (db===null)?3:(db<0?0:(db===0?1:2));
    if(ra!==rb) return ra-rb;
    if(da!==null && db!==null && da!==db) return da-db;
    return String(b.createdAt||"").localeCompare(String(a.createdAt||""));
  });

  const top = tasks.slice(0,3);
  if(!top.length){
    return `<div class="muted" style="margin-top:10px;">Aún no hay campañas.</div>`;
  }

  return top.map(t=>{
    const pr = taskProgress(t);
    const pct = Math.max(0, Math.min(100, pr.pct));
    const closed = isTaskClosed(t);
    const canManualClose = (!closed && taskIsExpired(t) && pct < 100);

    return `
      <div class="card" style="margin-top:12px;">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap;">
          <div>
            <div style="font-weight:950;">${cleanConcept(t.title)}</div>
            <div class="muted">${pct}% recaudado · ${formatCLP(pr.stats.recaudado)} de ${formatCLP(pr.meta)}</div>
            <div style="margin-top:6px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
              ${t.dueDate ? dueBadge(t.dueDate) : ``}
              <span class="tag">${taskTypeLabel(t)}</span>
              ${closed ? `<span class="tag">Cerrada</span>` : `<span class="tag ok">Activa</span>`}
            </div>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn ghost" onclick="setSelectedTask('${t.id}');goTab('payments')">Ver detalle</button>
            ${canManualClose ? `<button class="btn ghost" onclick="closeCampaign('${t.id}')">Cerrar</button>` : ``}
          </div>
        </div>

        <div class="bar" style="margin-top:10px;">
          <div class="barFill primary" style="width:${pct}%"></div>
        </div>

        <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">
          <span class="tag ok">🟢 ${pr.stats.paidCount} pagadas</span>
          <span class="tag warn">🟡 ${pr.stats.dueSoonCount} por vencer</span>
          <span class="tag danger">🔴 ${pr.stats.overdueCount} vencidas</span>
        </div>
      </div>
    `;
  }).join("");
}


function paymentBucket(p){
  if(p.status === "paid") return "paid";
  const d = p.dueDate ? daysTo(p.dueDate) : null;
  if(d === null) return "nodue";
  if(d < 0) return "overdue";
  if(d === 0) return "today";
  if(d <= 5) return "soon";
  return "ok";
}
function bucketLabel(key){
  if(key==="overdue") return "🔴 Morosos (vencidos)";
  if(key==="today") return "🟡 Vence hoy";
  if(key==="soon") return "🟡 Por vencer";
  if(key==="ok") return "🟢 Al día";
  if(key==="nodue") return "🟦 Sin fecha";
  if(key==="paid") return "✅ Pagados";
  return key;
}

function renderPresidentePayments(){
  const taskId = getSelectedTask();
  if(!taskId) return renderPaymentsList("presidente");

  const task = findTaskById(taskId);
  if(!task){
    clearSelectedTask();
    return renderPaymentsList("presidente");
  }

  ensureAutoClose(task);
  const pr = taskProgress(task);
  const pct = Math.max(0, Math.min(100, pr.pct));
  const closed = isTaskClosed(task);
  const canManualClose = (!closed && taskIsExpired(task) && pct < 100);

  const header = `
    <div class="card" style="margin-top:12px;">
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;">
        <div>
          <div style="font-weight:950;">${task.title}</div>
          <div class="muted">${pct}% recaudado · ${formatCLP(pr.stats.recaudado)} de ${formatCLP(pr.meta)}</div>
          <div style="margin-top:6px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
            ${task.dueDate ? dueBadge(task.dueDate) : ``}
            <span class="tag">${taskTypeLabel(task)}</span>
            ${closed ? `<span class="tag">Cerrada</span>` : `<span class="tag ok">Activa</span>`}
          </div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          ${canManualClose ? `<button class="btn ghost" onclick="closeCampaign('${task.id}')">Cerrar campaña</button>` : ``}
          <button class="btn ghost" onclick="clearSelectedTask();goTab('home')">Volver</button>
        </div>
      </div>
      <div class="bar" style="margin-top:10px;">
        <div class="barFill primary" style="width:${pct}%"></div>
      </div>
    </div>
  `;

  const pays = loadPayments().filter(p=>p.fromTaskId===taskId);

  // Flatten with alumno label
  const rows = pays.map(p=>({ ...p, _bucket: paymentBucket(p) }));

  const order = ["overdue","today","soon","ok","nodue","paid"];
  const sections = order.map(k=>{
    const items = rows.filter(r=>r._bucket===k);
    if(!items.length) return "";
    // Sort within section: closest due first, then alumno/concept
    items.sort((a,b)=>{
      const da = a.dueDate ? daysTo(a.dueDate) : 99999;
      const db = b.dueDate ? daysTo(b.dueDate) : 99999;
      if(da!==db) return da-db;
      const na = String(a.alumno||"");
      const nb = String(b.alumno||"");
      if(na!==nb) return na.localeCompare(nb);
      return String(a.concept||"").localeCompare(String(b.concept||""));
    });

    const list = items.map(p=>{
      const statusTag = (p.status==="paid") ? `<span class="tag ok">Pagado</span>` : `<span class="tag warn">Pendiente</span>`;
      const receipt = getReceiptByPaymentId(p.id);
      const action = (p.status==="paid" && receipt)
        ? `<button class="btn ghost" onclick="openReceipt('${p.id}')">Comprobante</button>`
        : (p.status!=="paid" ? `<button class="btn ghost" onclick="goTab('payments')">Ver en pagos</button>` : `<span class="muted">—</span>`);

      return `
        <div style="padding:10px 0;border-top:1px solid rgba(229,231,235,.6);display:flex;justify-content:space-between;gap:12px;align-items:flex-start;">
          <div style="min-width:0;">
            <div style="font-weight:900;">${p.alumno}</div>
            <div style="font-weight:800;">${cleanConcept(p.concept)}</div>
            <div class="muted">${formatCLP(p.amount)}</div>
            <div style="margin-top:6px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
              ${p.dueDate ? dueBadge(p.dueDate) : ``}
              <span class="tag">${taskTypeLabel(task)}</span>
            </div>
          </div>
          <div style="display:flex;gap:8px;align-items:center;flex-shrink:0;">
            ${statusTag}
            ${action}
          </div>
        </div>
      `;
    }).join("");

    return `
      <div class="card" style="margin-top:12px;">
        <div style="font-weight:950;">${bucketLabel(k)}</div>
        ${list}
      </div>
    `;
  }).join("");

  return header + sections;
}

/* ---------- router ---------- */
function renderByRole(role, tab){
  if(role === "apoderado") renderApoderado(tab);
  else if(role === "tesorero") renderTesorero(tab);
  else if(role === "presidente") renderPresidente(tab);
  else renderApoderado(tab);
}
function goTab(tab){
  const user = getUser();
  if(!user) return logout();
  renderByRole(user.role, tab);
}

/* ---------- boot ---------- */
document.addEventListener("DOMContentLoaded", () => {
  const user = getUser();
  if(!user){
    window.location.href = "login.html";
    return;
  }

  ensureSeedPayments();

  const whoLine = document.getElementById("whoLine");
  if(whoLine) whoLine.textContent = `${user.name} · ${user.role}`;

  renderByRole(user.role, "home");
});
