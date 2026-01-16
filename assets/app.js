/* Cursapp assets/app.js – UI V3 estable
   - Menú sup/inf + secciones + gráficos (SVG sin librerías)
   - Roles: apoderado (solo lectura en retiros), tesorero, presidente
   - Tareas compartidas (presidente crea cobros → se reflejan en tesorero/apoderado)
*/

function jload(k,d){ try{return JSON.parse(localStorage.getItem(k)) ?? d}catch(e){return d} }
function jsave(k,v){ localStorage.setItem(k, JSON.stringify(v)); }
function today(){ return new Date().toISOString().slice(0,10); }
function formatCLP(n){
  const x = Number(n||0);
  return x.toLocaleString('es-CL', { style:'currency', currency:'CLP', maximumFractionDigits:0 });
}
function sum(arr){ return (arr||[]).reduce((a,b)=>a+Number(b||0),0); }

/* ---- LOGOUT ---- */
function logout(){
  localStorage.removeItem('cursapp_demo_user');
  try{ window.CursappAuth && window.CursappAuth.clearUser && window.CursappAuth.clearUser(); }catch(e){}
  location.href='login.html';
}

/* ---- TASKS SHARED ---- */
const TASKS_KEY='cursapp_tasks_v1';
const PAY_KEY='cursapp_course_payments_v1';
const ROSTER_KEY='cursapp_roster_v1';

function ensureRoster(){
  let r=jload(ROSTER_KEY,[]);
  if(!r.length){
    r=['Ana Soto','Carlos Díaz','María Pérez','José Rivas','Paula Muñoz','Felipe Torres'];
    jsave(ROSTER_KEY,r);
  }
  const u=jload('cursapp_demo_user',null);
  if(u?.name && !r.includes(u.name)){
    r.unshift(u.name); jsave(ROSTER_KEY,r);
  }
  return r;
}

function syncTasks(){
  const tasks=jload(TASKS_KEY,[]);
  let pays=jload(PAY_KEY,[]);
  const roster=ensureRoster();
  tasks.forEach(t=>{
    roster.forEach(n=>{
      if(!pays.some(p=>p.type==='task'&&p.name===n&&p.concept===t.name)){
        pays.unshift({type:'task',name:n,concept:t.name,amount:t.amount,status:'pending',date:'-',createdAt:today()});
      }
    });
  });
  jsave(PAY_KEY,pays);
}

/* ---- NAV ---- */
function goTo(id){
  document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
  const el=document.getElementById('sec-'+id); if(el) el.classList.add('active');

  document.querySelectorAll('[data-tab]').forEach(b=>b.classList.remove('active'));
  const activeBtn=document.querySelector('[data-tab="'+id+'"]'); if(activeBtn) activeBtn.classList.add('active');

  if(id==='payments'){ syncTasks(); renderPaymentsTable(); }
  if(id==='home'){ renderHomeKPIs(); }
  closeQuickMenu();
}

/* ---- QUICK MENU ---- */
function toggleQuickMenu(){
  const qm=document.getElementById('quickMenu'); if(!qm) return;
  const open=qm.classList.toggle('open');
  qm.style.display=open?'block':'none';
}
function closeQuickMenu(){
  const qm=document.getElementById('quickMenu'); if(!qm) return;
  qm.classList.remove('open'); qm.style.display='none';
}

/* ---- UI RENDER ---- */
function roleTitle(role){
  if(role==='presidente') return 'Presidente';
  if(role==='tesorero') return 'Tesorero';
  return 'Apoderado';
}

function renderUI(role){
  const container=document.querySelector('.container');
  if(!container) return;

  const title = roleTitle(role);

  container.innerHTML = `
    <div class="row" style="align-items:flex-start;">
      <div>
        <h1 style="margin:0;">${title}</h1>
        <div class="muted">${title} · Curso</div>
      </div>
      <div class="actions" style="margin-top:0;">
        <button class="btn ghost" onclick="toggleQuickMenu()">Secciones</button>
      </div>
    </div>

    <div id="quickMenu" class="card" style="display:none; margin-top:12px;">
      <div class="segmented">
        <button onclick="goTo('home')">Inicio</button>
        <button onclick="goTo('payments')">Pagos curso</button>
        <button onclick="goTo('withdrawals')">Retiros</button>
      </div>
    </div>

    <section id="sec-home" class="section active"></section>
    <section id="sec-payments" class="section"></section>
    <section id="sec-withdrawals" class="section"></section>

    <nav class="tabbar floating">
      <button class="tab active" data-tab="home" onclick="goTo('home')">
        <span class="ico">🏠</span><span>Inicio</span>
      </button>
      <button class="tab" data-tab="payments" onclick="goTo('payments')">
        <span class="ico">💳</span><span>Pagos</span>
      </button>
      <button class="tab" data-tab="withdrawals" onclick="goTo('withdrawals')">
        <span class="ico">🏦</span><span>Retiros</span>
      </button>
    </nav>
  `;

  renderHome(role);
  renderPayments(role);
  renderWithdrawals(role);

  renderHomeKPIs();
  renderPaymentsTable();
}

function renderHome(role){
  const el=document.getElementById('sec-home'); if(!el) return;
  const demo = window.CursappDemoData || {};
  const k = demo.kpis || {};
  const enableCharts = (window.CURSAPP_ENABLE_CHARTS ?? true);

  el.innerHTML = `
    <p class="muted">Resumen financiero del curso</p>
    <div class="grid">
      <div class="card span4">
        <div class="kpiLabel">Total recaudado</div>
        <div class="kpiValue" id="kpiCollected">${formatCLP(k.monthCollected || 380000)}</div>
      </div>
      <div class="card span4">
        <div class="kpiLabel">Total pendiente</div>
        <div class="kpiValue" id="kpiPending">${formatCLP(k.monthPending || 22000)}</div>
      </div>
      <div class="card span4">
        <div class="kpiLabel">Retiros en votación</div>
        <div class="kpiValue" id="kpiVotes">1</div>
      </div>

      <div class="card span12" id="chartsCard" style="${enableCharts ? '' : 'display:none;'}">
        <div class="row">
          <div>
            <div style="font-weight:950;">Recaudación últimos 12 meses</div>
            <div class="muted">Cobrado vs pendiente</div>
          </div>
          <span class="pill">Demo</span>
        </div>
        <div style="margin-top:12px;" id="chartArea"></div>
      </div>

      <div class="card span12" id="chartPendingCard" style="${(enableCharts && role!=='apoderado') ? '' : 'display:none;'}">
        <div class="row">
          <div>
            <div style="font-weight:950;">Pendientes por apoderado</div>
            <div class="muted">Top 6 pendientes (demo)</div>
          </div>
          <span class="pill">Demo</span>
        </div>
        <div style="margin-top:12px;" id="chartPendingArea"></div>
      </div>

      <div class="card span12" id="chartBudgetCard" style="${(enableCharts && role==='presidente') ? '' : 'display:none;'}">
        <div class="row">
          <div>
            <div style="font-weight:950;">Presupuesto vs gasto</div>
            <div class="muted">Por categoría (demo)</div>
          </div>
          <span class="pill">Demo</span>
        </div>
        <div style="margin-top:12px;" id="chartBudgetArea"></div>
      </div>
    </div>
  `;

  if(enableCharts){
    renderSVGChartCollection();
    if(role!=='apoderado') renderSVGChartPendingByPerson();
    if(role==='presidente') renderSVGChartBudget();
  }
}

function renderHomeKPIs(){
  // placeholder: aquí puedes recalcular KPIs desde PAY_KEY
}

/* ---- CHARTS (SVG) ---- */
function renderSVGChartCollection(){
  const demo = window.CursappDemoData || {};
  const months = demo.months || [];
  const col = (demo.collection && demo.collection.collected) || [];
  const pen = (demo.collection && demo.collection.pending) || [];
  const area=document.getElementById('chartArea');
  if(!area || !months.length || !col.length) return;

  const maxV = Math.max(...col, ...pen, 1);
  const w = 900, h = 220, pad = 20;
  const n = months.length;
  const barW = Math.floor((w - pad*2) / n) - 4;
  function y(v){ return h - pad - Math.round((v/maxV)*(h - pad*2)); }

  let bars = '';
  for(let i=0;i<n;i++){
    const x = pad + i*(barW+4);
    const yc = y(col[i]||0);
    const yp = y(pen[i]||0);
    const hc = (h - pad) - yc;
    const hp = (h - pad) - yp;
    bars += `<rect x="${x}" y="${yc}" width="${Math.max(6, Math.floor(barW*0.6))}" height="${hc}" rx="6" fill="var(--primary)" opacity="0.9"></rect>`;
    bars += `<rect x="${x+Math.floor(barW*0.62)}" y="${yp}" width="${Math.max(4, Math.floor(barW*0.38))}" height="${hp}" rx="6" fill="#cbd5e1"></rect>`;
  }

  let labels='';
  for(let i=0;i<n;i+=2){
    const x = pad + i*(barW+4);
    labels += `<text x="${x+4}" y="${h-4}" font-size="11" fill="var(--muted)">${months[i]}</text>`;
  }

  area.innerHTML = `
    <svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}">
      ${bars}
      ${labels}
    </svg>
    <div class="row" style="margin-top:8px;">
      <span class="pill"><span style="width:10px;height:10px;border-radius:3px;background:var(--primary);display:inline-block;"></span> Cobrado</span>
      <span class="pill"><span style="width:10px;height:10px;border-radius:3px;background:#cbd5e1;display:inline-block;"></span> Pendiente</span>
    </div>
  `;
}

function renderSVGChartPendingByPerson(){
  const demo = window.CursappDemoData || {};
  const pays = jload(PAY_KEY, []);
  // pending by person from pays
  const map = {};
  pays.forEach(p=>{
    if(p.status==='pending'){
      map[p.name]=(map[p.name]||0)+Number(p.amount||0);
    }
  });
  // fallback to demo roster
  if(Object.keys(map).length===0){
    ensureRoster().forEach((n,i)=> map[n]=(6-i)*7000 );
  }
  const data = Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,6);
  const area=document.getElementById('chartPendingArea');
  if(!area || !data.length) return;

  const maxV = Math.max(...data.map(d=>d[1]), 1);
  const w=900, rowH=34, pad=20, h=pad*2 + rowH*data.length;
  function x(v){ return pad + Math.round((v/maxV)*(w - pad*2)); }

  let rows='';
  data.forEach((d,i)=>{
    const name=d[0], val=d[1];
    const y = pad + i*rowH;
    const barX = pad+180;
    const barW = Math.max(6, x(val) - barX);
    rows += `
      <text x="${pad}" y="${y+22}" font-size="12" fill="var(--text)">${escapeShort(name,18)}</text>
      <rect x="${barX}" y="${y+8}" width="${barW}" height="16" rx="8" fill="var(--primary)" opacity="0.85"></rect>
      <text x="${barX+barW+8}" y="${y+22}" font-size="12" fill="var(--muted)">${formatCLP(val)}</text>
    `;
  });

  area.innerHTML = `
    <svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}">
      ${rows}
    </svg>
  `;
}

function renderSVGChartBudget(){
  const demo = window.CursappDemoData || {};
  const budget = demo.budget || [];
  const area=document.getElementById('chartBudgetArea');
  if(!area || !budget.length) return;

  const maxV = Math.max(...budget.map(b=>Math.max(b.planned||0,b.spent||0)), 1);
  const w=900, h=240, pad=20;
  const n=budget.length;
  const colW = Math.floor((w-pad*2)/n) - 10;
  function y(v){ return h - pad - Math.round((v/maxV)*(h - pad*2)); }

  let bars='';
  budget.forEach((b,i)=>{
    const x0 = pad + i*(colW+10);
    const yp = y(b.planned||0), ys = y(b.spent||0);
    const hp = (h-pad)-yp, hs=(h-pad)-ys;
    bars += `<rect x="${x0}" y="${yp}" width="${Math.max(8, Math.floor(colW*0.55))}" height="${hp}" rx="6" fill="#cbd5e1"></rect>`;
    bars += `<rect x="${x0+Math.floor(colW*0.6)}" y="${ys}" width="${Math.max(8, Math.floor(colW*0.4))}" height="${hs}" rx="6" fill="var(--primary)" opacity="0.9"></rect>`;
    bars += `<text x="${x0}" y="${h-4}" font-size="11" fill="var(--muted)">${escapeShort(b.category,10)}</text>`;
  });

  area.innerHTML = `
    <svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}">
      ${bars}
    </svg>
    <div class="row" style="margin-top:8px;">
      <span class="pill"><span style="width:10px;height:10px;border-radius:3px;background:#cbd5e1;display:inline-block;"></span> Presupuesto</span>
      <span class="pill"><span style="width:10px;height:10px;border-radius:3px;background:var(--primary);display:inline-block;"></span> Gasto</span>
    </div>
  `;
}

/* ---- PAYMENTS ---- */
function renderPayments(role){
  const el=document.getElementById('sec-payments'); if(!el) return;

  el.innerHTML = `
    <div class="row">
      <div>
        <h2 style="margin:0;">Pagos del curso</h2>
        <div class="muted">${role==='apoderado' ? 'Tus pagos y pendientes (demo)' : 'Cuotas + tareas del presidente (demo)'}</div>
      </div>
      ${role==='presidente' ? `<button class="btn primary" onclick="openCreateTask()">Crear cobro</button>` : ``}
    </div>

    <div class="card" style="margin-top:12px;">
      <table>
        <thead>
          <tr>
            <th>${role==='apoderado' ? 'Concepto' : 'Apoderado'}</th>
            <th>Concepto</th>
            <th>Monto</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody id="paymentsTbody"></tbody>
      </table>
    </div>

    <div class="card" id="createTaskCard" style="display:none; margin-top:12px;">
      <div style="font-weight:950;">Nuevo cobro</div>
      <div class="muted">Se agregará como pendiente para todos.</div>
      <div class="actions">
        <input id="taskName" placeholder="Concepto (ej: Cuota Abril)" style="flex:1;min-width:180px;padding:10px 12px;border:1px solid var(--border);border-radius:10px;">
        <input id="taskAmount" placeholder="Monto (ej: 12000)" inputmode="numeric" style="width:160px;padding:10px 12px;border:1px solid var(--border);border-radius:10px;">
        <button class="btn primary" onclick="createTask()">Guardar</button>
        <button class="btn" onclick="closeCreateTask()">Cancelar</button>
      </div>
    </div>
  `;
}

function renderPaymentsTable(){
  const tbody=document.getElementById('paymentsTbody');
  if(!tbody) return;

  // Seed inicial simple si no hay pagos
  let pays=jload(PAY_KEY,[]);
  if(!pays.length){
    pays = [
      {type:'fee', name:'Ana Soto', concept:'Cuota Marzo', amount:10000, status:'paid', date:'2026-03-10', createdAt:'2026-03-01'},
      {type:'fee', name:'Carlos Díaz', concept:'Cuota Marzo', amount:10000, status:'pending', date:'2026-03-10', createdAt:'2026-03-01'},
    ];
    jsave(PAY_KEY,pays);
  }

  // Asegura tareas sincronizadas
  syncTasks();
  pays=jload(PAY_KEY,[]);

  const u=jload('cursapp_demo_user',null);
  const role=(u?.role||'').toLowerCase();

  // filtro apoderado: ve solo sus filas
  const view = role==='apoderado' && u?.name ? pays.filter(p=>p.name===u.name) : pays;

  const rows = view.slice(0,40).map(p=>{
    const tag = p.status==='paid' ? `<span class="tag ok">Pagado</span>`
              : p.status==='pending' ? `<span class="tag warn">Pendiente</span>`
              : `<span class="tag">${escapeHtml(p.status||'-')}</span>`;

    const firstCol = (role==='apoderado') ? `${escapeHtml(p.concept||'-')}` : `${escapeHtml(p.name||'-')}`;

    return `<tr>
      <td>${firstCol}</td>
      <td>${escapeHtml(p.concept||'-')}</td>
      <td>${formatCLP(p.amount||0)}</td>
      <td>${tag}</td>
    </tr>`;
  }).join('');

  tbody.innerHTML = rows || `<tr><td colspan="4" class="muted">Sin datos</td></tr>`;
}

function openCreateTask(){ const c=document.getElementById('createTaskCard'); if(c) c.style.display='block'; }
function closeCreateTask(){ const c=document.getElementById('createTaskCard'); if(c) c.style.display='none'; }
function createTask(){
  const nameEl=document.getElementById('taskName');
  const amountEl=document.getElementById('taskAmount');
  const name=(nameEl?.value||'').trim();
  const amount=Number((amountEl?.value||'').trim());
  if(!name || !amount || amount<=0) return;

  const tasks=jload(TASKS_KEY,[]);
  tasks.unshift({name, amount, createdAt:today()});
  jsave(TASKS_KEY,tasks);

  if(nameEl) nameEl.value='';
  if(amountEl) amountEl.value='';
  closeCreateTask();
  syncTasks();
  renderPaymentsTable();
}

/* ---- WITHDRAWALS ---- */
function renderWithdrawals(role){
  const el=document.getElementById('sec-withdrawals'); if(!el) return;

  const canRequest = (role==='presidente' || role==='tesorero'); // apoderado = solo lectura (opción A)

  el.innerHTML = `
    <div class="row">
      <div>
        <h2 style="margin:0;">Retiros</h2>
        <div class="muted">${canRequest ? 'Solicitudes y votaciones (demo)' : 'Solo lectura: votaciones del curso (demo)'}</div>
      </div>
    </div>

    ${canRequest ? `
      <div class="card" style="margin-top:12px;">
        <div style="font-weight:950;">Solicitar retiro</div>
        <div class="muted">Se enviará a votación del curso.</div>
        <div class="actions">
          <input id="wdAmount" placeholder="Monto (ej: 50000)" inputmode="numeric" style="width:180px;padding:10px 12px;border:1px solid var(--border);border-radius:10px;">
          <button class="btn primary" onclick="submitWithdrawal()">Enviar a votación</button>
        </div>
      </div>
    ` : `
      <div class="card" style="margin-top:12px;">
        <div style="font-weight:950;">Solicitar retiro</div>
        <div class="muted">No disponible para apoderado.</div>
        <div class="actions">
          <button class="btn" disabled style="opacity:.6; cursor:not-allowed;">Solo Tesorero/Presidente</button>
        </div>
      </div>
    `}

    <div class="card" style="margin-top:12px;">
      <div style="font-weight:950;">Votaciones activas</div>
      <div class="muted">Demo: 1 votación activa</div>
      <div style="margin-top:10px;" class="row">
        <div>
          <div style="font-weight:900;">Retiro para actividad</div>
          <div class="muted">Monto: ${formatCLP(80000)}</div>
        </div>
        <span class="tag warn">En votación</span>
      </div>
    </div>
  `;
}

function submitWithdrawal(){ alert('Solicitud enviada (demo).'); }

/* ---- INIT ---- */
document.addEventListener('DOMContentLoaded', ()=>{
  syncTasks();

  const u=jload('cursapp_demo_user',null);
  const w=document.getElementById('whoLine');
  if(u&&w){
    w.textContent = (u.name||'Usuario')+' · '+(u.role||'');
    w.className = 'who';
  }

  const role = (u?.role || '').toLowerCase() || 'apoderado';
  renderUI(role);
});

/* ---- helpers ---- */
function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function escapeShort(str, n){
  const s=String(str||'');
  return s.length>n ? s.slice(0,n-1)+'…' : s;
}
