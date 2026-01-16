/* Cursapp assets/app.js – v3.5 (Pagos realistas + pasarela demo + comprobantes)
   Incluye:
   - Retiros con votación (apoderado vota, presidente cierra)
   - Pagos:
     * Vista Curso (tesorero/presidente): filtros + marcar pagado/pendiente
     * Vista Como Apoderado (todos los roles): pagar con "pasarela" demo + generar comprobante
   - Cobros:
     * Presidente crea cobro para todos o para un apoderado específico
   - Gráficos (SVG)
*/

function jload(k,d){ try{return JSON.parse(localStorage.getItem(k)) ?? d}catch(e){return d} }
function jsave(k,v){ localStorage.setItem(k, JSON.stringify(v)); }
function today(){ return new Date().toISOString().slice(0,10); }
function formatCLP(n){ return Number(n||0).toLocaleString('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}); }

const TASKS_KEY='cursapp_tasks_v1';
const PAY_KEY='cursapp_course_payments_v1';
const ROSTER_KEY='cursapp_roster_v1';
const WITHDRAWALS_KEY='cursapp_withdrawals_v1';
const RECEIPTS_KEY='cursapp_receipts_v1';
const MY_APO_KEY='cursapp_my_apoderado_v1';

function makeId(prefix){
  return (prefix||'id')+'_'+Math.random().toString(16).slice(2)+'_'+Date.now().toString(16);
}

/* ---- LOGOUT ---- */
function logout(){
  localStorage.removeItem('cursapp_demo_user');
  try{ window.CursappAuth && window.CursappAuth.clearUser && window.CursappAuth.clearUser(); }catch(e){}
  location.href='login.html';
}

/* ---- ROSTER / SEED ---- */
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

function seedPaymentsIfEmpty(){
  let pays=jload(PAY_KEY,[]);
  if(pays.length) return;
  const roster=ensureRoster();
  pays = roster.map((n,i)=>({
    id: makeId('pay'),
    type:'fee',
    name:n,
    concept:'Cuota Marzo',
    amount:10000,
    status:(i%3===0?'paid':'pending'),
    date:(i%3===0?'2026-03-08':'-'),
    createdAt:'2026-03-01'
  }));
  jsave(PAY_KEY,pays);
}

function seedWithdrawalsIfEmpty(){
  const w=jload(WITHDRAWALS_KEY,[]);
  if(w.length) return;
  jsave(WITHDRAWALS_KEY, [{
    id: makeId('wd'),
    reason: 'Rifa del huevo',
    amount: 70000,
    createdAt: today(),
    createdBy: 'tesorero',
    status: 'voting',
    votes: { yes: [], no: [] }
  }]);
}

/* ---- TASKS -> PAYMENTS (shared) ---- */
function syncTasks(){
  const tasks=jload(TASKS_KEY,[]);
  let pays=jload(PAY_KEY,[]);
  const roster=ensureRoster();
  tasks.forEach(t=>{
    roster.forEach(n=>{
      if(!pays.some(p=>p.type==='task'&&p.name===n&&p.concept===t.name)){
        pays.unshift({id: makeId('pay'), type:'task',name:n,concept:t.name,amount:t.amount,status:'pending',date:'-',createdAt:today()});
      }
    });
  });
  jsave(PAY_KEY,pays);
}

/* ---- VIEW (pay as apoderado) ---- */
function getMyApoderado(){
  const u=jload('cursapp_demo_user',null);
  const stored=jload(MY_APO_KEY,null);
  if(stored) return stored;
  if((u?.role||'').toLowerCase()==='apoderado' && u?.name) return u.name;
  const roster=ensureRoster();
  return roster[0] || (u?.name || 'Apoderado');
}
function setMyApoderado(name){ jsave(MY_APO_KEY, name); }

/* ---- RECEIPTS ---- */
function addReceiptForPayment(p, method){
  const receipts=jload(RECEIPTS_KEY,[]);
  const rec = {
    id: makeId('rc'),
    paymentId: p.id,
    name: p.name,
    concept: p.concept,
    amount: p.amount,
    method,
    paidAt: new Date().toISOString()
  };
  receipts.unshift(rec);
  jsave(RECEIPTS_KEY, receipts);
  return rec;
}
function getReceiptByPaymentId(pid){
  const receipts=jload(RECEIPTS_KEY,[]);
  return receipts.find(r=>r.paymentId===pid) || null;
}

/* ---- NAV ---- */
function goTo(id){
  document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
  const el=document.getElementById('sec-'+id); if(el) el.classList.add('active');

  document.querySelectorAll('[data-tab]').forEach(b=>b.classList.remove('active'));
  const active=document.querySelector('[data-tab="'+id+'"]'); if(active) active.classList.add('active');

  if(id==='payments'){ syncTasks(); renderPaymentsTable(); }
  if(id==='withdrawals'){ renderWithdrawalsBody(); }
  closeQuickMenu();
}

function toggleQuickMenu(){
  const qm=document.getElementById('quickMenu'); if(!qm) return;
  const open=qm.classList.toggle('open');
  qm.style.display=open?'block':'none';
}
function closeQuickMenu(){
  const qm=document.getElementById('quickMenu'); if(!qm) return;
  qm.classList.remove('open'); qm.style.display='none';
}

/* ---- UI ---- */
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

    <nav class="tabbar floating" style="z-index:9999;pointer-events:auto;">
      <button class="tab active" data-tab="home" onclick="goTo('home')"><span class="ico">🏠</span><span>Inicio</span></button>
      <button class="tab" data-tab="payments" onclick="goTo('payments')"><span class="ico">💳</span><span>Pagos</span></button>
      <button class="tab" data-tab="withdrawals" onclick="goTo('withdrawals')"><span class="ico">🏦</span><span>Retiros</span></button>
    </nav>
  `;

  renderHome(role);
  renderPayments(role);
  renderWithdrawals(role);
}

/* ---- HOME ---- */
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
        <div class="kpiValue">${formatCLP(k.monthCollected || 380000)}</div>
      </div>
      <div class="card span4">
        <div class="kpiLabel">Total pendiente</div>
        <div class="kpiValue">${formatCLP(k.monthPending || 22000)}</div>
      </div>
      <div class="card span4">
        <div class="kpiLabel">Retiros en votación</div>
        <div class="kpiValue">${countActiveWithdrawals()}</div>
      </div>

      <div class="card span12" style="${enableCharts ? '' : 'display:none;'}">
        <div class="row">
          <div><div style="font-weight:950;">Recaudación últimos 12 meses</div><div class="muted">Cobrado vs pendiente</div></div>
          <span class="pill">Demo</span>
        </div>
        <div style="margin-top:12px;" id="chartArea"></div>
      </div>
    </div>
  `;

  if(enableCharts){ renderChartCollection(); }
}

function renderChartCollection(){
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
    <svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}">${bars}${labels}</svg>
    <div class="row" style="margin-top:8px;">
      <span class="pill"><span style="width:10px;height:10px;border-radius:3px;background:var(--primary);display:inline-block;"></span> Cobrado</span>
      <span class="pill"><span style="width:10px;height:10px;border-radius:3px;background:#cbd5e1;display:inline-block;"></span> Pendiente</span>
    </div>
  `;
}

/* ---- PAYMENTS ---- */
function renderPayments(role){
  const el=document.getElementById('sec-payments'); if(!el) return;

  const isAdmin = (role==='tesorero' || role==='presidente');
  const isApoderado = (role==='apoderado');
  const canToggleMyView = !isApoderado;
  const viewMode = canToggleMyView ? (window.__cursapp_view_mode || 'course') : 'my';

  el.innerHTML = `
    <div class="row">
      <div>
        <h2 style="margin:0;">Pagos</h2>
        <div class="muted">${(viewMode==='my' || isApoderado) ? 'Simula pago y genera comprobante' : 'Vista curso (admin)'}</div>
      </div>
      ${role==='presidente' && viewMode==='course' ? `<button class="btn primary" onclick="openCreateTask()">Crear cobro</button>` : ``}
    </div>

    ${canToggleMyView ? `
      <div class="card" style="margin-top:12px;">
        <div class="row">
          <div style="font-weight:950;">Vista</div>
          <div class="segmented" style="margin-top:0;">
            <button class="${viewMode==='course'?'active':''}" onclick="setViewMode('course')">Curso</button>
            <button class="${viewMode==='my'?'active':''}" onclick="setViewMode('my')">Como apoderado</button>
          </div>
        </div>
        <div class="actions" style="margin-top:10px;">
          <button class="btn ghost" onclick="pickMyApoderado()">Elegir apoderado demo</button>
          <span class="pill">Actual: <strong>${escapeHtml(getMyApoderado())}</strong></span>
        </div>
      </div>
    ` : ``}

    ${isAdmin && viewMode==='course' ? `
      <div class="card" style="margin-top:12px;">
        <div class="row">
          <div style="font-weight:950;">Filtros</div>
          <div class="segmented" style="margin-top:0;">
            <button id="fltAll" class="active" onclick="setPaymentFilter('all')">Todos</button>
            <button id="fltPending" onclick="setPaymentFilter('pending')">Pendientes</button>
            <button id="fltPaid" onclick="setPaymentFilter('paid')">Pagados</button>
          </div>
        </div>
      </div>
    ` : ``}

    <div class="card" style="margin-top:12px;">
      <table>
        <thead>
          <tr>
            <th>Apoderado</th>
            <th>Concepto</th>
            <th>Monto</th>
            <th>Estado</th>
            <th style="text-align:right;">Acción</th>
          </tr>
        </thead>
        <tbody id="paymentsTbody"></tbody>
      </table>
    </div>

    <div class="card" id="createTaskCard" style="display:none; margin-top:12px;">
      <div style="font-weight:950;">Nuevo cobro</div>
      <div class="muted">Para todos o para un apoderado específico.</div>
      <div class="actions">
        <input id="taskName" placeholder="Concepto (ej: Cuota Abril)" style="flex:1;min-width:180px;padding:10px 12px;border:1px solid var(--border);border-radius:10px;">
        <select id="taskTarget" style="padding:10px 12px;border:1px solid var(--border);border-radius:10px;min-width:220px;">
          <option value="all">Para todos</option>
        </select>
        <input id="taskAmount" placeholder="Monto (ej: 12000)" inputmode="numeric" style="width:160px;padding:10px 12px;border:1px solid var(--border);border-radius:10px;">
        <button class="btn primary" onclick="createTask()">Guardar</button>
        <button class="btn" onclick="closeCreateTask()">Cancelar</button>
      </div>
    </div>

    <div id="payModalRoot"></div>
  `;

  fillTaskTarget();
  renderPaymentsTable();
}

function setViewMode(mode){
  window.__cursapp_view_mode = mode;
  renderPayments((jload('cursapp_demo_user',null)?.role || 'apoderado').toLowerCase());
}

function setPaymentFilter(f){
  window.__cursapp_payment_filter = f;
  const bAll=document.getElementById('fltAll');
  const bPend=document.getElementById('fltPending');
  const bPaid=document.getElementById('fltPaid');
  [bAll,bPend,bPaid].forEach(b=>b&&b.classList.remove('active'));
  if(f==='pending' && bPend) bPend.classList.add('active');
  else if(f==='paid' && bPaid) bPaid.classList.add('active');
  else if(bAll) bAll.classList.add('active');
  renderPaymentsTable();
}

function pickMyApoderado(){
  const roster = ensureRoster();
  const current = getMyApoderado();
  const choice = prompt('Escribe el nombre exacto del apoderado demo:\\n' + roster.join('\\n'), current);
  if(choice && roster.includes(choice)){
    setMyApoderado(choice);
    renderPayments((jload('cursapp_demo_user',null)?.role || 'apoderado').toLowerCase());
  } else if(choice){
    alert('Nombre no encontrado en roster.');
  }
}

function renderPaymentsTable(){
  const tbody=document.getElementById('paymentsTbody');
  if(!tbody) return;

  seedPaymentsIfEmpty();
  syncTasks();

  let pays=jload(PAY_KEY,[]);
  // normalize ids
  let changed=false;
  pays.forEach(p=>{ if(!p.id){ p.id=makeId('pay'); changed=true; } });
  if(changed) jsave(PAY_KEY,pays);

  const u=jload('cursapp_demo_user',null);
  const role=(u?.role||'').toLowerCase();
  const isAdmin = (role==='tesorero' || role==='presidente');
  const viewMode = (role==='apoderado') ? 'my' : (window.__cursapp_view_mode || 'course');
  const myName = (role==='apoderado') ? (u?.name || getMyApoderado()) : getMyApoderado();

  let view=pays;

  if(viewMode==='my'){
    view = pays.filter(p=>p.name===myName);
  } else {
    const f = window.__cursapp_payment_filter || 'all';
    if(f==='pending') view = view.filter(p=>p.status==='pending');
    if(f==='paid') view = view.filter(p=>p.status==='paid');
  }

  const rows = view.slice(0,120).map(p=>{
    const tag = p.status==='paid' ? `<span class="tag ok">Pagado</span>` : `<span class="tag warn">Pendiente</span>`;
    const receipt = getReceiptByPaymentId(p.id);

    let action = `<span class="muted">—</span>`;
    if(viewMode==='my' && p.status!=='paid'){
      action = `<button class="btn primary" onclick="openPayModal('${p.id}')">Pagar</button>`;
    } else if(p.status==='paid' && receipt){
      action = `<button class="btn ghost" onclick="openReceipt('${p.id}')">Comprobante</button>`;
    } else if(isAdmin && viewMode==='course'){
      const toggleLabel = (p.status==='paid') ? 'Marcar pendiente' : 'Marcar pagado';
      const receiptBtn = receipt ? ` <button class="btn ghost" onclick="openReceipt('${p.id}')">Comprobante</button>` : '';
      action = `<button class="btn" onclick="togglePaid('${p.id}')">${toggleLabel}</button>${receiptBtn}`;
    }

    return `<tr>
      <td>${escapeHtml(p.name||'-')}</td>
      <td>${escapeHtml(p.concept||'-')}</td>
      <td>${formatCLP(p.amount||0)}</td>
      <td>${tag}</td>
      <td style="text-align:right; white-space:nowrap;">${action}</td>
    </tr>`;
  }).join('');

  tbody.innerHTML = rows || `<tr><td colspan="5" class="muted">Sin datos</td></tr>`;
}

function togglePaid(id){
  let pays=jload(PAY_KEY,[]);
  const idx=pays.findIndex(x=>x.id===id);
  if(idx<0) return;
  const next = (pays[idx].status==='paid') ? 'pending' : 'paid';
  pays[idx].status = next;
  pays[idx].date = next==='paid' ? today() : '-';
  jsave(PAY_KEY,pays);

  if(next==='paid' && !getReceiptByPaymentId(id)){
    addReceiptForPayment(pays[idx], 'Conciliación (Demo)');
  }

  renderPaymentsTable();
}

/* ---- Create Cobro ---- */
function openCreateTask(){
  const c=document.getElementById('createTaskCard'); if(c) c.style.display='block';
  fillTaskTarget();
}
function closeCreateTask(){
  const c=document.getElementById('createTaskCard'); if(c) c.style.display='none';
}

function fillTaskTarget(){
  const sel=document.getElementById('taskTarget');
  if(!sel) return;
  const current = sel.value || 'all';
  const roster = ensureRoster();
  sel.innerHTML = '<option value="all">Para todos</option>' + roster.map(n=>(
    '<option value="'+escapeHtml(n)+'">'+escapeHtml(n)+'</option>'
  )).join('');
  const opt = Array.from(sel.options).find(o=>o.value===current);
  if(opt) sel.value=current;
}

function createTask(){
  const nameEl=document.getElementById('taskName');
  const amountEl=document.getElementById('taskAmount');
  const targetEl=document.getElementById('taskTarget');

  const concept=(nameEl?.value||'').trim();
  const amount=Number((amountEl?.value||'').trim());
  const target=(targetEl?.value||'all').trim();

  if(!concept || !amount || amount<=0){ alert('Completa concepto y monto'); return; }

  if(target==='all'){
    const tasks=jload(TASKS_KEY,[]);
    tasks.unshift({name: concept, amount, createdAt:today()});
    jsave(TASKS_KEY,tasks);
    syncTasks();
  } else {
    let pays=jload(PAY_KEY,[]);
    const exists = pays.some(p=>p.type==='task' && p.name===target && p.concept===concept);
    if(!exists){
      pays.unshift({id: makeId('pay'), type:'task', name: target, concept, amount, status:'pending', date:'-', createdAt:today()});
      jsave(PAY_KEY,pays);
    }
  }

  if(nameEl) nameEl.value='';
  if(amountEl) amountEl.value='';
  closeCreateTask();

  renderPaymentsTable();
  alert(target==='all' ? 'Cobro creado para todos (demo).' : 'Cobro creado para '+target+' (demo).');
}

/* ---- PAYMENT GATEWAY (DEMO) + RECEIPT ---- */
function openPayModal(paymentId){
  const root=document.getElementById('payModalRoot');
  if(!root) return;

  const pays=jload(PAY_KEY,[]);
  const p=pays.find(x=>x.id===paymentId);
  if(!p) return;

  root.innerHTML = `
    <div style="position:fixed; inset:0; background:rgba(17,24,39,.45); z-index:10000; display:flex; align-items:flex-end; justify-content:center; padding:14px;">
      <div class="card" style="width:min(560px, 100%); margin-bottom:12px;">
        <div class="row">
          <div>
            <div style="font-weight:950; font-size:18px;">Pasarela de pago (Demo)</div>
            <div class="muted">${escapeHtml(p.concept||'Cobro')} · ${formatCLP(p.amount||0)}</div>
          </div>
          <button class="btn" onclick="closePayModal()">Cerrar</button>
        </div>

        <div style="margin-top:12px;">
          <div class="kpiLabel">Método</div>
          <select id="payMethod" style="width:100%; margin-top:6px;">
            <option value="Webpay (Demo)">Webpay (Demo)</option>
            <option value="Transferencia (Demo)">Transferencia (Demo)</option>
          </select>
        </div>

        <div style="margin-top:12px;">
          <div class="kpiLabel">Tarjeta (demo)</div>
          <input placeholder="1234 5678 9012 3456" inputmode="numeric" style="width:100%; margin-top:6px;">
          <div class="row" style="margin-top:8px;">
            <input placeholder="MM/AA" inputmode="numeric" style="flex:1;">
            <input placeholder="CVC" inputmode="numeric" style="width:120px;">
          </div>
          <div class="muted" style="margin-top:8px;">No se guarda información real. Es solo simulación.</div>
        </div>

        <div class="actions" style="justify-content:flex-end;">
          <button class="btn ghost" onclick="closePayModal()">Cancelar</button>
          <button class="btn primary" onclick="confirmPay('${p.id}')">Pagar ${formatCLP(p.amount||0)}</button>
        </div>
      </div>
    </div>
  `;
}

function closePayModal(){
  const root=document.getElementById('payModalRoot');
  if(root) root.innerHTML='';
}

function confirmPay(paymentId){
  const method = document.getElementById('payMethod')?.value || 'Webpay (Demo)';
  let pays=jload(PAY_KEY,[]);
  const idx=pays.findIndex(x=>x.id===paymentId);
  if(idx<0) return;

  pays[idx].status='paid';
  pays[idx].date=today();
  jsave(PAY_KEY,pays);

  addReceiptForPayment(pays[idx], method);

  closePayModal();
  renderPaymentsTable();
  alert('Pago aprobado (demo). Comprobante generado.');
}

function openReceipt(paymentId){
  const rec = getReceiptByPaymentId(paymentId);
  if(!rec){ alert('No hay comprobante.'); return; }

  const html = `
    <html lang="es">
    <head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
      <title>Comprobante ${rec.id}</title>
      <style>
        body{ font-family: system-ui, -apple-system; background:#f5f7fb; margin:0; padding:16px; }
        .card{ background:#fff; border:1px solid #e5e7eb; border-radius:16px; padding:16px; max-width:560px; margin:0 auto; }
        h1{ font-size:18px; margin:0 0 10px; }
        .muted{ color:#6b7280; font-size:13px; }
        .row{ display:flex; justify-content:space-between; gap:12px; margin-top:10px; flex-wrap:wrap; }
        .k{ color:#6b7280; font-size:12px; text-transform:uppercase; letter-spacing:.04em; font-weight:800; }
        .v{ font-weight:900; }
        button{ border:none; padding:10px 12px; border-radius:12px; background:#4f46e5; color:#fff; font-weight:800; width:100%; margin-top:14px; }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>Comprobante de pago</h1>
        <div class="muted">ID: ${rec.id}</div>

        <div class="row"><div><div class="k">Apoderado</div><div class="v">${escapeHtml(rec.name)}</div></div><div><div class="k">Monto</div><div class="v">${formatCLP(rec.amount)}</div></div></div>
        <div class="row"><div><div class="k">Concepto</div><div class="v">${escapeHtml(rec.concept)}</div></div><div><div class="k">Método</div><div class="v">${escapeHtml(rec.method)}</div></div></div>
        <div class="row"><div><div class="k">Fecha</div><div class="v">${escapeHtml(new Date(rec.paidAt).toLocaleString('es-CL'))}</div></div><div></div></div>

        <button onclick="window.print()">Imprimir / Guardar PDF</button>
      </div>
    </body>
    </html>
  `;

  const w = window.open('', '_blank');
  if(!w){ alert('Bloqueado por el navegador.'); return; }
  w.document.open(); w.document.write(html); w.document.close();
}

/* ---- WITHDRAWALS + VOTING ---- */
function renderWithdrawals(role){
  const el=document.getElementById('sec-withdrawals'); if(!el) return;
  el.innerHTML = `
    <div class="row">
      <div>
        <h2 style="margin:0;">Retiros</h2>
        <div class="muted">${(role==='apoderado') ? 'Vota solicitudes del curso (demo)' : 'Solicitudes y votaciones (demo)'}</div>
      </div>
    </div>
    <div id="withdrawalsBody" style="margin-top:12px;"></div>
  `;
  renderWithdrawalsBody();
}

function renderWithdrawalsBody(){
  const body=document.getElementById('withdrawalsBody');
  if(!body) return;

  const u=jload('cursapp_demo_user',null);
  const role=(u?.role||'').toLowerCase();
  const canRequest = (role==='presidente' || role==='tesorero');
  const canClose = (role==='presidente');

  const withdrawals=jload(WITHDRAWALS_KEY,[]);
  const active = withdrawals.filter(w=>w.status==='voting');
  const closed = withdrawals.filter(w=>w.status==='approved' || w.status==='rejected').slice(0,5);

  body.innerHTML = `
    ${canRequest ? `
      <div class="card">
        <div style="font-weight:950;">Solicitar retiro</div>
        <div class="muted">Se enviará a votación del curso.</div>
        <div class="actions" style="flex-wrap:wrap;">
          <input id="wdReason" placeholder="Motivo (ej: Pago bus paseo)" style="flex:1;min-width:180px;">
          <input id="wdAmount" placeholder="Monto (ej: 50000)" inputmode="numeric" style="width:180px;">
          <button class="btn primary" onclick="submitWithdrawal()">Enviar a votación</button>
        </div>
      </div>
    ` : `
      <div class="card">
        <div style="font-weight:950;">Solicitar retiro</div>
        <div class="muted">No disponible para apoderado.</div>
      </div>
    `}

    <div class="card" style="margin-top:12px;">
      <div style="font-weight:950;">Votaciones activas</div>
      <div class="muted">${active.length ? 'Vota Sí/No. Se muestra conteo (demo)' : 'No hay votaciones activas'}</div>
      ${active.length ? active.map(w=>withdrawalCard(w, u, role, canClose)).join('') : ``}
    </div>

    <div class="card" style="margin-top:12px; ${closed.length ? '' : 'display:none;'}">
      <div style="font-weight:950;">Votaciones cerradas</div>
      <div class="muted">Últimos resultados (demo)</div>
      ${closed.map(w=>closedCard(w)).join('')}
    </div>
  `;
}

function withdrawalCard(w, u, role, canClose){
  const yes = (w.votes?.yes || []).length;
  const no = (w.votes?.no || []).length;

  const voter = (u?.name || '').trim();
  const votedYes = voter && (w.votes?.yes || []).includes(voter);
  const votedNo = voter && (w.votes?.no || []).includes(voter);

  const voteBtns = (role==='apoderado') ? `
    <div class="actions" style="margin-top:10px; justify-content:flex-end;">
      <button class="btn ${votedYes ? 'primary' : ''}" onclick="voteWithdrawal('${w.id}','yes')">👍 Sí (${yes})</button>
      <button class="btn ${votedNo ? 'danger' : ''}" onclick="voteWithdrawal('${w.id}','no')">👎 No (${no})</button>
    </div>
  ` : `
    <div class="row" style="margin-top:10px;">
      <span class="pill">👍 Sí: ${yes}</span>
      <span class="pill">👎 No: ${no}</span>
    </div>
  `;

  const closeBtn = canClose ? `
    <div class="actions" style="margin-top:10px; justify-content:flex-end;">
      <button class="btn ghost" onclick="closeVoting('${w.id}')">Cerrar votación</button>
    </div>
  ` : '';

  return `
    <div class="card" style="margin-top:12px;">
      <div class="row">
        <div>
          <div style="font-weight:900;">${escapeHtml(w.reason || 'Retiro')}</div>
          <div class="muted">Monto: ${formatCLP(w.amount || 0)} · Creado: ${escapeHtml(w.createdAt||'-')}</div>
        </div>
        <span class="tag warn">En votación</span>
      </div>
      ${voteBtns}
      ${closeBtn}
    </div>
  `;
}

function closedCard(w){
  const yes = (w.votes?.yes || []).length;
  const no = (w.votes?.no || []).length;
  const tag = w.status==='approved' ? `<span class="tag ok">Aprobado</span>` : `<span class="tag bad">Rechazado</span>`;
  return `
    <div class="row" style="margin-top:10px;">
      <div>
        <div style="font-weight:900;">${escapeHtml(w.reason || 'Retiro')}</div>
        <div class="muted">Monto: ${formatCLP(w.amount || 0)} · 👍 ${yes} / 👎 ${no}</div>
      </div>
      ${tag}
    </div>
  `;
}

function submitWithdrawal(){
  const reason=(document.getElementById('wdReason')?.value||'').trim();
  const amount=Number((document.getElementById('wdAmount')?.value||'').trim());
  if(!reason || !amount || amount<=0){ alert('Completa motivo y monto.'); return; }

  const u=jload('cursapp_demo_user',null);
  const withdrawals=jload(WITHDRAWALS_KEY,[]);
  withdrawals.unshift({
    id: makeId('wd'),
    reason,
    amount,
    createdAt: today(),
    createdBy: (u?.role||'').toLowerCase(),
    status: 'voting',
    votes: { yes: [], no: [] }
  });
  jsave(WITHDRAWALS_KEY,withdrawals);

  alert('Solicitud enviada a votación (demo).');
  renderWithdrawalsBody();
}

function voteWithdrawal(id, side){
  const u=jload('cursapp_demo_user',null);
  const voter=(u?.name||'').trim();
  if(!voter){ alert('Falta usuario'); return; }

  const withdrawals=jload(WITHDRAWALS_KEY,[]);
  const w = withdrawals.find(x=>x.id===id);
  if(!w || w.status!=='voting') return;

  w.votes = w.votes || {yes:[], no:[]};
  w.votes.yes = (w.votes.yes||[]).filter(n=>n!==voter);
  w.votes.no  = (w.votes.no ||[]).filter(n=>n!==voter);

  if(side==='yes') w.votes.yes.unshift(voter);
  else w.votes.no.unshift(voter);

  jsave(WITHDRAWALS_KEY,withdrawals);
  renderWithdrawalsBody();
}

function closeVoting(id){
  const withdrawals=jload(WITHDRAWALS_KEY,[]);
  const w = withdrawals.find(x=>x.id===id);
  if(!w || w.status!=='voting') return;

  const yes=(w.votes?.yes||[]).length;
  const no=(w.votes?.no||[]).length;

  w.status = (yes>=no) ? 'approved' : 'rejected';
  jsave(WITHDRAWALS_KEY,withdrawals);
  renderWithdrawalsBody();
}

function countActiveWithdrawals(){
  const withdrawals=jload(WITHDRAWALS_KEY,[]);
  return withdrawals.filter(w=>w.status==='voting').length || 0;
}

/* ---- INIT ---- */
document.addEventListener('DOMContentLoaded', ()=>{
  seedPaymentsIfEmpty();
  syncTasks();
  seedWithdrawalsIfEmpty();

  const u=jload('cursapp_demo_user',null);
  const w=document.getElementById('whoLine');
  if(u&&w){
    w.textContent = (u.name||'Usuario')+' · '+(u.role||'');
    w.className = 'who';
  }

  // defaults
  window.__cursapp_payment_filter = window.__cursapp_payment_filter || 'all';
  window.__cursapp_view_mode = window.__cursapp_view_mode || ((u?.role||'').toLowerCase()==='apoderado' ? 'my' : 'course');

  const role = (u?.role || '').toLowerCase() || 'apoderado';
  renderUI(role);
});

/* ---- helpers ---- */
function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('\"', "&quot;")
    .replaceAll("'", "&#039;");
}
function escapeShort(str, n){
  const s=String(str||'');
  return s.length>n ? s.slice(0,n-1)+'…' : s;
}
