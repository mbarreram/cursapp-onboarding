/* Cursapp app.js – versión estable con gráficos + tareas compartidas */

function jload(k,d){ try{return JSON.parse(localStorage.getItem(k)) ?? d}catch(e){return d} }
function jsave(k,v){ localStorage.setItem(k, JSON.stringify(v)); }
function today(){ return new Date().toISOString().slice(0,10); }

/* ---- LOGOUT ---- */
function logout(){
  localStorage.removeItem('cursapp_demo_user');
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
  if(id==='payments') syncTasks();
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

document.addEventListener('DOMContentLoaded', ()=>{
  syncTasks();
  const u=jload('cursapp_demo_user',null);
  const w=document.getElementById('whoLine');
  if(u&&w) w.textContent=u.name+' · '+u.role;
});
