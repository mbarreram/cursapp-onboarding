/* Cursapp app.js – unified roles & shared tasks */

function jload(k,d){ try{return JSON.parse(localStorage.getItem(k)) ?? d}catch(e){return d} }
function jsave(k,v){ localStorage.setItem(k, JSON.stringify(v)); }
function today(){ return new Date().toISOString().slice(0,10); }

function logout(){
  localStorage.removeItem('cursapp_demo_user');
  location.href='login.html';
}

const TASKS_KEY='cursapp_tasks_v1';
const PAY_KEY='cursapp_course_payments_v1';
const ROSTER_KEY='cursapp_roster_v1';

function syncTasks(){
  const tasks=jload(TASKS_KEY,[]);
  let pays=jload(PAY_KEY,[]);
  let roster=jload(ROSTER_KEY,[]);

  if(!roster.length){
    roster=['Ana','Carlos','María','José','Paula','Felipe'];
    jsave(ROSTER_KEY,roster);
  }

  tasks.forEach(t=>{
    roster.forEach(n=>{
      if(!pays.some(p=>p.type==='task'&&p.name===n&&p.concept===t.name)){
        pays.unshift({
          type:'task',
          name:n,
          concept:t.name,
          amount:t.amount,
          status:'pending',
          date:'-',
          createdAt:today()
        });
      }
    });
  });
  jsave(PAY_KEY,pays);
}

function goTo(id){
  document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
  const el=document.getElementById('sec-'+id); if(el) el.classList.add('active');
  if(id==='payments') syncTasks();
}

(function(){
  syncTasks();
  const u=jload('cursapp_demo_user',null);
  if(u){
    const w=document.getElementById('whoLine');
    if(w) w.textContent=u.name+' · '+u.role;
  }
})();
