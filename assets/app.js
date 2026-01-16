/* Cursapp assets/app.js – v3.6 (Pagos por alumno + scope por curso)
   Reglas clave:
   - Cada curso tiene su propia directiva y su propia "caja".
   - Un usuario (aunque sea presidente/tesorero) SOLO puede pagar por sus alumnos del curso activo.
   - No se muestran otros cursos en esta demo (scope = 1 curso activo).

   Mantiene:
   - Votaciones de retiros (apoderado vota / presidente cierra)
   - Pasarela de pago demo + comprobantes
   - Cobros: presidente para todos o alumno específico (en el curso activo)
*/

function jload(k,d){ try{return JSON.parse(localStorage.getItem(k)) ?? d}catch(e){return d} }
function jsave(k,v){ localStorage.setItem(k, JSON.stringify(v)); }
function today(){ return new Date().toISOString().slice(0,10); }
function formatCLP(n){ return Number(n||0).toLocaleString('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}); }

const COURSE_KEY='cursapp_active_course_v1';
const COURSES_KEY='cursapp_courses_v1';

const TASKS_KEY='cursapp_tasks_v1';
const PAY_KEY='cursapp_course_payments_v1';
const STUDENTS_KEY='cursapp_students_v1';

const WITHDRAWALS_KEY='cursapp_withdrawals_v1';
const RECEIPTS_KEY='cursapp_receipts_v1';

function makeId(prefix){
  return (prefix||'id')+'_'+Math.random().toString(16).slice(2)+'_'+Date.now().toString(16);
}

/* ---- LOGOUT ---- */
function logout(){
  localStorage.removeItem('cursapp_demo_user');
  try{ window.CursappAuth && window.CursappAuth.clearUser && window.CursappAuth.clearUser(); }catch(e){}
  location.href='login.html';
}

/* ---- COURSE SCOPE ---- */
function ensureCourse(){
  let courses=jload(COURSES_KEY,[]);
  if(!courses.length){
    courses=[{id:'curso_2b_colegio_x_2026', name:'2°B 2026', colegio:'Colegio X'}];
    jsave(COURSES_KEY,courses);
  }
  let active=jload(COURSE_KEY,null);
  if(!active) { active=courses[0].id; jsave(COURSE_KEY,active); }
  return {courses, active};
}
function getActiveCourseId(){ return ensureCourse().active; }
function getActiveCourse(){
  const {courses, active}=ensureCourse();
  return courses.find(c=>c.id===active) || courses[0];
}

/* ---- STUDENTS (by course) ---- */
function ensureStudents(){
  const courseId=getActiveCourseId();
  const u=jload('cursapp_demo_user',null);
  const myName=(u?.name||'Apoderado').trim();

  let students=jload(STUDENTS_KEY,[]);
  // If no students for this course, seed demo roster + my 2 kids
  const hasThisCourse = students.some(s=>s.cursoId===courseId);
  if(!hasThisCourse){
    students = students.filter(s=>s.cursoId!==courseId);
    // demo students (otros apoderados)
    const others = [
      {id:makeId('alu'), cursoId:courseId, alumno:'Ana Soto (Hija)', apoderado:'Ana Soto'},
      {id:makeId('alu'), cursoId:courseId, alumno:'Carlos Díaz (Hijo)', apoderado:'Carlos Díaz'},
      {id:makeId('alu'), cursoId:courseId, alumno:'María Pérez (Hija)', apoderado:'María Pérez'},
    ];
    // your two siblings (same apoderado)
    const mine = [
      {id:makeId('alu'), cursoId:courseId, alumno:'Hermano 1', apoderado: myName},
      {id:makeId('alu'), cursoId:courseId, alumno:'Hermano 2', apoderado: myName},
    ];
    students = [...mine, ...others, ...students];
    jsave(STUDENTS_KEY, students);
  }
  return students;
}

function getMyStudents(){
  const courseId=getActiveCourseId();
  const u=jload('cursapp_demo_user',null);
  const myName=(u?.name||'Apoderado').trim();
  const students=ensureStudents();
  return students.filter(s=>s.cursoId===courseId && s.apoderado===myName);
}

/* ---- PAYMENTS (by student + course) ---- */
function seedPaymentsIfEmpty(){
  const courseId=getActiveCourseId();
  let pays=jload(PAY_KEY,[]);

  // If already have payments for this course, keep
  if(pays.some(p=>p.cursoId===courseId)) return;

  const students=ensureStudents().filter(s=>s.cursoId===courseId);

  // Create a fee for each student
  const seeded = students.map((s,i)=>({
    id: makeId('pay'),
    cursoId: courseId,
    alumnoId: s.id,
    apoderado: s.apoderado,
    alumno: s.alumno,
    concept: 'Cuota Marzo',
    amount: 10000,
    status: (i%3===0?'paid':'pending'),
    date: (i%3===0?'2026-03-08':'-'),
    createdAt: '2026-03-01',
    type: 'fee'
  }));

  pays = [...seeded, ...pays];
  jsave(PAY_KEY,pays);
}

/* ---- TASKS -> PAYMENTS (shared within course) ---- */
function syncTasks(){
  const courseId=getActiveCourseId();
  const tasks=jload(TASKS_KEY,[]).filter(t=>t.cursoId===courseId);
  let pays=jload(PAY_KEY,[]);
  const students=ensureStudents().filter(s=>s.cursoId===courseId);

  tasks.forEach(t=>{
    students.forEach(s=>{
      const exists = pays.some(p=>p.cursoId===courseId && p.type==='task' && p.alumnoId===s.id && p.concept===t.name);
      if(!exists){
        pays.unshift({
          id: makeId('pay'),
          cursoId: courseId,
          alumnoId: s.id,
          apoderado: s.apoderado,
          alumno: s.alumno,
          concept: t.name,
          amount: t.amount,
          status: 'pending',
          date: '-',
          createdAt: today(),
          type: 'task'
        });
      }
    });
  });

  jsave(PAY_KEY,pays);
}

/* ---- RECEIPTS ---- */
function addReceiptForPayment(p, method){
  const receipts=jload(RECEIPTS_KEY,[]);
  const rec = {
    id: makeId('rc'),
    paymentId: p.id,
    cursoId: p.cursoId,
    alumnoId: p.alumnoId,
    alumno: p.alumno,
    apoderado: p.apoderado,
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
  const course = getActiveCourse();

  container.innerHTML = `
    <div class="row" style="align-items:flex-start;">
      <div>
        <h1 style="margin:0;">${title}</h1>
        <div class="muted">${course.name} · ${course.colegio}</div>
      </div>
      <div class="actions" style="margin-top:0;">
        <button class="btn ghost" onclick="toggleQuickMenu()">Secciones</button>
      </div>
    </div>

    <div id="quickMenu" class="card" style="display:none; margin-top:12px;">
      <div class="segmented">
        <button onclick="goTo('home')">Inicio</button>
        <button onclick="goTo('payments')">Pagos</button>
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

/* ---- HOME (keep simple KPIs) ---- */
function renderHome(role){
  const el=document.getElementById('sec-home'); if(!el) return;

  const courseId=getActiveCourseId();
  const pays=jload(PAY_KEY,[]).filter(p=>p.cursoId===courseId);
  const collected = pays.filter(p=>p.status==='paid').reduce((a,b)=>a+Number(b.amount||0),0);
  const pending = pays.filter(p=>p.status==='pending').reduce((a,b)=>a+Number(b.amount||0),0);

  el.innerHTML = `
    <p class="muted">Resumen financiero del curso</p>
    <div class="grid">
      <div class="card span4">
        <div class="kpiLabel">Total recaudado</div>
        <div class="kpiValue">${formatCLP(collected)}</div>
      </div>
      <div class="card span4">
        <div class="kpiLabel">Total pendiente</div>
        <div class="kpiValue">${formatCLP(pending)}</div>
      </div>
      <div class="card span4">
        <div class="kpiLabel">Tus alumnos</div>
        <div class="kpiValue">${getMyStudents().length}</div>
      </div>
    </div>
  `;
}

/* ---- PAYMENTS (by alumno) ---- */
function renderPayments(role){
  const el=document.getElementById('sec-payments'); if(!el) return;

  const isAdmin = (role==='tesorero' || role==='presidente');
  const myStudents=getMyStudents();

  const studentOptions = myStudents.map(s=>`<option value="${s.id}">${escapeHtml(s.alumno)}</option>`).join('');
  const selected = window.__cursapp_selected_student || (myStudents[0]?.id || '');

  el.innerHTML = `
    <div class="row">
      <div>
        <h2 style="margin:0;">Pagos</h2>
        <div class="muted">Solo pagos del curso activo · por alumno</div>
      </div>
      ${role==='presidente' ? `<button class="btn primary" onclick="openCreateTask()">Crear cobro</button>` : ``}
    </div>

    <div class="card" style="margin-top:12px;">
      <div class="row">
        <div>
          <div class="kpiLabel">Alumno</div>
          <select id="studentSelect" style="margin-top:6px;" onchange="selectStudent(this.value)">
            ${studentOptions || `<option value="">Sin alumnos</option>`}
          </select>
        </div>
        <div class="muted">Como directiva, puedes gestionar el curso; para pagar, solo tus alumnos.</div>
      </div>
    </div>

    ${isAdmin ? `
      <div class="card" style="margin-top:12px;">
        <div class="row">
          <div style="font-weight:950;">Filtros (curso)</div>
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
            <th>Alumno</th>
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
      <div class="muted">Para todos los alumnos del curso o para un alumno específico.</div>
      <div class="actions">
        <input id="taskName" placeholder="Concepto (ej: Cuota Abril)" style="flex:1;min-width:180px;">
        <select id="taskTarget" style="min-width:240px;">
          <option value="all">Para todos</option>
        </select>
        <input id="taskAmount" placeholder="Monto (ej: 12000)" inputmode="numeric" style="width:160px;">
        <button class="btn primary" onclick="createTask()">Guardar</button>
        <button class="btn" onclick="closeCreateTask()">Cancelar</button>
      </div>
    </div>

    <div id="payModalRoot"></div>
  `;

  // init selections
  const sel=document.getElementById('studentSelect');
  if(sel && selected) sel.value = selected;

  fillTaskTarget();
  window.__cursapp_payment_filter = window.__cursapp_payment_filter || 'all';

  renderPaymentsTable();
}

function selectStudent(studentId){
  window.__cursapp_selected_student = studentId;
  renderPaymentsTable();
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

function renderPaymentsTable(){
  const tbody=document.getElementById('paymentsTbody');
  if(!tbody) return;

  const courseId=getActiveCourseId();
  seedPaymentsIfEmpty();
  syncTasks();

  let pays=jload(PAY_KEY,[]).filter(p=>p.cursoId===courseId);

  const u=jload('cursapp_demo_user',null);
  const role=(u?.role||'').toLowerCase();
  const isAdmin = (role==='tesorero' || role==='presidente');

  // Only allow paying for my students
  const myStudents = getMyStudents();
  const myStudentIds = new Set(myStudents.map(s=>s.id));

  const selectedStudent = window.__cursapp_selected_student || (myStudents[0]?.id || '');
  const view = selectedStudent ? pays.filter(p=>p.alumnoId===selectedStudent) : [];

  // Admin filters apply only to course management (still within selected student for simplicity)
  let filtered=view;
  const f=window.__cursapp_payment_filter || 'all';
  if(isAdmin){
    if(f==='pending') filtered = filtered.filter(p=>p.status==='pending');
    if(f==='paid') filtered = filtered.filter(p=>p.status==='paid');
  }

  const rows = filtered.slice(0,80).map(p=>{
    const tag = p.status==='paid' ? `<span class="tag ok">Pagado</span>` : `<span class="tag warn">Pendiente</span>`;
    const receipt = getReceiptByPaymentId(p.id);

    const canPay = myStudentIds.has(p.alumnoId) && p.status!=='paid';
    const action = canPay
      ? `<button class="btn primary" onclick="openPayModal('${p.id}')">Pagar</button>`
      : (p.status==='paid' && receipt)
          ? `<button class="btn ghost" onclick="openReceipt('${p.id}')">Comprobante</button>`
          : `<span class="muted">—</span>`;

    return `<tr>
      <td>${escapeHtml(p.alumno||'-')}</td>
      <td>${escapeHtml(p.concept||'-')}</td>
      <td>${formatCLP(p.amount||0)}</td>
      <td>${tag}</td>
      <td style="text-align:right; white-space:nowrap;">${action}</td>
    </tr>`;
  }).join('');

  tbody.innerHTML = rows || `<tr><td colspan="5" class="muted">Sin datos para el alumno seleccionado</td></tr>`;
}

/* ---- Create Cobro (course scope) ---- */
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
  const courseId=getActiveCourseId();
  const students=ensureStudents().filter(s=>s.cursoId===courseId);
  sel.innerHTML = '<option value="all">Para todos</option>' + students.map(s=>(
    '<option value="'+s.id+'">'+escapeHtml(s.alumno)+' · '+escapeHtml(s.apoderado)+'</option>'
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
  const courseId=getActiveCourseId();

  if(!concept || !amount || amount<=0){ alert('Completa concepto y monto'); return; }

  if(target==='all'){
    const tasks=jload(TASKS_KEY,[]);
    tasks.unshift({id: makeId('chg'), cursoId: courseId, name: concept, amount, createdAt:today()});
    jsave(TASKS_KEY,tasks);
    syncTasks();
  } else {
    // target is alumnoId
    let pays=jload(PAY_KEY,[]);
    const student = ensureStudents().find(s=>s.id===target);
    if(!student){ alert('Alumno no encontrado'); return; }

    const exists = pays.some(p=>p.cursoId===courseId && p.type==='task' && p.alumnoId===target && p.concept===concept);
    if(!exists){
      pays.unshift({
        id: makeId('pay'),
        cursoId: courseId,
        alumnoId: student.id,
        apoderado: student.apoderado,
        alumno: student.alumno,
        concept,
        amount,
        status:'pending',
        date:'-',
        createdAt:today(),
        type:'task'
      });
      jsave(PAY_KEY,pays);
    }
  }

  if(nameEl) nameEl.value='';
  if(amountEl) amountEl.value='';
  closeCreateTask();

  renderPaymentsTable();
  alert('Cobro creado (demo).');
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
            <div class="muted">${escapeHtml(p.alumno)} · ${escapeHtml(p.concept||'Cobro')} · ${formatCLP(p.amount||0)}</div>
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

        <div class="row"><div><div class="k">Curso</div><div class="v">${escapeHtml(getActiveCourse().name)}</div></div><div><div class="k">Monto</div><div class="v">${formatCLP(rec.amount)}</div></div></div>
        <div class="row"><div><div class="k">Alumno</div><div class="v">${escapeHtml(rec.alumno)}</div></div><div><div class="k">Apoderado</div><div class="v">${escapeHtml(rec.apoderado)}</div></div></div>
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

/* ---- WITHDRAWALS (kept minimal for demo continuity) ---- */
function renderWithdrawals(role){
  const el=document.getElementById('sec-withdrawals'); if(!el) return;
  el.innerHTML = `
    <div class="row">
      <div>
        <h2 style="margin:0;">Retiros</h2>
        <div class="muted">Votaciones del curso (demo)</div>
      </div>
    </div>
    <div id="withdrawalsBody" style="margin-top:12px;"></div>
  `;
  renderWithdrawalsBody();
}
function renderWithdrawalsBody(){
  const body=document.getElementById('withdrawalsBody'); if(!body) return;
  const u=jload('cursapp_demo_user',null);
  const role=(u?.role||'').toLowerCase();
  const withdrawals=jload(WITHDRAWALS_KEY,[]);
  const active=withdrawals.filter(w=>w.status==='voting');

  body.innerHTML = `
    <div class="card">
      <div style="font-weight:950;">Votaciones activas</div>
      <div class="muted">${active.length ? 'Vota Sí/No (demo)' : 'No hay votaciones activas'}</div>
      ${active.map(w=>`
        <div class="row" style="margin-top:10px;">
          <div>
            <div style="font-weight:900;">${escapeHtml(w.reason||'Retiro')}</div>
            <div class="muted">Monto: ${formatCLP(w.amount||0)}</div>
          </div>
          <span class="tag warn">En votación</span>
        </div>
      `).join('')}
    </div>
  `;
}

/* ---- INIT ---- */
document.addEventListener('DOMContentLoaded', ()=>{
  ensureCourse();
  ensureStudents();
  seedPaymentsIfEmpty();
  syncTasks();
  seedWithdrawalsIfEmpty();

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
    .replaceAll('\"', "&quot;")
    .replaceAll("'", "&#039;");
}
