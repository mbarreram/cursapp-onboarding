/* ========= Cursapp · app.js (ESTABLE + PAGOS + CREAR COBRO) ========= */

const KEY_USER = "cursapp_demo_user";
const KEY_PAYMENTS = "cursapp_payments_v1";
const KEY_RECEIPTS = "cursapp_receipts_v1";
const KEY_TASKS = "cursapp_tasks_v1";

function resetDatosPrueba() {
  if (!confirm("⚠️ Esto eliminará TODOS los datos de prueba. ¿Continuar?")) return;

  localStorage.removeItem("campanas");
  localStorage.removeItem("cobros");
  localStorage.removeItem("pagos");
  localStorage.removeItem("usuarios");
  localStorage.removeItem("dashboardData");

  console.log("Datos de prueba eliminados");
  alert("Datos de prueba reseteados. Recarga la página.");
}

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
  if(d <= 3) return `<span class="tag warn">🟡 Por vencer · ${daysText}</span>`;
  return `<span class="tag">🟢 ${daysText}</span>`;
}



window.addEventListener('error', function(e){
  try{
    var msg = (e && (e.message || (e.error && e.error.message))) || 'Error JS';
    document.body.insertAdjacentHTML('beforeend',
      '<div style="position:fixed;left:12px;right:12px;bottom:90px;z-index:20000;background:#fee2e2;border:1px solid #fecaca;color:#991b1b;padding:10px 12px;border-radius:12px;font-weight:900;">JS error: '+String(msg).replace(/</g,'&lt;')+'</div>');
  }catch(_){}
});

function getUser(){ return JSON.parse(localStorage.getItem(KEY_USER) || "null"); }
function isDirectiva(role){ return role === "tesorero" || role === "presidente"; }
function logout(){
  localStorage.removeItem(KEY_USER);
  window.location.href = "login.html";
}

/* ---------- storage ---------- */
function loadPayments(){ return JSON.parse(localStorage.getItem(KEY_PAYMENTS) || "[]"); }
function savePayments(p){ localStorage.setItem(KEY_PAYMENTS, JSON.stringify(p)); }


function normalizePaymentIds(){
  const pays = loadPayments();
  const seen = new Set();
  let changed = false;

  for(let i=0;i<pays.length;i++){
    const p = pays[i];
    // If no id or duplicate id, fix it (prefer fixing pending items first)
    const missing = !p.id;
    const dup = p.id && seen.has(p.id);

    if(missing || dup){
      // To avoid breaking existing receipts, don't change id for paid items.
      if(p.status === "paid" && p.id){
        // keep as-is
        seen.add(p.id);
        continue;
      }
      const newId = uid("pay");
      pays[i] = { ...p, id: newId };
      changed = true;
      seen.add(newId);
      continue;
    }
    seen.add(p.id);
  }

  if(changed) savePayments(pays);
}

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


function closeReasonLabel(task){
  if(!task) return "";
  const by = task.closedBy || "";
  const reason = task.closeReason || "";
  if(by === "auto" && reason === "completed_100") return "Campaña cerrada por meta cumplida";
  if(by === "manual" && reason === "expired") return "Campaña cerrada por fecha (fuera de plazo)";
  if(by === "manual" && reason === "manual"){
    const note = task.closeNote ? `: ${task.closeNote}` : "";
    return "Campaña cerrada manualmente" + note;
  }
  if(by === "manual") return "Campaña cerrada manualmente";
  return "Campaña cerrada";
}

function isTaskClosed(task){
  return !!(task && (task.status === "closed" || task.closedAt));
}
function markTaskClosed(taskId, closedBy, closeReason, closeNote){
  const tasks = loadTasks();
  const idx = tasks.findIndex(t=>t.id===taskId);
  if(idx<0) return;
  tasks[idx].status = "closed";
  tasks[idx].closedAt = isoDate();
  tasks[idx].closedBy = closedBy;        // "auto" | "manual"
  tasks[idx].closeReason = closeReason;
  if(closeNote) tasks[idx].closeNote = closeNote;  // "completed_100" | "expired"
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

function tabbar(active, role){
  const mid = (role === "presidente")
    ? `<button class="tab ${active==="create"?"active":""}" onclick="openCreateCobro()" style="transform:translateY(-8px);">
         <span class="ico">➕</span><span>Crear</span>
       </button>`
    : ``;

  return `
    <nav class="tabbar">
      <button class="tab ${active==="home"?"active":""}" onclick="goTab('home')">
        <span class="ico">🏠</span><span>Inicio</span>
      </button>

      ${mid || `
      <button class="tab ${active==="payments"?"active":""}" onclick="goTab('payments')">
        <span class="ico">💳</span><span>Pagos</span>
      </button>`}

      ${mid ? `
      <button class="tab ${active==="payments"?"active":""}" onclick="goTab('payments')">
        <span class="ico">💳</span><span>Pagos</span>
      </button>` : ``}

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



/* ---------- charts (sin librerías) ---------- */
function clamp01(x){ return Math.max(0, Math.min(1, Number(x)||0)); }

function pieCSS(segments){
  // segments: [{value, colorVar}] where colorVar is CSS var string like '--pie1'
  const total = segments.reduce((a,s)=>a+Number(s.value||0),0) || 1;
  let acc = 0;
  const stops = segments.map(s=>{
    const v = Number(s.value||0);
    const from = acc/total*100;
    acc += v;
    const to = acc/total*100;
    return `var(${s.colorVar}) ${from.toFixed(2)}% ${to.toFixed(2)}%`;
  });
  return `conic-gradient(${stops.join(",")})`;
}


function chartCard(title, subtitle, segments, legend){
  const bg = pieCSS(segments);
  return `
    <div class="card" style="margin-top:12px;">
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;">
        <div style="min-width:220px;">
          <div style="font-weight:950;">${title}</div>
          ${subtitle ? `<div class="muted" style="margin-top:2px;">${subtitle}</div>` : ``}
          <div style="margin-top:10px;display:flex;flex-direction:column;gap:8px;">
            ${legend.map(l=>`
              <button class="btn ghost" type="button"
                style="width:100%;padding:8px 10px;border-radius:14px;display:flex;gap:10px;align-items:center;"
                onclick="${l.action || ''}">
                <span style="width:10px;height:10px;border-radius:999px;background:var(${l.colorVar});display:inline-block;"></span>
                <span class="muted" style="font-weight:800;">${l.label}</span>
                <span style="margin-left:auto;font-weight:950;">${l.valueText}</span>
              </button>
            `).join("")}
          </div>
        </div>
        <div style="width:140px;height:140px;border-radius:999px;background:${bg};border:10px solid rgba(229,231,235,.55);"></div>
      </div>
    </div>
  `;
}


function paymentsUrgencyStats(role){
  const visible = getVisiblePayments(role);
  const pending = visible.filter(p=>p.status!=="paid");
  const overdue = pending.filter(p=>p.dueDate && daysTo(p.dueDate) < 0).length;
  const soon = pending.filter(p=>p.dueDate && daysTo(p.dueDate) >= 0 && daysTo(p.dueDate) <= 5).length;
  const ok = pending.length - overdue - soon;
  return { pendingCount: pending.length, overdue, soon, ok };
}

function paymentsAmountStats(role){
  const visible = getVisiblePayments(role);
  const paidAmt = visible.filter(p=>p.status==="paid").reduce((a,b)=>a+Number(b.amount||0),0);
  const pendAmt = visible.filter(p=>p.status!=="paid").reduce((a,b)=>a+Number(b.amount||0),0);
  return { paidAmt, pendAmt, total: paidAmt + pendAmt };
}

function campaignsStatusStats(){
  const tasks = loadTasks().slice();
  tasks.forEach(t=>{ try{ ensureAutoClose(t); }catch(e){} });
  const closed = tasks.filter(t=>isTaskClosed(t)).length;
  const active = tasks.length - closed;
  return { total: tasks.length, active, closed };
}

function viewShell(title, subtitle, body, tab, role){
  const app = document.getElementById("app");
  if(!app) return;
  app.innerHTML = `
    <h1>${title}</h1>
    <p class="muted">${subtitle}</p>
    ${body}
    ${tabbar(tab, role)}
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


function setCampaignFilter(val){
  localStorage.setItem("cursapp_campaign_filter", val);
  goTab("payments");
}
function getCampaignFilter(){
  return localStorage.getItem("cursapp_campaign_filter") || "all";
}
function campaignStatus(task){
  try{ if(typeof ensureAutoClose === "function") ensureAutoClose(task); }catch(e){}
  const closed = (typeof isTaskClosed === "function") ? isTaskClosed(task) : false;
  if(closed) return "closed";
  try{
    const pr = (typeof taskProgress === "function") ? taskProgress(task) : null;
    if(pr && pr.pct >= 100) return "complete";
  }catch(e){}
  const d = task.dueDate ? daysTo(task.dueDate) : null;
  if(d !== null && d < 0) return "overdue";
  if(d !== null && d <= 3) return "soon";
  return "active";
}
function matchCampaign(task, filter){
  if(filter==="all") return true;
  const st = campaignStatus(task);
  if(filter==="active") return st==="active" || st==="soon";
  if(filter==="soon") return st==="soon";
  if(filter==="overdue") return st==="overdue";
  if(filter==="closed") return st==="closed";
  if(filter==="complete") return st==="complete";
  return true;
}

function setPayFilter(val){
  localStorage.setItem("cursapp_pay_filter", val);
  goTab("payments");
}
function getPayFilter(){
  return localStorage.getItem("cursapp_pay_filter") || "all";
}
function matchesFilter(p, filter){
  if(filter === "all") return true;
  if(filter === "pending") return p.status !== "paid";
  if(filter === "paid") return p.status === "paid";
  if(filter === "overdue"){
    if(p.status === "paid") return false;
    const d = p.dueDate ? daysTo(p.dueDate) : null;
    return d !== null && d < 0;
  }
  return true;
}

function renderPaymentsList(role){
  const payments = loadPayments();
  const visible = isDirectiva(role)
    ? payments
    : payments.filter(p => p.apoderadoRole === "apoderado");
  const filter = isDirectiva(role) ? getPayFilter() : 'all';
  const visible2 = visible.filter(p=>matchesFilter(p, filter));
  visible2.sort(comparePayments);

  const groups = {};
  visible2.forEach(p => {
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
      action = `<button class="btn ghost" onclick="openReconModal('${p.id}')">Conciliar</button>`;
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


function openReconModal(paymentId){
  const p = loadPayments().find(x => x.id === paymentId);
  if(!p) return;

  const root = document.getElementById("modalRoot");
  if(!root) return;

  const today = new Date().toISOString().slice(0,10);

  root.innerHTML = `
    <div style="position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:10000;display:flex;align-items:flex-end;justify-content:center;padding:14px;">
      <div class="card" style="width:min(640px,100%);margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap;">
          <div>
            <div style="font-weight:950;font-size:18px;">Conciliar pago</div>
            <div class="muted">${p.alumno} · ${cleanConcept(p.concept)} · ${formatCLP(p.amount)}</div>
          </div>
          <button class="btn ghost" onclick="closeModal()">Cerrar</button>
        </div>

        <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;">
          <div style="flex:1;min-width:180px;">
            <label style="font-weight:800;">Método</label>
            <select id="reconMethod">
              <option value="Efectivo">Efectivo</option>
              <option value="Transferencia">Transferencia</option>
              <option value="Otro">Otro</option>
            </select>
          </div>
          <div style="flex:1;min-width:180px;">
            <label style="font-weight:800;">Fecha</label>
            <input id="reconDate" type="date" value="${today}" />
          </div>
        </div>

        <div style="margin-top:12px;">
          <label style="font-weight:800;">Folio / referencia (auto)</label>
          <input id="reconRef" value="${uid('FOL')}" placeholder="Ej: TRANSF-12345 / BOLETA-22" />
        </div>

        <div style="margin-top:12px;">
          <label style="font-weight:800;">Nota (opcional)</label>
          <input id="reconNote" placeholder="Ej: Pago en efectivo en reunión" />
        </div>

        <div class="actions" style="justify-content:flex-end;margin-top:14px;">
          <button class="btn ghost" onclick="closeModal()">Cancelar</button>
          <button class="btn primary" onclick="confirmReconModal('${p.id}')">Marcar pagado</button>
        </div>
      </div>
    </div>
  `;
}

function closeModal(){
  const root = document.getElementById("modalRoot");
  if(root) root.innerHTML = "";
}

function confirmReconModal(paymentId){
  const ref = (document.getElementById("reconRef")?.value || "").trim();
  if(!ref){
    alert("Debes ingresar folio / referencia.");
    return;
  }
  const method = document.getElementById("reconMethod")?.value || "Transferencia";
  const date = document.getElementById("reconDate")?.value || new Date().toISOString().slice(0,10);
  const note = (document.getElementById("reconNote")?.value || "").trim();

  let paysAll = loadPayments();
  const idx = paysAll.findIndex(x=>x.id===paymentId);
  if(idx<0) return;

  paysAll[idx].status = "paid";
  paysAll[idx].paidDate = date;
  savePayments(paysAll);

  upsertReceipt({
    id: uid("rc"),
    paymentId,
    alumno: paysAll[idx].alumno,
    concept: paysAll[idx].concept,
    amount: paysAll[idx].amount,
    method,
    ref,
    note: note || "Conciliación manual",
    paidAt: new Date(date + "T12:00:00").toISOString()
  });

  closeModal();
  alert("Conciliado (demo). Comprobante generado.");
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



function getOpenTasks(){
  try { return JSON.parse(localStorage.getItem("cursapp_open_tasks") || "[]"); } catch(e){ return []; }
}
function setOpenTasks(arr){
  localStorage.setItem("cursapp_open_tasks", JSON.stringify(arr));
}
function isTaskOpen(taskId){
  return getOpenTasks().includes(taskId);
}
function toggleTaskOpen(taskId){
  const arr = getOpenTasks();
  const i = arr.indexOf(taskId);
  if(i>=0) arr.splice(i,1); else arr.unshift(taskId);
  setOpenTasks(arr.slice(0,10));
  goTab("payments");
}



// ---- open sections (detalle campaña / alumno) ----
function getOpenSections(){
  try { return JSON.parse(localStorage.getItem("cursapp_open_sections") || "[]"); } catch(e){ return []; }
}
function setOpenSections(arr){
  localStorage.setItem("cursapp_open_sections", JSON.stringify(arr));
}
function isSectionOpen(key){
  return getOpenSections().includes(key);
}
function toggleSectionOpen(key){
  const arr = getOpenSections();
  const i = arr.indexOf(key);
  if(i>=0) arr.splice(i,1); else arr.unshift(key);
  setOpenSections(arr.slice(0,50));
  goTab("payments");
}
function renderPayFilters(){
  const f = getCampaignFilter();
  const btn = (id,label) => `<button class="btn ghost" style="padding:10px 12px; border-radius:14px; ${f===id?'border:2px solid rgba(91,92,226,.45);':''}" onclick="setCampaignFilter('${id}')">${label}</button>`;
  return `
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        ${btn('all','Todas')}
        ${btn('active','Activas')}
        ${btn('soon','Por vencer')}
        ${btn('overdue','Vencidas')}
        ${btn('complete','100%')}
        ${btn('closed','Cerradas')}
      </div>
  `;
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

    viewShell("Apoderado","2°B 2026 · Colegio X", body, tab, "apoderado");
    return;
  }

  const body =
    tab==="payments"
      ? `${renderPaymentsList("apoderado")}`
      : `<div class="card"><div class="kpiLabel">Retiros</div><div class="muted">Apoderado: lectura/votación (demo).</div></div>`;

  viewShell("Apoderado","2°B 2026 · Colegio X", body, tab, "apoderado");
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
      
      ${chartCard(
        "Recaudación vs pendiente",
        "Distribución por monto",
        [
          { value: paymentsAmountStats("tesorero").paidAmt, colorVar: "--pie1" },
          { value: paymentsAmountStats("tesorero").pendAmt, colorVar: "--pie2" }
        ],
        [
          { label: "Recaudado", colorVar: "--pie1", valueText: formatCLP(paymentsAmountStats("tesorero").paidAmt) },
          { label: "Pendiente", colorVar: "--pie2", valueText: formatCLP(paymentsAmountStats("tesorero").pendAmt) }
        ]
      )}

      ${chartCard(
        "Pendientes por urgencia",
        "Cantidad de cuotas pendientes",
        [
          { value: paymentsUrgencyStats("tesorero").ok, colorVar: "--pie1" },
          { value: paymentsUrgencyStats("tesorero").soon, colorVar: "--pie2" },
          { value: paymentsUrgencyStats("tesorero").overdue, colorVar: "--pie3" }
        ],
        [
          { label: "Al día", colorVar: "--pie1", valueText: String(paymentsUrgencyStats("tesorero").ok) },
          { label: "Por vencer", colorVar: "--pie2", valueText: String(paymentsUrgencyStats("tesorero").soon) },
          { label: "Vencidas", colorVar: "--pie3", valueText: String(paymentsUrgencyStats("tesorero").overdue) }
        ]
      )}

      ${tasksHtml || `<div class="card" style="margin-top:12px;"><div class="muted">Aún no hay cobros creados.</div></div>`}
    `;

    viewShell("Tesorero","Administración del curso", body, tab, "tesorero");

    return;
  }

  const body =
    tab==="payments"
      ? `${renderTesoreroPayments()}`
      : `<div class="card"><div class="kpiLabel">Retiros</div><div class="muted">Tesorero: gestiona retiros (demo).</div></div>`;

  viewShell("Tesorero","Administración del curso", body, tab, "tesorero");
}

function renderPresidente(tab){
  if(tab === "home"){
    const sum = computeSummary("presidente");
    const pend = coursePending();

    const body = `
      ${kpiCard("💰","Recaudación del curso", formatCLP(sum.collected))}
      ${kpiCard("⏳","Pendiente del curso", `${formatCLP(pend.amount)} · ${pend.count} pendientes`)}

      
      ${chartCard(
        "Recaudación vs pendiente",
        "Distribución por monto",
        [
          { value: paymentsAmountStats("presidente").paidAmt, colorVar: "--pie1" },
          { value: paymentsAmountStats("presidente").pendAmt, colorVar: "--pie2" }
        ],
        [
          { label: "Recaudado", colorVar: "--pie1", valueText: formatCLP(paymentsAmountStats("presidente").paidAmt) },
          { label: "Pendiente", colorVar: "--pie2", valueText: formatCLP(paymentsAmountStats("presidente").pendAmt) }
        ]
      )}

      ${chartCard(
        "Estado de campañas",
        "Activas vs cerradas",
        [
          { value: campaignsStatusStats().active, colorVar: "--pie1" },
          { value: campaignsStatusStats().closed, colorVar: "--pie4" }
        ],
        [
          { label: "Activas", colorVar: "--pie1", valueText: String(campaignsStatusStats().active) },
          { label: "Cerradas", colorVar: "--pie4", valueText: String(campaignsStatusStats().closed) }
        ]
      )}

      <button class="btn primary" style="width:100%; margin-top:10px;" onclick="openCreateCobro()">Crear cobro</button>

      <div class="card" style="margin-top:12px;">
        <div class="kpiHead">
          <span class="kpiIcon">🎯</span>
          <span class="kpiLabel">Campañas</span>
        </div>
        ${renderPresidenteCampaigns()}
      </div>
    `;

    viewShell("Presidente","Administración del curso", body, tab, "presidente");


    return;
  }

  const body =
    tab==="payments"
      ? `${renderPresidentePayments()}`
      : `<div class="card"><div class="kpiLabel">Retiros</div><div class="muted">Presidente: cierra votación (demo).</div></div>`;

  viewShell("Presidente","Administración del curso", body, tab, "presidente");
}



function renderDirectivaPaymentsGrouped(role){
  const filter = getCampaignFilter();

  let sorted = [];
  try{
    if(typeof listTasksSorted === "function") sorted = listTasksSorted(200);
    else sorted = (loadTasks ? loadTasks().slice() : []);
  }catch(e){
    sorted = (loadTasks ? loadTasks().slice() : []);
  }

  const allPays = loadPayments().slice();
  const byTask = {};
  allPays.forEach(p=>{
    const tid = p.fromTaskId || "no_task";
    byTask[tid] = byTask[tid] || [];
    byTask[tid].push(p);
  });

  const rows = [];

  sorted.forEach(t=>{
    const tid = t.id;
    const allForTask = byTask[tid] || [];
    if(!allForTask.length) return;
    if(!matchCampaign(t, filter)) return;

    let pr = null;
    try{ pr = (typeof taskProgress === "function") ? taskProgress(t) : null; }catch(e){}
    const pct = pr ? Math.max(0, Math.min(100, pr.pct||0)) : 0;
    const meta = pr ? pr.meta : 0;
    const rec = pr ? pr.stats.recaudado : 0;

    const open = isTaskOpen(tid);
    const typeTag = (typeof taskTypeLabel === "function") ? taskTypeLabel(t) : (t.type==="monthly"?"Pago mensual":"Pago único");
    const statusTag = (typeof dueBadge === "function" && t.dueDate) ? dueBadge(t.dueDate) : "";
    const st = campaignStatus(t);
    const stTag = (st==="closed") ? "Cerrada" : (st==="overdue" ? "Vencida" : (st==="soon" ? "Por vencer" : (st==="complete" ? "100%" : "Activa")));

    const paysSorted = allForTask.slice().sort(comparePayments);
    const body = open ? paysSorted.map(p=>paymentRow(role, p)).join("") : "";

    rows.push(`
      <div style="padding:12px 0;border-top:1px solid rgba(229,231,235,.6);">
        <button class="btn ghost" style="width:100%;display:flex;justify-content:space-between;align-items:center;gap:10px;" onclick="toggleTaskOpen('${tid}')">
          <span style="text-align:left;">
            <div style="font-weight:950;">${cleanConcept ? cleanConcept(t.title) : t.title}</div>
            <div class="muted" style="margin-top:2px;">${pct}% · ${formatCLP(rec)} de ${formatCLP(meta)}</div>
            <div style="margin-top:6px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
              ${statusTag}
              <span class="tag">${typeTag}</span>
              <span class="tag">${stTag}</span>
            </div>
          </span>
          <span class="tag">${open ? "▲" : "▼"}</span>
        </button>

        <div style="margin-top:10px;">
          <div class="bar"><div class="barFill primary" style="width:${pct}%"></div></div>
        </div>

        ${open ? `<div style="margin-top:10px;">${body}</div>` : ``}
      </div>
    `);
  });

  if(byTask["no_task"] && byTask["no_task"].length && filter==="all"){
    const open = isTaskOpen("no_task");
    const body = open ? byTask["no_task"].slice().sort(comparePayments).map(p=>paymentRow(role,p)).join("") : "";
    rows.push(`
      <div style="padding:12px 0;border-top:1px solid rgba(229,231,235,.6);">
        <button class="btn ghost" style="width:100%;display:flex;justify-content:space-between;align-items:center;gap:10px;" onclick="toggleTaskOpen('no_task')">
          <span style="text-align:left;">
            <div style="font-weight:950;">Otros (sin campaña)</div>
            <div class="muted">Pagos no asociados a una campaña</div>
          </span>
          <span class="tag">${open ? "▲" : "▼"}</span>
        </button>
        ${open ? `<div style="margin-top:10px;">${body}</div>` : ``}
      </div>
    `);
  }

  return `
    <div class="card" style="margin-top:12px;">
      <div style="font-weight:950;margin-bottom:8px;">Pagos por campaña</div>
      
      ${rows.length ? rows.join("") : `<div class="muted" style="padding-top:10px;">No hay campañas para este filtro.</div>`}
    </div>
  `;
}

function renderTesoreroPayments(){
  const taskId = getSelectedTask();
  if(!taskId) return renderDirectivaPaymentsGrouped("tesorero");

  const task = findTaskById(taskId);
  if(!task){
    clearSelectedTask();
    return renderDirectivaPaymentsGrouped("tesorero");
  }

  const pays = loadPayments().filter(p=>p.fromTaskId===taskId).slice().sort(comparePayments);

  const groups = {};
  pays.forEach(p=>{ groups[p.alumno]=groups[p.alumno]||[]; groups[p.alumno].push(p); });
  const names = Object.keys(groups);

  const header = `
    <div class="card" style="margin-top:12px;">
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;">
        <div>
          <div style="font-weight:950;">${task.title}</div>
          <div class="muted">Pagos por alumno / cuota</div>
        </div>
        <button class="btn ghost" onclick="clearSelectedTask();goTab('payments')">Volver</button>
      </div>
    </div>
  `;

  const blocks = names.map(n=>{
    const openKey = `al_${taskId}_${n}`;
    const open = isSectionOpen(openKey);
    const rows = open ? groups[n].map(p=>paymentRow("tesorero", p)).join("") : "";
    return `
      <div class="card" style="margin-top:12px;">
        <button class="btn ghost" style="width:100%;display:flex;justify-content:space-between;align-items:center;gap:10px;" onclick="toggleSectionOpen('${openKey}')">
          <span style="font-weight:900;">${n}</span>
          <span class="tag">${open ? "▲" : "▼"}</span>
        </button>
        ${open ? rows : `<div class="muted" style="padding-top:10px;">Toca para ver cuotas.</div>`}
      </div>
    `;
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
  const pct = Math.max(0, Math.min(100, pr.pct));

  if(pct >= 100){
    markTaskClosed(taskId, "auto", "completed_100");
    alert("Campaña cerrada por meta cumplida (100%).");
    goTab('home');
    return;
  }

  const note = prompt("Motivo de cierre (obligatorio):", "No se alcanzó la meta");
  if(!note || !note.trim()){
    alert("Debes ingresar un motivo de cierre.");
    return;
  }

  const expired = taskIsExpired(task);
  const reason = expired ? "expired" : "manual";

  markTaskClosed(taskId, "manual", reason, note.trim());
  alert(expired ? "Campaña cerrada por fecha (fuera de plazo)." : "Campaña cerrada manualmente.");
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
    const canManualClose = (!closed && pct < 100);

    return `
      <div class="card" style="margin-top:12px;">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap;">
          <div>
            <div style="font-weight:950;">${cleanConcept(t.title)}</div>
            <div class="muted">${pct}% recaudado · ${formatCLP(pr.stats.recaudado)} de ${formatCLP(pr.meta)}</div>
            <div style="margin-top:6px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
              ${t.dueDate ? dueBadge(t.dueDate) : ``}
              <span class="tag">${taskTypeLabel(t)}</span>
              ${closed ? `<span class="tag danger">${closeReasonLabel(t)}</span>` : `<span class="tag ok">Activa</span>`}
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
  if(!taskId) return renderDirectivaPaymentsGrouped("presidente");

  const task = findTaskById(taskId);
  if(!task){
    clearSelectedTask();
    return renderPaymentsList("presidente");
  }

  ensureAutoClose(task);
  const pr = taskProgress(task);
  const pct = Math.max(0, Math.min(100, pr.pct));
  const closed = isTaskClosed(task);
  const canManualClose = (!closed && pct < 100);

  const header = `
    <div class="card" style="margin-top:12px;">
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;">
        <div>
          <div style="font-weight:950;">${task.title}</div>
          <div class="muted">${pct}% recaudado · ${formatCLP(pr.stats.recaudado)} de ${formatCLP(pr.meta)}</div>
          <div style="margin-top:6px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
            ${task.dueDate ? dueBadge(task.dueDate) : ``}
            <span class="tag">${taskTypeLabel(task)}</span>
            ${closed ? `<span class="tag danger">${closeReasonLabel(task)}</span>` : `<span class="tag ok">Activa</span>`}
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

    items.sort((a,b)=>{
      const da = a.dueDate ? daysTo(a.dueDate) : 99999;
      const db = b.dueDate ? daysTo(b.dueDate) : 99999;
      if(da!==db) return da-db;
      const na = String(a.alumno||"");
      const nb = String(b.alumno||"");
      if(na!==nb) return na.localeCompare(nb);
      return String(a.concept||"").localeCompare(String(b.concept||""));
    });

    const openKey = `sec_${taskId}_${k}`;
    const open = isSectionOpen(openKey);

    const list = open ? items.map(p=>{
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
    }).join("") : "";

    return `
      <div class="card" style="margin-top:12px;">
        <button class="btn ghost" style="width:100%;display:flex;justify-content:space-between;align-items:center;gap:10px;" onclick="toggleSectionOpen('${openKey}')">
          <span style="font-weight:950;">${bucketLabel(k)} <span class="tag" style="margin-left:8px;">${items.length}</span></span>
          <span class="tag">${open ? "▲" : "▼"}</span>
        </button>
        ${open ? list : `<div class="muted" style="padding:10px 2px 2px;">Toca para ver detalle.</div>`}
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
  normalizePaymentIds();

  const whoLine = document.getElementById("whoLine");
  if(whoLine) whoLine.textContent = `${user.name} · ${user.role}`;

  renderByRole(user.role, "home");
});
