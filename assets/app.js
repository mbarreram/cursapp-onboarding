/* Cursapp assets/app.js – versión estable v3.1
   - Roles claros (Apoderado = solo lectura en retiros)
   - Solicitar retiro con MOTIVO + MONTO
   - Menú inferior flotante con íconos (clickeable iOS)
   - Gráficos por rol
*/

function jload(k,d){ try{return JSON.parse(localStorage.getItem(k)) ?? d}catch(e){return d} }
function jsave(k,v){ localStorage.setItem(k, JSON.stringify(v)); }
function today(){ return new Date().toISOString().slice(0,10); }
function formatCLP(n){ return Number(n||0).toLocaleString('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}); }

/* ---- LOGOUT ---- */
function logout(){
  localStorage.removeItem('cursapp_demo_user');
  location.href='login.html';
}

/* ---- STORAGE KEYS ---- */
const TASKS_KEY='cursapp_tasks_v1';
const PAY_KEY='cursapp_course_payments_v1';
const WITHDRAWALS_KEY='cursapp_withdrawals_v1';

/* ---- NAV ---- */
function goTo(id){
  document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
  const el=document.getElementById('sec-'+id); if(el) el.classList.add('active');

  document.querySelectorAll('[data-tab]').forEach(b=>b.classList.remove('active'));
  const active=document.querySelector('[data-tab="'+id+'"]'); if(active) active.classList.add('active');
}

/* ---- UI ---- */
function renderUI(role){
  const c=document.querySelector('.container'); if(!c) return;

  c.innerHTML = `
    <section id="sec-home" class="section active"></section>
    <section id="sec-payments" class="section"></section>
    <section id="sec-withdrawals" class="section"></section>

    <nav class="tabbar floating" style="z-index:9999;pointer-events:auto;">
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
}

/* ---- HOME ---- */
function renderHome(role){
  const el=document.getElementById('sec-home');
  el.innerHTML = `
    <p class="muted">Resumen financiero del curso</p>
    <div class="card"><strong>Total recaudado</strong><div>${formatCLP(380000)}</div></div>
    <div class="card"><strong>Total pendiente</strong><div>${formatCLP(22000)}</div></div>
  `;
}

/* ---- PAYMENTS ---- */
function renderPayments(role){
  const el=document.getElementById('sec-payments');
  el.innerHTML = `
    <h2>Pagos del curso</h2>
    <p class="muted">Demo</p>
  `;
}

/* ---- WITHDRAWALS ---- */
function renderWithdrawals(role){
  const el=document.getElementById('sec-withdrawals');
  const canRequest = (role==='presidente' || role==='tesorero');

  el.innerHTML = `
    <h2>Retiros</h2>

    ${canRequest ? `
      <div class="card">
        <div style="font-weight:700;">Solicitar retiro</div>
        <input id="wdReason" placeholder="Motivo (ej: Pago bus paseo)" style="width:100%;margin-top:8px;">
        <input id="wdAmount" placeholder="Monto" inputmode="numeric" style="width:100%;margin-top:8px;">
        <button class="btn primary" style="margin-top:8px;" onclick="submitWithdrawal()">Enviar a votación</button>
      </div>
    ` : `
      <div class="card">
        <div style="font-weight:700;">Solicitar retiro</div>
        <p class="muted">No disponible para apoderado</p>
      </div>
    `}
  `;
}

function submitWithdrawal(){
  const r=document.getElementById('wdReason')?.value.trim();
  const a=Number(document.getElementById('wdAmount')?.value.trim());
  if(!r || !a || a<=0){ alert('Completa motivo y monto'); return; }

  const w=jload(WITHDRAWALS_KEY,[]);
  w.unshift({reason:r,amount:a,status:'voting',createdAt:today()});
  jsave(WITHDRAWALS_KEY,w);

  alert('Solicitud enviada a votación (demo)');
}

/* ---- INIT ---- */
document.addEventListener('DOMContentLoaded',()=>{
  const u=jload('cursapp_demo_user',{});
  renderUI((u.role||'apoderado').toLowerCase());
});
