/* ========= Cursapp · app.js (ESTABLE + PAGOS + CREAR COBRO) ========= */

const KEY_USER = "cursapp_demo_user";

// ========= Storage scoping (por curso) =========
// Evita “datos fantasma” entre cursos / pruebas.
function getCourseScope(){
  try{
    const active = localStorage.getItem("cursapp_active_course_v1");
    if(active && String(active).trim()) return String(active).trim();
  }catch(e){}
  try{
    const course = JSON.parse(localStorage.getItem("cursapp_course_v1") || "null");
    const ck = course && course.courseKey;
    if(ck && String(ck).trim()) return String(ck).trim();
  }catch(e){}
  return "global";
}
function sanitizeScope(s){
  return String(s||"global").replace(/[^a-zA-Z0-9_\-]/g,"_").slice(0,64) || "global";
}
const COURSE_SCOPE = sanitizeScope(getCourseScope());

function scopedKey(base){
  return `cursapp_${COURSE_SCOPE}_${base}`;
}

// New scoped keys
const KEY_PAYMENTS = scopedKey("payments_v1");
const KEY_RECEIPTS = scopedKey("receipts_v1");
const KEY_TASKS = scopedKey("tasks_v1");
const KEY_MONTHLY_REPORTS = scopedKey("monthly_reports_v1");
const KEY_EXPENSES = scopedKey("expenses_v1");

// Legacy (unscoped) keys (for migration)
const LEGACY_KEYS = {
  payments: "cursapp_payments_v1",
  receipts: "cursapp_receipts_v1",
  tasks: "cursapp_tasks_v1",
  reports: "cursapp_monthly_reports_v1",
  expenses: "cursapp_expenses_v1"
};

// One-time migration: if legacy exists and scoped empty, move it.
(function migrateLegacyOnce(){
  try{
    const marker = `cursapp_migrated_${COURSE_SCOPE}_v1`;
    if(localStorage.getItem(marker) === "1") return;

    // Only migrate into an empty scoped store (avoid overwriting).
    const scopedHasAny =
      localStorage.getItem(KEY_TASKS) || localStorage.getItem(KEY_PAYMENTS) ||
      localStorage.getItem(KEY_EXPENSES) || localStorage.getItem(KEY_MONTHLY_REPORTS) ||
      localStorage.getItem(KEY_RECEIPTS);

    if(!scopedHasAny){
      const map = [
        [LEGACY_KEYS.tasks, KEY_TASKS],
        [LEGACY_KEYS.payments, KEY_PAYMENTS],
        [LEGACY_KEYS.expenses, KEY_EXPENSES],
        [LEGACY_KEYS.reports, KEY_MONTHLY_REPORTS],
        [LEGACY_KEYS.receipts, KEY_RECEIPTS],
      ];

      map.forEach(([from,to])=>{
        const v = localStorage.getItem(from);
        if(v != null) localStorage.setItem(to, v);
      });
    }

    // Always remove legacy keys to prevent “ghost” reads elsewhere.
    Object.values(LEGACY_KEYS).forEach(k=>{ try{ localStorage.removeItem(k); }catch(e){} });

    localStorage.setItem(marker, "1");
  }catch(e){}
})();

const DEMO_SEED = false; // Parte 3: prueba real sin data


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


// ---------- profile meta (demo) ----------
function getProfileMeta(){
  const user = getUser();
  // En futuro: esto vendrá del onboarding
  if(!user) return {
    name: "—", role: "—",
    alumno: "Nombre alumno(a)",
    colegioCurso: "Colegio X · 2°B 2026 · Mañana"
  };

  const roleLabel = (user.role || "").toLowerCase();
  const name = user.name || user.role || "Usuario";
  const alumno = user.alumno || "Nombre alumno(a)";
  const colegio = user.colegio || "Colegio X";
  const curso = user.curso || "2°B 2026";
  const jornada = user.jornada || "Mañana";
  return {
    name,
    role: roleLabel.charAt(0).toUpperCase()+roleLabel.slice(1),
    alumno,
    colegioCurso: `${colegio} · ${curso} · ${jornada}`
  };
}

function renderHeader(){
  const meta = getProfileMeta();
  const who = document.getElementById("whoLine");
  if(!who) return;

  who.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:2px;line-height:1.1;">
      <div style="font-weight:950;font-size:14px;">${meta.name} · ${meta.role}</div>
      <div class="muted" style="font-weight:800;font-size:12px;">${meta.alumno}</div>
      <div class="muted" style="font-weight:700;font-size:11px;opacity:.9;">${meta.colegioCurso}</div>
    </div>
  `;
const menuBtn = document.getElementById("menuBtn");
  const menu = document.getElementById("menuDropdown");
  if(!menuBtn || !menu) return;

  function closeMenu(){
    menu.style.display = "none";
    menuBtn.setAttribute("aria-expanded","false");
  }
  function openMenu(){
    menu.style.display = "block";
    menuBtn.setAttribute("aria-expanded","true");
  }

  menuBtn.onclick = (e) => {
    e.stopPropagation();
    const open = menu.style.display === "block";
    if(open) closeMenu(); else openMenu();
  };

  document.addEventListener("click", (e)=>{
    if(menu.style.display === "block"){
      const t = e.target;
      if(t === menuBtn || menu.contains(t)) return;
      closeMenu();
    }
  });

  const logoutItem = document.getElementById("logoutMenuItem");
  if(logoutItem) logoutItem.onclick = () => logout();
}

/* ---------- storage ---------- */

function loadMonthlyReports(){ return JSON.parse(localStorage.getItem(KEY_MONTHLY_REPORTS) || "[]"); }
function saveMonthlyReports(r){ localStorage.setItem(KEY_MONTHLY_REPORTS, JSON.stringify(r)); }


function loadExpenses(){ return JSON.parse(localStorage.getItem(KEY_EXPENSES) || "[]"); }
function saveExpenses(e){ localStorage.setItem(KEY_EXPENSES, JSON.stringify(e)); }

function ensureSeedExpenses(){
  const existing = loadExpenses();
  if(existing && existing.length) return;

  const tasks = loadTasks();
  const any = tasks && tasks.length ? tasks[0] : null;

  const seed = [
    {
      id: uid("exp"),
      scope: "general",
      campaignId: null,
      title: "Compra de materiales urgentes",
      category: "Materiales",
      vendor: "Librería (Demo)",
      date: todayISO(),
      amount: 8500,
      note: "Gasto general del curso (demo)",
      attachments: [],
      createdBy: "tesorero",
      createdAt: isoDate()
    }
  ];
  if(any){
    seed.push({
      id: uid("exp"),
      scope: "campaign",
      campaignId: any.id,
      title: "Pago transporte",
      category: "Transporte",
      vendor: "Bus (Demo)",
      date: todayISO(),
      amount: 30000,
      note: "Asociado a campaña (demo)",
      attachments: [],
      createdBy: "tesorero",
      createdAt: isoDate()
    });
  }
  saveExpenses(seed);
}

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
  if(p.status === "opted_out") return 5;
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
  const pend = pays.filter(p=>p.status!=="paid" && p.status!=="opted_out");
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

function sumExpenses(list){ return (list||[]).reduce((a,b)=>a+Number(b.amount||0),0); }
function expensesByScope(scope){ return loadExpenses().filter(e=>e.scope===scope); }
function expensesForCampaign(taskId){ return loadExpenses().filter(e=>e.scope==='campaign' && e.campaignId===taskId); }
function courseCollected(){ return loadPayments().filter(p=>p.status==='paid').reduce((a,b)=>a+Number(b.amount||0),0); }
function courseSpent(){ return sumExpenses(loadExpenses()); }
function courseAvailable(){ return courseCollected() - courseSpent(); }


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
        <span class="ico">🧾</span><span>Rendiciones</span>
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
  const total = segments.reduce((a,s)=>a+Number(s.value||0),0) || 1;
  let acc = 0;
  const stops = segments.map(s=>{
    const v = Number(s.value||0);
    const from = acc/total*100;
    acc += v;
    const to = acc/total*100;
    const col = s.color || "#94a3b8";
    return `${col} ${from.toFixed(2)}% ${to.toFixed(2)}%`;
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
                <span style="width:10px;height:10px;border-radius:999px;background:${l.color || '#94a3b8'};display:inline-block;"></span>
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
  const pending = visible.filter(p=>p.status!=="paid" && p.status!=="opted_out");
  const overdue = pending.filter(p=>p.dueDate && daysTo(p.dueDate) < 0).length;
  const soon = pending.filter(p=>p.dueDate && daysTo(p.dueDate) >= 0 && daysTo(p.dueDate) <= 5).length;
  const ok = pending.length - overdue - soon;
  return { pendingCount: pending.length, overdue, soon, ok };
}

function paymentsAmountStats(role){
  const visible = getVisiblePayments(role);
  const paidAmt = visible.filter(p=>p.status==="paid").reduce((a,b)=>a+Number(b.amount||0),0);
  const pendAmt = visible.filter(p=>p.status!=="paid" && p.status!=="opted_out").reduce((a,b)=>a+Number(b.amount||0),0);
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
  const pending = visible.filter(p=>p.status!=="paid" && p.status!=="opted_out").reduce((a,b)=>a+Number(b.amount||0),0);
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
  const pending = all.filter(p=>p.status!=="paid" && p.status!=="opted_out");
  return {
    count: pending.length,
    amount: pending.reduce((a,b)=>a+Number(b.amount||0),0)
  };
}

function topPendingList(limit=5){
  return loadPayments().filter(p=>p.status!=="paid" && p.status!=="opted_out").slice(0,limit);
}



function renderApoderadoPaymentsFiltered(){
  const mine = loadPayments().filter(p => p.apoderadoRole === "apoderado");
  const tab = apPagosTabGet ? apPagosTabGet() : "pending";

  const chip = (id, label) => {
    const active = tab === id;
    const style = active ? "background:rgba(91,92,226,.10);border:1px solid rgba(91,92,226,.25);" : "background:transparent;border:1px solid rgba(229,231,235,.9);";
    return `<button class="btn ghost" style="padding:10px 12px;border-radius:14px;${style}font-weight:900;" onclick="localStorage.setItem('${KEY_AP_PAGOS_TAB}','${id}');goTab('payments')">${label}</button>`;
  };

  const tabsBar = `
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px;">
      ${chip("pending","Pendientes")}
      ${chip("upcoming","Próximas")}
      ${chip("history","Pagadas")}
    </div>
  `;

  let list = [];
  if(tab === "history"){
    list = mine.filter(p=>p.status==="paid");
  } else if(tab === "upcoming"){
    list = mine.filter(p=>p.status!=="paid" && p.status!=="opted_out")
               .filter(p=>p.dueDate && (daysTo(p.dueDate) >= 1 && daysTo(p.dueDate) <= 3));
  } else {
    list = mine.filter(p=>p.status!=="paid" && p.status!=="opted_out");
  }

  list.sort(comparePayments);

  const label = tab==="history" ? "Pagadas" : (tab==="upcoming" ? "Próximas (1 a 3 días)" : "Pendientes");
  const header = `
    <div class="card">
      <div style="font-weight:950;font-size:18px;">Pagos · ${label}</div>
      <div class="muted" style="margin-top:6px;">Gestiona tus cuotas en esta sección.</div>
      ${tabsBar}
    </div>
  `;

  if(!list.length){
    const empty = tab==="history" ? "Aún no registras pagos pagados." : (tab==="upcoming" ? "No tienes cuotas próximas (1 a 3 días)." : "No tienes cuotas pendientes.");
    return header + `<div class="card" style="margin-top:12px;"><div class="muted">${empty}</div></div>`;
  }

  const grouped = {};
  list.forEach(p=>{
    const k = cleanConcept(p.concept);
    grouped[k] = grouped[k] || [];
    grouped[k].push(p);
  });
  const keys = Object.keys(grouped).sort((a,b)=>String(a).localeCompare(String(b)));
  const body = keys.map(k=>{
    const rows = grouped[k].map(p=>paymentRow("apoderado", p)).join("");
    return `
      <div class="card" style="margin-top:12px;">
        <div style="font-weight:950;">${k}</div>
        ${rows}
      </div>
    `;
  }).join("");

  return header + body;
}

/* ---------- payments list ---------- */


// ---------- Unified campaign list (vertical) ----------
function groupPaymentsByTask(payments){
  const groups = {};
  payments.forEach(p=>{
    const tid = p.fromTaskId || "no_task";
    groups[tid] = groups[tid] || [];
    groups[tid].push(p);
  });
  Object.keys(groups).forEach(k=>groups[k].sort(comparePayments));
  return groups;
}

function renderCampaignPaymentsRows(payments, role, task){
  if(role === "apoderado"){
    return payments.map(p=>{
      const paid = p.status === "paid";
      const opted = p.status === "opted_out";
      const statusText = paid ? "Pagado" : (opted ? "No participó" : "Pendiente");

      let action = `<span class="muted">—</span>`;
      const receipt = getReceiptByPaymentId(p.id);
      if(!paid && !opted){
        const optBtn = (typeof canOptOut === "function" && canOptOut("apoderado", p))
          ? `<button class="btn ghost" style="padding:8px 10px;border-radius:12px;" onclick="optOutPayment('${p.id}')">No participé</button>`
          : ``;
        action = `
          <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;">
            ${optBtn}
            <button class="btn primary" onclick="openPay('${p.id}')">Pagar</button>
          </div>
        `;
      } else if(paid && receipt){
        action = `<button class="btn ghost" onclick="openReceipt('${p.id}')">Comprobante</button>`;
      }

      let dueText = "";
      let dueColor = "#22c55e";
      if(p.dueDate){
        const d = daysTo(p.dueDate);
        if(d < 0){ dueText="Vencida"; dueColor="#ef4444"; }
        else if(d === 0){ dueText="Vence hoy"; dueColor="#f59e0b"; }
        else if(d <= 3){ dueText=`Quedan ${d} días`; dueColor="#f59e0b"; }
        else { dueText=`Quedan ${d} días`; dueColor="#22c55e"; }
      }

      return `
        <div style="padding:10px 12px;border-top:1px solid rgba(229,231,235,.6);">
          <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;">
            <div style="min-width:0;">
              <div style="font-weight:900;">${p.alumno || "Alumno"}</div>
              <div class="muted" style="margin-top:2px;">Estado: ${statusText}</div>
            </div>
            <div style="text-align:right;min-width:150px;">${action}</div>
          </div>
          <div style="margin-top:10px;display:flex;justify-content:space-between;gap:12px;align-items:center;">
            <div class="muted" style="font-weight:700;font-size:13px;">${task ? taskTypeLabel(task) : "Pago"}</div>
            <div style="font-weight:900;font-size:13px;color:${dueColor};">${dueText}</div>
          </div>
        </div>
      `;
    }).join("");
  }

  // Directiva: agrupar por alumno (más limpio)
  const groups = {};
  payments.forEach(p=>{
    const k = p.alumno || "Alumno";
    groups[k] = groups[k] || [];
    groups[k].push(p);
  });
  const names = Object.keys(groups).sort((a,b)=>String(a).localeCompare(String(b)));

  return names.map(name=>{
    const key = `sec_${(task && task.id) ? task.id : "no_task"}_${name}`;
    const open = isSectionOpen(key);
    const rows = open ? groups[name].map(p=>`<div style="padding:0 12px;">${paymentRow(role, p)}</div>`).join("") : "";
    return `
      <div style="padding:10px 12px;border-top:1px solid rgba(229,231,235,.6);">
        <button class="btn ghost" style="width:100%;text-align:left;display:flex;justify-content:space-between;align-items:center;gap:10px;" onclick="toggleSectionOpen('${key}')">
          <span style="font-weight:950;">${name}</span>
          <span class="tag">${open ? "▲" : "▼"}</span>
        </button>
        ${open ? `<div style="margin-top:10px;">${rows}</div>` : `<div class="muted" style="margin-top:8px;">Toca para ver pagos.</div>`}
      </div>
    `;
  }).join("");
}

function renderCampaignCard(task, payments, role){
  const title = task ? cleanConcept(task.title) : "Otros (sin campaña)";
  const icon = campaignIcon(task, title);
  const accent = campaignAccent(task);
  const status = task ? campaignStatusForAp(task) : {label:"", color:"#64748b"};
  const start = task ? fmtDM(task.startDate) : "";
  const end = task ? fmtDM(task.dueDate) : "";
  const range = (start && end) ? `${start} → ${end}` : "";

  const paidCount = payments.filter(p=>p.status==="paid").length;
  const totalCount = payments.length;

  const tid = task ? task.id : "no_task";
  const open = isTaskOpen(tid);

  return `
    <div class="card" style="margin-top:12px;position:relative;overflow:hidden;">
      <div style="position:absolute;left:0;top:0;bottom:0;width:6px;background:${accent};"></div>
      <button class="btn ghost" style="width:100%;text-align:left;padding:12px 12px 10px 12px;display:block;" onclick="toggleTaskOpen('${tid}')">
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
          <div style="font-size:20px;">${icon}</div>
          <div style="font-weight:950;font-size:17px;min-width:0;">${title}</div>
        </div>
        <div class="muted" style="margin-top:6px;display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
          ${range ? `<span>${range}</span>` : ``}
          ${task ? `<span class="tag" style="background:rgba(0,0,0,.04);color:${status.color};border:1px solid rgba(0,0,0,.06);">${status.label}</span>` : ``}
          <span class="tag">${paidCount}/${totalCount} pagados</span>
          <span class="tag">${open ? "▲" : "▼"}</span>
        </div>
      </button>
      ${open ? `<div style="margin-top:6px;">${renderCampaignPaymentsRows(payments, role, task)}</div>` : ``}
    </div>
  `;
}

function renderPaymentsByCampaign(role){
  const all = loadPayments();
  const visible = isDirectiva(role) ? all : all.filter(p=>p.apoderadoRole === "apoderado");
  const groups = groupPaymentsByTask(visible);
  const tasks = loadTasks().slice();

  let html = "";
  tasks.forEach(t=>{
    if(groups[t.id] && groups[t.id].length){
      html += renderCampaignCard(t, groups[t.id], role);
    }
  });

  if(groups["no_task"] && groups["no_task"].length){
    html += renderCampaignCard(null, groups["no_task"], role);
  }

  return html || `<div class="card"><div class="muted">Sin pagos.</div></div>`;
}



function setCampaignFilter(val){
  localStorage.setItem("cursapp_campaign_filter", val);
  goTab(getCurrentTab());
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
  goTab(getCurrentTab());
}
function getPayFilter(){
  return localStorage.getItem("cursapp_pay_filter") || "all";
}
function matchesFilter(p, filter){
  if(filter === "all") return true;
  if(filter === "pending") return p.status !== "paid" && p.status !== "opted_out";
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


function taskForPayment(p){
  return p && p.fromTaskId ? findTaskById(p.fromTaskId) : null;
}
function canOptOut(role, p){
  if(role !== "apoderado") return false;
  if(!p || p.status === "paid" || p.status === "opted_out") return false;
  const t = taskForPayment(p);
  if(!t) return false;
  return t.mandatoryParticipation === false;
}
function optOutPayment(paymentId){
  const pays = loadPayments();
  const idx = pays.findIndex(x=>x.id === paymentId);
  if(idx < 0) return;
  if(pays[idx].status === "paid") return;
  pays[idx].status = "opted_out";
  pays[idx].optedOutAt = isoDate();
  savePayments(pays);
  alert("Marcado como No participó. No se cobrará esta cuota.");
  goTab(getCurrentTab());
}




function paymentRow(role, p){
  const paid = p.status === "paid";
  const optedOut = p.status === "opted_out";

  const task = p.fromTaskId ? findTaskById(p.fromTaskId) : null;
  const typeLabel = task ? taskTypeLabel(task) : "Pago";

  const title = cleanConcept(p.concept);
  const desc = cleanConcept(p.concept);

  const statusText = paid ? "Pagado" : (optedOut ? "No participó" : "Pendiente");

  const receipt = getReceiptByPaymentId(p.id);
  let primaryAction = `<span class="muted">—</span>`;

  if(isDirectiva(role)){
    if(!paid && !optedOut){
      primaryAction = `<button class="btn ghost" onclick="openReconModal('${p.id}')">Conciliar</button>`;
    } else if(paid && receipt){
      primaryAction = `<button class="btn ghost" onclick="openReceipt('${p.id}')">Comprobante</button>`;
    }
  } else {
    if(!paid && !optedOut){
      primaryAction = `<button class="btn primary" onclick="openPay('${p.id}')">Pagar</button>`;
    } else if(paid && receipt){
      primaryAction = `<button class="btn ghost" onclick="openReceipt('${p.id}')">Comprobante</button>`;
    }
  }

  const optOutLink = (typeof canOptOut === "function" && canOptOut(role, p))
    ? `<button class="btn ghost" style="padding:8px 10px;border-radius:12px;" onclick="optOutPayment('${p.id}')">No participé</button>`
    : ``;

  let dueText = "";
  let dueColor = "#22c55e";
  if(p.dueDate){
    const d = daysTo(p.dueDate);
    if(d < 0){ dueText = "Vencida"; dueColor = "#ef4444"; }
    else if(d === 0){ dueText = "Vence hoy"; dueColor = "#f59e0b"; }
    else if(d <= 3){ dueText = `Quedan ${d} días`; dueColor = "#f59e0b"; }
    else { dueText = `Quedan ${d} días`; dueColor = "#22c55e"; }
  }

  let createdText = "";
  if(p.createdAt){
    try{
      const dt = new Date(p.createdAt);
      if(!isNaN(dt.getTime())) createdText = dt.toLocaleDateString("es-CL");
    }catch(e){}
  }

  const stripBg = paid ? "rgba(34,197,94,.10)" : (optedOut ? "rgba(100,116,139,.10)" : "rgba(245,158,11,.10)");
  const stripBorder = paid ? "rgba(34,197,94,.25)" : (optedOut ? "rgba(100,116,139,.25)" : "rgba(245,158,11,.25)");

  return `
    <div style="padding:12px 0;border-top:1px solid rgba(229,231,235,.6);">
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;">
        <div style="min-width:0;">
          <div style="font-weight:950;font-size:16px;line-height:1.15;">${title}</div>
          <div class="muted" style="margin-top:4px;">${desc}</div>

          <div style="margin-top:8px;padding:10px 12px;border-radius:14px;background:${stripBg};border:1px solid ${stripBorder};display:flex;gap:10px;flex-wrap:wrap;">
            <div class="muted" style="font-weight:900;">${typeLabel}</div>
            <div class="muted" style="font-weight:900;">Estado: ${statusText}</div>
          </div>
        </div>

        <div style="text-align:right;flex-shrink:0;min-width:140px;margin-top:38px;">
          <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;">
            ${(!paid && !optedOut) ? optOutLink : ``}
            ${primaryAction}
          </div>
        </div>
      </div>

      <div style="margin-top:12px;border-top:1px solid rgba(229,231,235,.6);"></div>

      <div style="margin-top:10px;display:flex;justify-content:space-between;gap:12px;align-items:center;">
        <div class="muted" style="font-weight:700;font-size:13px;">
          ${createdText ? `Creado ${createdText}` : ``}
        </div>
        <div style="font-weight:900;font-size:13px;color:${dueColor};">${dueText}</div>
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
  goTab(getCurrentTab());
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

function openAttachment(dataUrl){
  const root = document.getElementById("modalRoot");
  if(!root) return;
  root.innerHTML = `
    <div style="position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:10000;display:flex;align-items:flex-end;justify-content:center;padding:14px;">
      <div class="card" style="width:min(720px,100%);margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;">
          <div style="font-weight:950;font-size:18px;">Boleta / Recibo</div>
          <button class="btn ghost" onclick="closeModal()">Cerrar</button>
        </div>
        <div style="margin-top:12px;">
          <img src="${dataUrl}" style="width:100%;height:auto;border-radius:14px;border:1px solid rgba(229,231,235,.9);" />
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
  goTab(getCurrentTab());
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
  goTab(getCurrentTab());
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


/* ---------- Rendiciones (Gastos) ---------- */
function openCreateExpense(scope, campaignId, parentId){
  const user = getUser();
  if(!user) return;
  if(!(user.role === "tesorero" || user.role === "presidente")){
    alert("Solo directiva puede agregar gastos.");
    return;
  }

  const root = document.getElementById("modalRoot");
  if(!root) return;

  const titleScope = scope === "general" ? "Gasto general" : "Gasto por campaña";
  const t = (scope === "campaign" && campaignId) ? findTaskById(campaignId) : null;
  const campName = t ? ` · ${t.title}` : "";

  root.innerHTML = `
    <div style="position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:10000;display:flex;align-items:flex-end;justify-content:center;padding:14px;">
      <div class="card" style="width:min(720px,100%);margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap;">
          <div>
            <div style="font-weight:950;font-size:18px;">Agregar ${titleScope}${campName}</div>
            <div class="muted">Adjunta boleta/recibo para respaldar el gasto.</div>
          </div>
          <button class="btn ghost" onclick="closeModal()">Cerrar</button>
        </div>

        <div style="margin-top:12px;">
          <label style="font-weight:800;">Concepto</label>
          <input id="exTitle" placeholder="Ej: Compra materiales / Transporte" />
        </div>

        <div style="display:flex;gap:10px;margin-top:12px;flex-wrap:wrap;">
          <div style="flex:1;min-width:160px;">
            <label style="font-weight:800;">Categoría</label>
            <select id="exCat">
              <option value="Transporte">Transporte</option>
              <option value="Materiales">Materiales</option>
              <option value="Alimentación">Alimentación</option>
              <option value="Regalos">Regalos</option>
              <option value="Otros">Otros</option>
            </select>
          </div>
          <div style="flex:1;min-width:160px;">
            <label style="font-weight:800;">Proveedor</label>
            <input id="exVendor" placeholder="Ej: Librería / Bus" />
          </div>
        </div>

        <div style="display:flex;gap:10px;margin-top:12px;flex-wrap:wrap;">
          <div style="flex:1;min-width:160px;">
            <label style="font-weight:800;">Fecha</label>
            <input id="exDate" type="date" value="${todayISO()}" />
          </div>
          <div style="flex:1;min-width:160px;">
            <label style="font-weight:800;">Monto</label>
            <input id="exAmount" inputmode="numeric" placeholder="Ej: 12000" />
          </div>
        </div>

        <div style="margin-top:12px;">
          <label style="font-weight:800;">Nota (opcional)</label>
          <input id="exNote" placeholder="Ej: Se compró para actividad" />
        </div>

        <div style="margin-top:12px;">
          <label style="font-weight:800;">Adjuntar boleta (imagen)</label>
          <input id="exFile" type="file" accept="image/*" />
          <div class="muted" style="margin-top:6px;">En el MVP se guarda en el navegador (demo).</div>
        </div>

        <div class="actions" style="justify-content:flex-end;margin-top:14px;">
          <button class="btn ghost" onclick="closeModal()">Cancelar</button>
          <button class="btn primary" onclick="createExpense('${scope}','${campaignId || ""}','${parentId || ""}')">Guardar gasto</button>
        </div>
      </div>
    </div>
  `;
}

function createExpense(scope, campaignId, parentId){
  const title = (document.getElementById("exTitle")?.value || "").trim();
  const category = document.getElementById("exCat")?.value || "Otros";
  const vendor = (document.getElementById("exVendor")?.value || "").trim();
  const date = document.getElementById("exDate")?.value || todayISO();
  const amount = Number((document.getElementById("exAmount")?.value || "").trim());
  const note = (document.getElementById("exNote")?.value || "").trim();
  const file = document.getElementById("exFile")?.files?.[0] || null;

  if(!title || !amount || amount <= 0){
    alert("Completa concepto y monto.");
    return;
  }

  const user = getUser();
  const createdBy = user ? user.role : "directiva";

  function finalize(att){
    const list = loadExpenses();
    list.unshift({
      id: uid("exp"),
      scope,
      parentId: parentId || null,
      campaignId: (scope === "campaign") ? (campaignId || null) : null,
      title,
      category,
      vendor,
      date,
      amount,
      note,
      attachments: att ? [att] : [],
      createdBy,
      createdAt: isoDate()
    });
    saveExpenses(list);
    closeModal();
    alert("Gasto guardado ✅");
    goTab("withdraws");
  }

  if(file){
    const reader = new FileReader();
    reader.onload = () => finalize({ id: uid("att"), type: file.type || "image/*", filename: file.name || "boleta.jpg", dataUrl: reader.result });
    reader.readAsDataURL(file);
  } else {
    finalize(null);
  }
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
            <label style="font-weight:800;">Participación</label>
            <div class="muted" style="margin-top:4px;">Si no es obligatoria, el apoderado podrá marcar “No participó” y no se le cobrará.</div>
            <label style="display:flex;gap:10px;align-items:center;margin-top:8px;">
              <input id="tMandatory" type="checkbox" checked />
              <span style="font-weight:900;">Obligatoria (se cobra a todo el curso)</span>
            </label>
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

function openAttachment(dataUrl){
  const root = document.getElementById("modalRoot");
  if(!root) return;
  root.innerHTML = `
    <div style="position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:10000;display:flex;align-items:flex-end;justify-content:center;padding:14px;">
      <div class="card" style="width:min(720px,100%);margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;">
          <div style="font-weight:950;font-size:18px;">Boleta / Recibo</div>
          <button class="btn ghost" onclick="closeModal()">Cerrar</button>
        </div>
        <div style="margin-top:12px;">
          <img src="${dataUrl}" style="width:100%;height:auto;border-radius:14px;border:1px solid rgba(229,231,235,.9);" />
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
  const mandatoryParticipation = !!document.getElementById("tMandatory")?.checked;

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
    mandatoryParticipation,
    createdAt: isoDate(),
    target: "all"
  };
  tasks.unshift(task);
  saveTasks(tasks);

  // Generar cobros para TODOS los alumnos (todos los apoderados)
  generatePaymentsForTask(task);

  closeModal();
  alert("Cobro creado para todos (demo).");
  goTab(getCurrentTab());
}

function loadTasks(){ return JSON.parse(localStorage.getItem(KEY_TASKS) || "[]"); }
function saveTasks(t){ localStorage.setItem(KEY_TASKS, JSON.stringify(t)); }

function sumExpenses(list){ return (list||[]).reduce((a,b)=>a+Number(b.amount||0),0); }
function expensesByScope(scope){ return loadExpenses().filter(e=>e.scope===scope); }
function expensesForCampaign(taskId){ return loadExpenses().filter(e=>e.scope==='campaign' && e.campaignId===taskId); }
function courseCollected(){ return loadPayments().filter(p=>p.status==='paid').reduce((a,b)=>a+Number(b.amount||0),0); }
function courseSpent(){ return sumExpenses(loadExpenses()); }
function courseAvailable(){ return courseCollected() - courseSpent(); }


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
  goTab(getCurrentTab());
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
  goTab(getCurrentTab());
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


/* ---------- Informes mensuales (Apoderado) ---------- */
const KEY_SEEN_MONTHLY_REPORTS = "cursapp_seen_monthly_reports_v1";

function loadSeenMonthlyReports(){
  try { return JSON.parse(localStorage.getItem(KEY_SEEN_MONTHLY_REPORTS) || "[]"); } catch(e){ return []; }
}
function saveSeenMonthlyReports(arr){
  localStorage.setItem(KEY_SEEN_MONTHLY_REPORTS, JSON.stringify(arr || []));
}
function markMonthlyReportSeen(period){
  const seen = loadSeenMonthlyReports();
  if(!seen.includes(period)) seen.unshift(period);
  saveSeenMonthlyReports(seen.slice(0,50));
}

function findLatestMonthlyReport(){
  const reps = loadMonthlyReports().slice();
  reps.sort((a,b)=>String(b.period||"").localeCompare(String(a.period||"")));
  return reps[0] || null;
}

function renderApoderadoMonthlyReportsCard(){
  const reps = loadMonthlyReports().slice().sort((a,b)=>String(b.period||"").localeCompare(String(a.period||"")));
  if(!reps.length) return "";
  const chosen = reps[1] || reps[0];
  return `
    <div class="card" style="margin-top:12px;border:1px solid rgba(100,116,139,.18);background:rgba(100,116,139,.06);">
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap;">
        <div style="min-width:240px;">
          <div style="display:flex;gap:10px;align-items:center;">
            <div style="font-size:18px;">📁</div>
            <div style="font-weight:950;">Informe del curso</div>
          </div>
          <div class="muted" style="margin-top:6px;font-weight:800;">
            Publicado: ${chosen.period} · Montos generales del curso (no personales)
          </div>
        </div>
        <button class="btn ghost" onclick="openMonthlyReport('${chosen.period}')">Ver</button>
      </div>
    </div>
  `;
}

function findLatestUnseenMonthlyReport(){
  const seen = new Set(loadSeenMonthlyReports());
  const reps = loadMonthlyReports().slice();
  reps.sort((a,b)=>String(b.period||"").localeCompare(String(a.period||"")));
  return reps.find(r=>r.period && !seen.has(r.period)) || null;
}
function countUnseenMonthlyReports(){
  const seen = new Set(loadSeenMonthlyReports());
  return loadMonthlyReports().filter(r=>r.period && !seen.has(r.period)).length;
}




function openMonthlyReport(period){
  const rep = loadMonthlyReports().find(r=>r.period===period);
  if(!rep) return;

  markMonthlyReportSeen(period);

  const root = document.getElementById("modalRoot");
  if(!root) return;

  const campaigns = (rep.perCampaign || []);

  const exec1 = `Campañas cerradas: <b>${rep.closedCampaignsCount || 0}</b>`;
  const exec2 = `Saldo del curso: <b>${formatCLP(rep.disponibleCurso || 0)}</b>`;
  const exec3 = `Adeudado del curso: <b>${formatCLP(rep.adeudadoCurso || 0)}</b>`;

  const rows = campaigns.map(c=>`
    <div style="padding:12px 12px;border:1px solid rgba(229,231,235,.75);border-radius:16px;background:#fff;margin-top:10px;">
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;">
        <div style="font-weight:950;font-size:16px;">📌 ${cleanConcept(c.title)}</div>
        <div class="tag" style="background:rgba(0,0,0,.04);border:1px solid rgba(0,0,0,.06);">Cerrada</div>
      </div>
      <div style="margin-top:10px;display:flex;gap:10px;flex-wrap:wrap;">
        <span class="tag ok">💰 Recaudado ${formatCLP(c.recaudado)}</span>
        <span class="tag warn">⏳ Adeudado ${formatCLP(c.adeudado)}</span>
        <span class="tag warn">🧾 Gastado ${formatCLP(c.gastado)}</span>
        <span class="tag ${c.disponible<0?'danger':''}">🏁 Saldo ${formatCLP(c.disponible)}</span>
      </div>
      <div class="muted" style="margin-top:8px;">
        ${c.adeudado>0 ? "Aún existen aportes pendientes del curso para esta campaña." : "Sin aportes pendientes."}
      </div>
    </div>
  `).join("") || `<div class="muted" style="margin-top:10px;">Sin campañas cerradas en el período.</div>`;

  const emitted = new Date(rep.generatedAt || Date.now()).toLocaleString("es-CL");

  root.innerHTML = `
    <div style="position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:10000;display:flex;align-items:flex-end;justify-content:center;padding:14px;">
      <div class="card" style="width:min(860px,100%);margin-bottom:12px;max-height:85vh;overflow:hidden;">
        <div style="padding:12px 12px;border-bottom:1px solid rgba(229,231,235,.7);display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;position:sticky;top:0;background:#fff;z-index:1;">
          <div>
            <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
              <div style="font-size:20px;">📊</div>
              <div style="font-weight:950;font-size:18px;">Informe financiero del curso</div>
              <span class="tag" style="background:rgba(91,92,226,.10);border:1px solid rgba(91,92,226,.22);color:#3b3cc7;">${rep.period}</span>
            </div>
            <div class="muted" style="margin-top:6px;">Publicado por la directiva · Snapshot acumulado al cierre del mes</div>
          </div>
          <button class="btn ghost" onclick="closeModal()">Cerrar</button>
        </div>

        <div style="padding:12px 12px;overflow:auto;max-height:calc(85vh - 62px);">
          <div style="padding:12px 12px;border:1px solid rgba(229,231,235,.75);border-radius:16px;background:rgba(248,250,252,1);">
            <div style="display:flex;gap:10px;align-items:center;">
              <div style="font-size:18px;">🧠</div>
              <div style="font-weight:950;">Resumen ejecutivo</div>
            </div>
            <div class="muted" style="margin-top:8px;line-height:1.5;">
              • ${exec1}<br>
              • ${exec2}<br>
              • ${exec3}
            </div>
          </div>

          <div style="margin-top:12px;padding:12px 12px;border:1px solid rgba(229,231,235,.75);border-radius:16px;background:rgba(248,250,252,1);">
            <div style="display:flex;gap:10px;align-items:center;">
              <div style="font-size:18px;">ℹ️</div>
              <div style="font-weight:950;">Importante</div>
            </div>
            <div class="muted" style="margin-top:6px;">
              Los montos de este informe corresponden al <b>total del curso</b> y <b>no representan deudas personales</b>.
              Para ver tus pagos individuales, revisa la sección <b>Pagos</b>.
            </div>
          </div>

          <div style="margin-top:14px;">
            <div style="display:flex;gap:10px;align-items:center;">
              <div style="font-size:18px;">💼</div>
              <div style="font-weight:950;">Resumen financiero del curso</div>
            </div>
            <div style="margin-top:10px;display:grid;grid-template-columns:1fr 1fr;gap:10px;">
              <div class="card" style="padding:12px;">
                <div class="muted" style="font-weight:900;">💰 Recaudado</div>
                <div style="font-weight:950;font-size:18px;margin-top:6px;">${formatCLP(rep.recaudadoCurso || 0)}</div>
              </div>
              <div class="card" style="padding:12px;">
                <div class="muted" style="font-weight:900;">⏳ Adeudado (curso)</div>
                <div style="font-weight:950;font-size:18px;margin-top:6px;">${formatCLP(rep.adeudadoCurso || 0)}</div>
              </div>
              <div class="card" style="padding:12px;">
                <div class="muted" style="font-weight:900;">🧾 Gastado / rendido</div>
                <div style="font-weight:950;font-size:18px;margin-top:6px;">${formatCLP(rep.gastadoCurso || 0)}</div>
              </div>
              <div class="card" style="padding:12px;">
                <div class="muted" style="font-weight:900;">🏁 Saldo del curso</div>
                <div style="font-weight:950;font-size:18px;margin-top:6px;">${formatCLP(rep.disponibleCurso || 0)}</div>
              </div>
            </div>
            <div style="margin-top:10px;display:flex;gap:10px;flex-wrap:wrap;">
              <span class="tag">📌 Campañas cerradas ${rep.closedCampaignsCount || 0}</span>
              <span class="tag">👥 Deudores (sin nombres) ${rep.deudoresTotales || 0}</span>
            </div>
          </div>

          <div style="margin-top:16px;">
            <div style="display:flex;gap:10px;align-items:center;">
              <div style="font-size:18px;">📌</div>
              <div style="font-weight:950;">Campañas cerradas incluidas</div>
            </div>
            <div class="muted" style="margin-top:6px;">Recaudación, gastos rendidos y saldo por campaña (acumulado).</div>
            <div style="margin-top:8px;">${rows}</div>
          </div>

          <div class="muted" style="margin-top:14px;font-size:12px;">
            Emitido: ${emitted} · Cursapp (demo)
          </div>
        </div>
      </div>
    </div>
  `;
}


function hasCourseMovement(){
  const hasPays = loadPayments().length > 0;
  const hasExps = loadExpenses().length > 0;
  const hasTasks = loadTasks().length > 0;
  const hasReports = loadMonthlyReports().length > 0;
  return hasPays || hasExps || hasTasks || hasReports;
}

function renderApoderadoCourseSummary(){
  // Estado cero: mostrar resumen “vacío”, sin botón de informe.
  if(!hasCourseMovement()){
    return `
      <div class="card" style="margin-top:12px;">
        <div style="font-weight:950;font-size:18px;">Resumen del curso · ${currentYYYYMM()}</div>
        <div class="muted" style="margin-top:6px;">Montos del curso (no personales)</div>

        <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;">
          <span class="tag ok">Recaudado ${formatCLP(0)}</span>
          <span class="tag warn">Rendido ${formatCLP(0)}</span>
          <span class="tag">Saldo ${formatCLP(0)}</span>
        </div>

        <div class="muted" style="margin-top:10px;font-weight:800;line-height:1.45;">
          Aún no hay cobros ni gastos registrados en el curso.
          Cuando la directiva cree una campaña, aquí verás los movimientos.
        </div>

        <button class="btn ghost" style="margin-top:12px;width:100%;" disabled>
          Esperando a la directiva
        </button>
      </div>
    `;
  }

  // Si ya hay movimiento, usa tu banner actual (si existe informe), si no, muestra cálculo “en vivo”
  const latest = findLatestMonthlyReport ? findLatestMonthlyReport() : null;
  if(latest){
    return renderApoderadoMonthlyReportBanner();
  }

  // Sin informe mensual publicado, pero con movimientos: calculamos con pagos + gastos
  const recaudado = courseCollected();
  const rendido = courseSpent();
  const saldo = courseAvailable();

  return `
    <div class="card" style="margin-top:12px;">
      <div style="font-weight:950;font-size:18px;">Resumen del curso · ${currentYYYYMM()}</div>
      <div class="muted" style="margin-top:6px;">Montos del curso (no personales)</div>

      <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;">
        <span class="tag ok">Recaudado ${formatCLP(recaudado)}</span>
        <span class="tag warn">Rendido ${formatCLP(rendido)}</span>
        <span class="tag ${saldo<0?'danger':''}">Saldo ${formatCLP(saldo)}</span>
      </div>

      <div class="muted" style="margin-top:10px;font-weight:800;">
        Aún no hay informe publicado por la directiva.
      </div>
    </div>
  `;
}


function renderApoderadoMonthlyReportBanner(){
  const latest = findLatestMonthlyReport ? findLatestMonthlyReport() : (loadMonthlyReports().slice().sort((a,b)=>String(b.period||"").localeCompare(String(a.period||"")))[0] || null);
  if(!latest) return "";

  const unseen = !!findLatestUnseenMonthlyReport && !!findLatestUnseenMonthlyReport();
  const seenSet = new Set(loadSeenMonthlyReports());
  const isUnseen = !seenSet.has(latest.period);

  const title = isUnseen ? "Informe financiero del curso disponible" : "Último informe financiero del curso";
  const subtitle = "Publicado por la directiva · Montos generales del curso (no personales)";

  const badge = isUnseen
    ? `<span class="tag" style="background:rgba(34,197,94,.12);color:#166534;border:1px solid rgba(34,197,94,.18);">Nuevo</span>`
    : `<span class="tag" style="background:rgba(100,116,139,.10);color:#111827;border:1px solid rgba(100,116,139,.18);">Publicado</span>`;

  return `
    <div class="card" style="margin-top:12px;border:1px solid rgba(91,92,226,.22);background:rgba(91,92,226,.08);">
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap;">
        <div style="min-width:240px;">
          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
            <div style="font-size:18px;">📊</div>
            <div style="font-weight:950;">${title}</div>
            ${badge}
          </div>
          <div class="muted" style="margin-top:6px;font-weight:800;">${subtitle}</div>
          <div class="muted" style="margin-top:6px;">
            Periodo ${latest.period} · Campañas cerradas ${latest.closedCampaignsCount || 0} · Adeudado curso ${formatCLP(latest.adeudadoCurso || 0)}
          </div>
        </div>
        <button class="btn primary" onclick="openMonthlyReport('${latest.period}')">Ver informe</button>
      </div>
    </div>
  `;
}

/* ---------- views ---------- */




function campaignIcon(task, fallbackTitle){
  const t = (task && task.title) ? String(task.title).toLowerCase() : String(fallbackTitle||"").toLowerCase();
  if(t.includes("paseo")) return "🎒";
  if(t.includes("cuota")) return "🧾";
  if(t.includes("fondo") || t.includes("financ")) return "💰";
  if(t.includes("rifa") || t.includes("sorteo")) return "🎟️";
  if(t.includes("bingo")) return "🎲";
  if(t.includes("uniform")) return "👕";
  if(t.includes("libro") || t.includes("texto")) return "📚";
  return "📌";
}
function campaignAccent(task){
  // Stable accent by taskId hashing
  const id = (task && task.id) ? String(task.id) : "no_task";
  let h = 0;
  for(let i=0;i<id.length;i++) h = (h*31 + id.charCodeAt(i)) >>> 0;
  const palette = ["#2563eb","#7c3aed","#06b6d4","#22c55e","#f59e0b","#ef4444","#64748b"];
  return palette[h % palette.length];
}
function fmtDM(dateStr){
  if(!dateStr) return "";
  try{
    const d = new Date(dateStr);
    if(isNaN(d.getTime())){
      // maybe YYYY-MM-DD already
      if(String(dateStr).length>=10) return String(dateStr).slice(8,10)+"/"+String(dateStr).slice(5,7);
      return "";
    }
    const dd = String(d.getDate()).padStart(2,"0");
    const mm = String(d.getMonth()+1).padStart(2,"0");
    return dd + "/" + mm;
  }catch(e){ return ""; }
}
function campaignForPayment(p){
  return p && p.fromTaskId ? findTaskById(p.fromTaskId) : null;
}
function campaignStatusForAp(task){
  if(!task) return {label:"", color:"#64748b"};
  try{ ensureAutoClose(task); }catch(e){}
  if(isTaskClosed(task)) return {label:"Cerrada", color:"#64748b"};
  const d = task.dueDate ? daysTo(task.dueDate) : null;
  if(d !== null && d < 0) return {label:"Vencida", color:"#ef4444"};
  if(d !== null && d <= 3) return {label:"Por vencer", color:"#f59e0b"};
  return {label:"Activa", color:"#22c55e"};
}


function renderActiveCampaignNotices(){
  const tasks = loadTasks().filter(t=>!isTaskClosed(t));
  if(!tasks.length) return "";
  const top = tasks.slice(0,3);
  return `
    <div class="card" style="margin-top:12px;">
      <div style="display:flex;gap:10px;align-items:center;">
        <div style="font-size:18px;">📢</div>
        <div style="font-weight:950;">Avisos de campañas activas</div>
      </div>
      <div class="muted" style="margin-top:6px;">Campañas actualmente en curso</div>
      <div style="margin-top:10px;">
        ${top.map(t=>`<div style="padding:10px 0;border-top:1px solid rgba(229,231,235,.6);font-weight:900;">${cleanConcept(t.title)}</div>`).join("")}
      </div>
    </div>
  `;
}
const KEY_AP_PAGOS_TAB = "cursapp_ap_pagos_tab";
function apPagosTabGet(){ return localStorage.getItem(KEY_AP_PAGOS_TAB) || "pending"; }
function apPagosTabSet(v){ localStorage.setItem(KEY_AP_PAGOS_TAB, v); goTab("payments"); }
// ---------- Apoderado dashboard helpers ----------
const KEY_AP_DASH_TAB = "cursapp_ap_dash_tab";
const KEY_AP_HISTORY_OPEN = "cursapp_ap_history_open";

function apDashTabGet(){ return localStorage.getItem(KEY_AP_DASH_TAB) || "pending"; }
function apDashTabSet(v){ localStorage.setItem(KEY_AP_DASH_TAB, v); goTab("home"); }

function apHistoryOpen(){ return (localStorage.getItem(KEY_AP_HISTORY_OPEN) || "0") === "1"; }
function apHistoryToggle(){
  localStorage.setItem(KEY_AP_HISTORY_OPEN, apHistoryOpen() ? "0" : "1");
  goTab("home");
}

function apMyVisiblePayments(){
  return loadPayments().filter(p => p.apoderadoRole === "apoderado");
}

function apIsPending(p){
  return p.status !== "paid" && p.status !== "opted_out";
}

function apUrgent(p){
  if(!apIsPending(p)) return false;
  if(!p.dueDate) return false;
  const d = daysTo(p.dueDate);
  return d <= 0; // vencidos o vence hoy
}

function apUpcoming(p){
  if(!apIsPending(p)) return false;
  if(!p.dueDate) return true; // sin fecha => próximo/informativo
  const d = daysTo(p.dueDate);
  return d >= 1 && d <= 3; // “Próximo” = 3 días para vencer
}

function apGroupByCampaign(list){
  const groups = {};
  list.forEach(p=>{
    const t = campaignForPayment(p);
    const key = t ? t.id : ("no_task::" + cleanConcept(p.concept));
    groups[key] = groups[key] || { task: t, concept: cleanConcept(p.concept), items: [] };
    groups[key].items.push(p);
  });
  Object.keys(groups).forEach(k=>groups[k].items.sort(comparePayments));
  return groups;
}

function apSection(title, inner){
  return `
    <div class="card" style="margin-top:12px;">
      <div style="font-weight:950;margin-bottom:8px;">${title}</div>
      ${inner}
    </div>
  `;
}

function apTabs(){
  const t = apDashTabGet();
  const btn = (id,label) => `<button class="btn ghost" style="padding:10px 12px;border-radius:14px; ${t===id?'border:2px solid rgba(91,92,226,.45);':''}" onclick="apDashTabSet('${id}')">${label}</button>`;
  return `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;">${btn("pending","Pendientes")}${btn("upcoming","Próximos")}${btn("history","Historial")}</div>`;
}

function apRenderListGrouped(list){
  if(!list.length) return `<div class="muted">Sin elementos.</div>`;
  const groups = apGroupByCampaign(list);
  const keys = Object.keys(groups).sort((a,b)=>{
    const ga = groups[a], gb = groups[b];
    const na = (ga.task ? ga.task.title : ga.concept) || "";
    const nb = (gb.task ? gb.task.title : gb.concept) || "";
    return String(na).localeCompare(String(nb));
  });

  return keys.map(k=>{
    const g = groups[k];
    const t = g.task;
    const title = t ? cleanConcept(t.title) : g.concept;

    const status = campaignStatusForAp(t);
    const start = t ? fmtDM(t.startDate) : "";
    const end = t ? fmtDM(t.dueDate) : "";

    // progress counts (per alumno)
    const paid = g.items.filter(p=>p.status==="paid").length;
    const total = g.items.length;

    const metaLeft = (start && end) ? `${start} → ${end}` : "";
    const metaRight = `${paid}/${total} pagados`;

    // action rows per alumno
    const rows = g.items.map(p=>{
      const alumnoLine = p.alumno ? `<div class="muted" style="margin-top:2px;font-weight:800;">Alumno: ${p.alumno}</div>` : ``;
      const card = paymentRow("apoderado", p);
      // paymentRow already includes title as campaign; we want it as alumno row, so we will inject alumno under header and remove duplicate title in row.
      // Simpler: for apoderado, paymentRow title is campaign; we now want it to be alumno. We'll render a slim row here instead.
      const paid = p.status === "paid";
      const opted = p.status === "opted_out";
      const statusText = paid ? "Pagado" : (opted ? "No participó" : "Pendiente");

      let action = `<span class="muted">—</span>`;
      const receipt = getReceiptByPaymentId(p.id);
      if(!paid && !opted){
        const optBtn = (typeof canOptOut === "function" && canOptOut("apoderado", p))
          ? `<button class="btn ghost" style="padding:8px 10px;border-radius:12px;" onclick="optOutPayment('${p.id}')">No participé</button>`
          : ``;
        action = `
          <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;">
            ${optBtn}
            <button class="btn primary" onclick="openPay('${p.id}')">Pagar</button>
          </div>
        `;
      } else if(paid && receipt){
        action = `<button class="btn ghost" onclick="openReceipt('${p.id}')">Comprobante</button>`;
      }

      // due semaforo
      let dueText = "";
      let dueColor = "#22c55e";
      if(p.dueDate){
        const d = daysTo(p.dueDate);
        if(d < 0){ dueText="Vencida"; dueColor="#ef4444"; }
        else if(d === 0){ dueText="Vence hoy"; dueColor="#f59e0b"; }
        else if(d <= 3){ dueText=`Quedan ${d} días`; dueColor="#f59e0b"; }
        else { dueText=`Quedan ${d} días`; dueColor="#22c55e"; }
      }

      return `
        <div style="padding:10px 0;border-top:1px solid rgba(229,231,235,.6);">
          <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;">
            <div style="min-width:0;">
              <div style="font-weight:900;">${p.alumno || "Alumno"}</div>
              <div class="muted" style="margin-top:2px;">Estado: ${statusText}</div>
            </div>
            <div style="text-align:right;min-width:150px;">
              ${action}
            </div>
          </div>
          <div style="margin-top:10px;display:flex;justify-content:space-between;gap:12px;align-items:center;">
            <div class="muted" style="font-weight:700;font-size:13px;">${t ? taskTypeLabel(t) : "Pago"}</div>
            <div style="font-weight:900;font-size:13px;color:${dueColor};">${dueText}</div>
          </div>
        </div>
      `;
    }).join("");

    return `
      <div class="card" style="margin-top:12px;position:relative;overflow:hidden;">
        <div style="position:absolute;left:0;top:0;bottom:0;width:6px;background:${campaignAccent(t)};"></div>
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;padding-left:8px;">
          <div style="min-width:0;">
            <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
              <div style="font-size:20px;">${campaignIcon(t, title)}</div>
              <div style="font-weight:950;font-size:17px;">${title}</div>
            </div>
            <div class="muted" style="margin-top:4px;display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
              ${metaLeft ? `<span>${metaLeft}</span>` : ``}
              <span class="tag" style="background:rgba(0,0,0,.04);color:${status.color};border:1px solid rgba(0,0,0,.06);">${status.label}</span>
              <span class="tag">${metaRight}</span>
            </div>
          </div>
        </div>
        <div style="margin-top:6px;">${rows}</div>
      </div>
    `;
  }).join("");
}

function renderApoderado(tab){
  

if(tab === "home"){
    const mine = loadPayments().filter(p => p.apoderadoRole === "apoderado");
    const pending = mine.filter(p => p.status !== "paid" && p.status !== "opted_out");
    const paid = mine.filter(p => p.status === "paid");
    const upcoming = pending.filter(p => p.dueDate && (daysTo(p.dueDate) >= 1 && daysTo(p.dueDate) <= 3));

    const pendingAmt = pending.reduce((a,b)=>a+Number(b.amount||0),0);
    const paidAmt = paid.reduce((a,b)=>a+Number(b.amount||0),0);

    const notices = renderActiveCampaignNotices();

    const quick = `
      <div style="margin-top:12px;display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div class="card" style="padding:12px;cursor:pointer;" onclick="apPagosTabSet('pending')">
          <div class="muted" style="font-weight:900;">⏳ Mis cuotas pendientes</div>
          <div style="font-weight:950;font-size:18px;margin-top:8px;">${pending.length} cuotas</div>
          <div class="muted" style="margin-top:6px;">Total ${formatCLP(pendingAmt)}</div>
          <div style="margin-top:10px;"><span class="tag warn">Ver pendientes</span></div>
        </div>

        <div class="card" style="padding:12px;cursor:pointer;" onclick="apPagosTabSet('history')">
          <div class="muted" style="font-weight:900;">✅ Historial de pagos</div>
          <div style="font-weight:950;font-size:18px;margin-top:8px;">${paid.length} pagos</div>
          <div class="muted" style="margin-top:6px;">Pagado ${formatCLP(paidAmt)}</div>
          <div style="margin-top:10px;"><span class="tag ok">Ver historial</span></div>
        </div>
      </div>

      <div style="margin-top:10px;">
        <div class="card" style="padding:12px;cursor:pointer;" onclick="apPagosTabSet('upcoming')">
          <div class="muted" style="font-weight:900;">📅 Próximas cuotas</div>
          <div style="font-weight:950;font-size:18px;margin-top:8px;">${upcoming.length} cuotas</div>
          <div class="muted" style="margin-top:6px;">Vencen en 1 a 3 días</div>
          <div style="margin-top:10px;"><span class="tag">Ver próximas</span></div>
        </div>
      </div>
    `;

    const body = `
      ${renderApoderadoMonthlyReportBanner()}
      ${notices}
      ${quick}
      <div style="margin-top:12px;"></div>
      ${renderApoderadoMonthlyReportsCard()}
    `;

    viewShell("Apoderado","", body, tab, "apoderado");
    return;
}

const body =
    tab==="payments"
      ? `${renderApoderadoPaymentsFiltered()}`
      : `${renderRendicionesVertical("apoderado")}`;

  viewShell("Apoderado","2°B 2026 · Colegio X", body, tab, "apoderado");
}

function renderTesorero(tab){
  
if(tab === "home"){
    const collected = courseCollected();
    const spent = sumExpenses(loadExpenses());
    const available = collected - spent;

    const allExp = loadExpenses();
    const pendingBoletas = expensesMissingBoleta(allExp);
    const pendienteRendir = allExp.filter(e=>!(e.attachments && e.attachments.length)).reduce((a,b)=>a+Number(b.amount||0),0);

    const tasks = loadTasks().filter(t=>!isTaskClosed(t));
    const list = tasks.map(t=>{
      const rec = loadPayments().filter(p=>p.status==='paid' && p.fromTaskId===t.id).reduce((a,b)=>a+Number(b.amount||0),0);
      const exp = expensesForCampaign(t.id);
      const gas = sumExpenses(exp);
      const disp = rec - gas;
      const miss = expensesMissingBoleta(exp);
      return { t, rec, gas, disp, miss };
    });

    const alerts = [];
    if(pendingBoletas>0) alerts.push(`⚠️ ${pendingBoletas} gasto(s) sin boleta`);
    const neg = list.filter(x=>x.disp<0);
    if(neg.length) alerts.push(`⚠️ ${neg.length} campaña(s) con saldo negativo`);

    const resumen = `
      <div class="card">
        <div style="font-weight:950;font-size:18px;">Estado financiero del curso</div>
        <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;">
          <div class="tag ok">💰 Recaudado ${formatCLP(collected)}</div>
          <div class="tag warn">🧾 Gastado ${formatCLP(spent)}</div>
          <div class="tag ${available<0?'danger':''}">⚖️ Saldo ${formatCLP(available)}</div>
        </div>
        <div style="margin-top:10px;display:flex;gap:10px;flex-wrap:wrap;">
          <div class="tag warn">⏳ Pendiente de rendir ${formatCLP(pendienteRendir)}</div>
          ${pendingBoletas ? `<div class="tag danger">⚠️ Sin boleta ${pendingBoletas}</div>` : `<div class="tag ok">✅ Boletas al día</div>`}
        </div>
        ${alerts.length ? `<div class="muted" style="margin-top:10px;">${alerts.join(" · ")}</div>` : ``}
      </div>
    `;

    const quick = `
      <div style="margin-top:12px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">
        <div class="card" style="padding:12px;cursor:pointer;" onclick="goTab('rendiciones')">
          <div class="muted" style="font-weight:900;">➕ Agregar gasto</div>
          <div class="muted" style="margin-top:6px;">Registrar un gasto con boleta</div>
        </div>
        <div class="card" style="padding:12px;cursor:pointer;" onclick="goTab('rendiciones')">
          <div class="muted" style="font-weight:900;">🧾 Rendiciones</div>
          <div class="muted" style="margin-top:6px;">Ver gastos y boletas</div>
        </div>
        <div class="card" style="padding:12px;cursor:pointer;" onclick="goTab('rendiciones')">
          <div class="muted" style="font-weight:900;">📊 Informes</div>
          <div class="muted" style="margin-top:6px;">Generar informe mensual</div>
        </div>
      </div>
    `;

    const campaigns = `
      <div class="card" style="margin-top:12px;">
        <div style="display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap;">
          <div style="font-weight:950;">📌 Campañas activas</div>
          <div class="muted">${tasks.length} activas</div>
        </div>
        ${list.length ? list.map(x=>`
          <div style="padding:10px 0;border-top:1px solid rgba(229,231,235,.6);cursor:pointer;" onclick="setSelectedTask('${x.t.id}');goTab('rendiciones')">
            <div style="font-weight:900;">${cleanConcept(x.t.title)}</div>
            <div class="muted" style="margin-top:6px;display:flex;gap:10px;flex-wrap:wrap;">
              <span class="tag ok">Rec ${formatCLP(x.rec)}</span>
              <span class="tag warn">Gas ${formatCLP(x.gas)}</span>
              <span class="tag ${x.disp<0?'danger':''}">Saldo ${formatCLP(x.disp)}</span>
              ${x.miss ? `<span class="tag danger">⚠️ sin boleta ${x.miss}</span>` : ``}
            </div>
          </div>
        `).join("") : `<div class="muted" style="margin-top:10px;">No hay campañas activas.</div>`}
      </div>
    `;

    const body = `${resumen}${quick}${campaigns}`;
    viewShell("Tesorero","", body, tab, "tesorero");
    return;
}


  const body =
    tab==="payments"
      ? `${renderPaymentsByCampaign("tesorero")}`
      : `${renderRendicionesVertical("tesorero")}`;

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
          { value: paymentsAmountStats("presidente").paidAmt, color: "#22c55e" },
          { value: paymentsAmountStats("presidente").pendAmt, color: "#f59e0b" }
        ],
        [
          { label: "Recaudado", color: "#22c55e", valueText: formatCLP(paymentsAmountStats("presidente").paidAmt) },
          { label: "Pendiente", color: "#f59e0b", valueText: formatCLP(paymentsAmountStats("presidente").pendAmt) }
        ]
      )}

      ${chartCard(
        "Estado de campañas",
        "Activas vs cerradas",
        [
          { value: campaignsStatusStats().active, color: "#22c55e" },
          { value: campaignsStatusStats().closed, color: "#64748b" }
        ],
        [
          { label: "Activas", color: "#22c55e", valueText: String(campaignsStatusStats().active) },
          { label: "Cerradas", color: "#64748b", valueText: String(campaignsStatusStats().closed) }
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
      ? `${renderPaymentsByCampaign("presidente")}`
      : `${renderRendicionesVertical("presidente")}`;

  viewShell("Presidente","Administración del curso", body, tab, "presidente");
}



function renderDirectivaPaymentsGrouped(role){
  const filter = 'all'; // filtros globales desactivados

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




function endOfMonthYYYYMM(ym){
  const parts = ym.split("-");
  const y = parseInt(parts[0],10);
  const m = parseInt(parts[1],10);
  const d = new Date(y, m, 0);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  return `${yyyy}-${mm}-${dd}`;
}
function currentYYYYMM(){
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
}
function computeMonthlySnapshot(ym){
  const cutoff = endOfMonthYYYYMM(ym);
  const cutoffDate = new Date(cutoff + "T23:59:59");

  const tasks = loadTasks().slice();
  const expenses = loadExpenses().slice();
  const payments = loadPayments().slice();

  function leq(val){
    if(!val) return false;
    const dt = new Date(String(val));
    if(isNaN(dt.getTime())) return false;
    return dt.getTime() <= cutoffDate.getTime();
  }

  const paidPays = payments.filter(p=>p.status==="paid");
  const pendingPays = payments.filter(p=>p.status!=="paid" && p.status!=="opted_out");

  const recaudadoCurso = paidPays.reduce((a,b)=>a+Number(b.amount||0),0);
  const adeudadoCurso = pendingPays.reduce((a,b)=>a+Number(b.amount||0),0);

  const gastosHasta = expenses.filter(e=>true); // MVP: todos los gastos registrados
  const gastadoCurso = gastosHasta.reduce((a,b)=>a+Number(b.amount||0),0);

  const deudoresTotales = new Set(pendingPays.map(p=>p.apoderadoRole||"apoderado")).size;

  const cerradas = tasks.filter(t=>isTaskClosed(t) && leq(t.closedAt || t.createdAt || t.dueDate || ""));

  const perCampaign = cerradas.map(t=>{
    const rec = paidPays.filter(p=>p.fromTaskId===t.id).reduce((a,b)=>a+Number(b.amount||0),0);
    const adeu = pendingPays.filter(p=>p.fromTaskId===t.id).reduce((a,b)=>a+Number(b.amount||0),0);
    const gas = gastosHasta.filter(e=>e.scope==="campaign" && e.campaignId===t.id).reduce((a,b)=>a+Number(b.amount||0),0);
    return { taskId: t.id, title: t.title, recaudado: rec, adeudado: adeu, gastado: gas, disponible: rec-gas };
  });

  return {
    id: uid("repM"),
    period: ym,
    cutoff,
    generatedAt: isoDate(),
    closedCampaignsCount: cerradas.length,
    recaudadoCurso,
    adeudadoCurso,
    gastadoCurso,
    disponibleCurso: recaudadoCurso - gastadoCurso,
    deudoresTotales,
    perCampaign
  };
}

function openGenerateMonthlyReportModal(){
  const user = getUser();
  if(!user || !(user.role==="tesorero" || user.role==="presidente")){
    alert("Solo directiva puede generar informes.");
    return;
  }
  const root = document.getElementById("modalRoot");
  if(!root) return;

  const ym = currentYYYYMM();
  root.innerHTML = `
    <div style="position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:10000;display:flex;align-items:flex-end;justify-content:center;padding:14px;">
      <div class="card" style="width:min(720px,100%);margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap;">
          <div>
            <div style="font-weight:950;font-size:18px;">Generar informe mensual</div>
            <div class="muted">Snapshot acumulado al cierre del mes</div>
          </div>
          <button class="btn ghost" onclick="closeModal()">Cerrar</button>
        </div>

        <div style="margin-top:12px;">
          <label style="font-weight:900;">Mes (YYYY-MM)</label>
          <input id="repMonth" type="month" value="${ym}" />
          <div class="muted" style="margin-top:6px;">Ej: 2026-01 genera snapshot acumulado hasta 31/01/2026.</div>
        </div>

        <div class="actions" style="justify-content:flex-end;margin-top:14px;">
          <button class="btn ghost" onclick="closeModal()">Cancelar</button>
          <button class="btn primary" onclick="generateMonthlyReport()">Generar</button>
        </div>
      </div>
    </div>
  `;
}


function generateMonthlyReport(){
  let ym = (document.getElementById("repMonth")?.value || "").toString();
  // Normalize: trim and convert any unicode dashes to '-'
  ym = ym.trim()
         .replace(/[–—−]/g, "-")
         .replace(/\s+/g, "");
  // Accept YYYY-MM-DD by slicing
  if(/^\d{4}-\d{2}-\d{2}$/.test(ym)) ym = ym.slice(0,7);
  // Accept YYYY/MM by converting
  if(/^\d{4}\/\d{2}$/.test(ym)) ym = ym.replace("/", "-");

  if(!/^\d{4}-\d{2}$/.test(ym)){
    alert("Formato inválido. Usa YYYY-MM (ej: 2026-01).");
    return;
  }
  const snap = computeMonthlySnapshot(ym);
  const list = loadMonthlyReports();
  const filtered = list.filter(r=>r.period !== ym);
  filtered.unshift(snap);
  saveMonthlyReports(filtered);
  try{ clearMonthlyReportSeen(ym); }catch(e){}
  closeModal();
  alert("Informe mensual generado ✅ (demo)");
  goTab("rendiciones");
}


/* ---------- Rendiciones UI ---------- */





function expensesMissingBoleta(list){
  return (list||[]).filter(e=>!(e.attachments && e.attachments.length)).length;
}

function renderExpensesTree(list, role){
  const items = (list||[]).slice();
  // Flatten: include parents and children as independent rows
  items.sort((a,b)=>{
    const da = String(a.date||"");
    const db = String(b.date||"");
    if(da !== db) return db.localeCompare(da); // recent first
    return String(a.title||"").localeCompare(String(b.title||""));
  });
  return items.length ? items.map(e=>rendicionRow(e, role)).join("") : `<div class="muted">Sin rendiciones registradas.</div>`;
}




function rendicionRow(e, role){
  const hasAtt = e.attachments && e.attachments.length;
  const attBtn = hasAtt ? `<button class="btn ghost" onclick="openAttachment('${e.attachments[0].dataUrl}')">Ver boleta</button>` : `<span class="muted">Sin boleta</span>`;
  const vendor = e.vendor ? ` · ${e.vendor}` : ``;
  const note = e.note ? `<div class="muted" style="margin-top:6px;">${e.note}</div>` : ``;

  return `
    <div style="padding:12px 0;border-top:1px solid rgba(229,231,235,.6);display:flex;justify-content:space-between;gap:12px;align-items:flex-start;">
      <div style="min-width:0;">
        <div style="font-weight:950;">${e.title}</div>
        <div class="muted" style="margin-top:4px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
          ${e.category}${vendor} · <span style="font-weight:900;">${fmtDM(e.date)}</span>
        </div>
        <div style="margin-top:6px;font-weight:950;">${formatCLP(e.amount)}</div>
        ${note}
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;align-items:flex-end;flex-shrink:0;">
        ${attBtn}
      </div>
    </div>
  `;
}



function renderRendiciones(role){
  const collected = courseCollected();
  const spent = courseSpent();
  const avail = courseAvailable();

  const general = expensesByScope("general");
  const tasks = loadTasks().slice();

  const generalHtml = `
    <div class="card" style="margin-top:12px;">
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;">
        <div style="font-weight:950;">Rendición general del curso</div>
        ${(role==="tesorero"||role==="presidente") ? `<button class="btn primary" onclick="openCreateExpense('general','')">+ Agregar</button>` : ``}
      </div>
      ${general.length ? renderExpensesTree(general, role) : `<div class="muted" style="padding-top:10px;">Sin gastos generales.</div>`}
    </div>
  `;

  const campaignsHtml = tasks.map(t=>{
    const exp = expensesForCampaign(t.id);
    const spentC = sumExpenses(exp);
    const colC = loadPayments().filter(p=>p.status==="paid" && p.fromTaskId===t.id).reduce((a,b)=>a+Number(b.amount||0),0);
    const availC = colC - spentC;

    return `
      <div class="card" style="margin-top:12px;">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;">
          <div>
            <div style="font-weight:950;">${t.title}</div>
            <div class="muted">Recaudado ${formatCLP(colC)} · Gastado ${formatCLP(spentC)} · Disponible ${formatCLP(availC)}</div>
          </div>
          ${(role==="tesorero"||role==="presidente") ? `<button class="btn ghost" onclick="openCreateExpense('campaign','${t.id}')">+ Agregar gasto</button>` : ``}
        </div>
        ${exp.length ? renderExpensesTree(exp, role) : `<div class="muted" style="padding-top:10px;">Sin gastos asociados.</div>`}
      </div>
    `;
  }).join("");

  return `
    <div class="card">
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap;"><div style="font-weight:950;font-size:18px;">Rendiciones</div>${(role==="tesorero"||role==="presidente") ? `<button class="btn primary" onclick="openGenerateMonthlyReportModal()">Generar informe mensual</button>` : ``}</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px;"><div class="tag ok">Recaudado ${formatCLP(collected)}</div><div class="tag warn">Gastado ${formatCLP(spent)}</div><div class="tag">Disponible ${formatCLP(avail)}</div></div>
    </div>
    ${generalHtml}
    ${campaignsHtml}
  `;
}


function renderRendicionesVertical(role){
  const collected = courseCollected();
  const spent = courseSpent();
  const avail = courseAvailable();

  const general = expensesByScope("general");
  const tasks = loadTasks().slice();

  const summary = `
    <div class="card">
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap;"><div style="font-weight:950;font-size:18px;">Rendiciones</div>${(role==="tesorero"||role==="presidente") ? `<button class="btn primary" onclick="openGenerateMonthlyReportModal()">Generar informe mensual</button>` : ``}</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px;"><div class="tag ok">Recaudado ${formatCLP(collected)}</div><div class="tag warn">Gastado ${formatCLP(spent)}</div><div class="tag">Disponible ${formatCLP(avail)}</div></div>
    </div>
  `;

  // General card
  const genOpenKey = "rend_general";
  const genOpen = isSectionOpen(genOpenKey);
  const generalCard = `
    <div class="card" style="margin-top:12px;position:relative;overflow:hidden;">
      <div style="position:absolute;left:0;top:0;bottom:0;width:6px;background:#64748b;"></div>
      <button class="btn ghost" style="width:100%;text-align:left;padding:12px 12px 10px 12px;display:block;" onclick="toggleSectionOpen('${genOpenKey}')">
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
          <div style="font-size:20px;">🧾</div>
          <div style="font-weight:950;font-size:17px;">Rendición general del curso</div>
        </div>
        <div class="muted" style="margin-top:6px;display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
          <span class="tag">${formatCLP(sumExpenses(general))}</span>
          <span class="tag">${genOpen ? "▲" : "▼"}</span>
        </div>
      </button>
      ${(role==="tesorero"||role==="presidente") ? `<div style="padding:0 12px 12px;"><button class="btn primary" onclick="openCreateExpense('general','')">+ Agregar gasto</button></div>` : `<div style="padding:0 12px 12px;"></div>`}
      ${genOpen ? `<div style="padding:0 12px 12px;">${general.length ? renderExpensesTree(general, role) : `<div class="muted">Sin gastos generales.</div>`}</div>` : ``}
    </div>
  `;

  // Campaign cards
  const campCards = tasks.map(t=>{
    const exp = expensesForCampaign(t.id);
    const spentC = sumExpenses(exp);
    const colC = loadPayments().filter(p=>p.status==="paid" && p.fromTaskId===t.id).reduce((a,b)=>a+Number(b.amount||0),0);
    const availC = colC - spentC;

    const accent = campaignAccent(t);
    const icon = campaignIcon(t, t.title);
    const status = campaignStatusForAp(t);
    const start = fmtDM(t.startDate), end = fmtDM(t.dueDate);
    const range = (start && end) ? `${start} → ${end}` : "";

    const key = `rend_${t.id}`;
    const open = isSectionOpen(key);

    const desc = `${t.type === "monthly" ? "Pago mensual" : "Pago único"}${(t.mandatoryParticipation === false) ? " · No obligatoria" : " · Obligatoria"}`;

    const nGastos = exp.filter(e=>!e.parentId).length;
    const missing = (typeof expensesMissingBoleta === "function") ? expensesMissingBoleta(exp) : 0;
    const resumenRend = `Rendición: ${formatCLP(spentC)} · ${nGastos} gastos${missing ? ` · ${missing} sin boleta` : ``}`;

    return `
      <div class="card" style="margin-top:12px;position:relative;overflow:hidden;">
        <div style="position:absolute;left:0;top:0;bottom:0;width:6px;background:${accent};"></div>

        <div style="padding:12px 12px 12px 12px;">
          <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;">
            <button class="btn ghost" style="flex:1;min-width:240px;text-align:left;padding:0;border:none;background:transparent;" onclick="toggleSectionOpen('${key}')">
              <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
                <div style="font-size:20px;">${icon}</div>
                <div style="font-weight:950;font-size:17px;">${cleanConcept(t.title)}</div>
                <span class="tag" style="background:rgba(100,116,139,.10);border:1px solid rgba(100,116,139,.20);color:#111827;">Campaña</span>
              </div>

              <div class="muted" style="margin-top:6px;display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
                ${range ? `<span>${range}</span>` : ``}
                <span class="tag" style="background:rgba(0,0,0,.04);color:${status.color};border:1px solid rgba(0,0,0,.06);">${status.label}</span>
                <span class="muted" style="font-weight:800;">${desc}</span>
                <span class="tag">${open ? "▲" : "▼"}</span>
              </div>

              <div style="margin-top:12px;display:flex;gap:12px;flex-wrap:wrap;">
                <div class="tag ok">Recaudado ${formatCLP(colC)}</div>
                <div class="tag warn">Gastado ${formatCLP(spentC)}</div>
                <div class="tag ${availC<0?'danger':''}">Disponible ${formatCLP(availC)}</div>
              </div>

              <div class="muted" style="margin-top:10px;font-weight:900;">
                ${resumenRend}
              </div>
            </button>

            <div style="flex-shrink:0;display:flex;flex-direction:column;gap:10px;align-items:flex-end;">
              ${(role==="tesorero"||role==="presidente")
                ? `<button class="btn ghost" onclick="openCreateExpense('campaign','${t.id}','')">+ Agregar gasto</button>`
                : ``}
            </div>
          </div>

          ${open ? `
            <div style="margin-top:12px;border-top:1px solid rgba(229,231,235,.6);padding-top:12px;">
              <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;">
                <div style="font-weight:950;">Rendición</div>
                <div class="muted" style="font-weight:900;">${nGastos} gastos · ${missing ? `${missing} sin boleta` : `0 sin boleta`}</div>
              </div>
              <div style="margin-top:10px;">
                ${exp.length ? renderExpensesTree(exp, role) : `<div class="muted">Sin gastos asociados.</div>`}
              </div>
            </div>
          ` : ``}
        </div>
      </div>
    `;
  }).join("");


  return summary + generalCard + campCards;
}

/* ---------- router ---------- */
function renderByRole(role, tab){
  if(role === "apoderado") renderApoderado(tab);
  else if(role === "tesorero") renderTesorero(tab);
  else if(role === "presidente") renderPresidente(tab);
  else renderApoderado(tab);
}
function getCurrentTab(){ return localStorage.getItem("cursapp_current_tab") || "home"; }

function goTab(tab){
  if(tab==="rendiciones") tab="withdraws";

  localStorage.setItem("cursapp_current_tab", tab);

  const user = getUser();
  if(!user) return logout();
  renderByRole(user.role, tab);
}

/* ---------- boot ---------- */
document.addEventListener("DOMContentLoaded", () => {
  const user = getUser();
  if(!user){
    window.location.href = "/index.html";
    return;
  }

  // ✅ DEMO seed controlado desde el tope del archivo (NO redeclarar DEMO_SEED acá)
  if (typeof DEMO_SEED !== "undefined" && DEMO_SEED) {
    if (typeof DEMO_SEED !== "undefined" && DEMO_SEED) {

      ensureSeedPayments();

      ensureSeedExpenses();

    }
}

  normalizePaymentIds();
  renderHeader();
  renderByRole(user.role, "home");
});
