(function(){
'use strict';
if(window.__MX_PRES_SUMMARY_SCOPE_V1__)return;
window.__MX_PRES_SUMMARY_SCOPE_V1__=true;

const KEY='mx_pres_summary_scope_v1';
function scoped(base){
  try{return window.CURSAPP?.scopedKey?window.CURSAPP.scopedKey(base):'cursapp_'+base}catch(_){return 'cursapp_'+base}
}
function load(base){
  try{const v=JSON.parse(localStorage.getItem(scoped(base))||'[]');return Array.isArray(v)?v:[]}catch(_){return[]}
}
function totalStudents(){
  try{
    const x=JSON.parse(localStorage.getItem('cursapp_course_v1')||'{}')||{};
    const c=x.course||x;
    return Math.max(0,Number(c.totalAlumnos??c.total_alumnos??0)||0);
  }catch(_){return 0}
}
function currentPeriod(){
  const d=new Date(),y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0');
  return y+'-'+m;
}
function scope(){
  try{return localStorage.getItem(KEY)==='all'?'all':'month'}catch(_){return'month'}
}
function setScope(v){
  try{localStorage.setItem(KEY,v==='all'?'all':'month')}catch(_){}
}
function money(v){return new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(Number(v)||0)}
function metrics(){
  const f=window.CURSAPP_FINANCE_CORE;
  if(!f)return null;
  const payments=load('payments_v1'),tasks=load('tasks_v1'),expenses=load('expenses_v1'),studentTotal=totalStudents();
  const all=f.allSummary({payments,tasks,expenses,studentTotal});
  if(scope()==='all')return {scope:'all',collected:all.collected,pending:all.pending,debtors:all.debtors,balance:all.balance};
  const month=f.monthSummary({payments,tasks,studentTotal,period:currentPeriod()});
  return {scope:'month',collected:month.collected,pending:month.pending,debtors:month.debtors,balance:all.balance};
}
function cardByLabel(root,label){
  return [...root.querySelectorAll('.presMockKpi')].find(c=>String(c.querySelector('small')?.textContent||'').trim().startsWith(label));
}
function updateCards(root,m){
  const cob=cardByLabel(root,'Cobrado');
  if(cob){cob.querySelector('b').textContent=money(m.collected);const e=cob.querySelector('em');if(e)e.textContent=m.scope==='all'?'Acumulado':'Este mes'}
  const pen=cardByLabel(root,'Por cobrar');
  if(pen){pen.querySelector('b').textContent=money(m.pending);const e=pen.querySelector('em');if(e)e.textContent=m.scope==='all'?'Pendiente acumulado':'Pendiente'}
  const fam=cardByLabel(root,'Familias pendientes');
  if(fam){fam.querySelector('b').textContent=String(m.debtors);const e=fam.querySelector('em');if(e)e.textContent=m.scope==='all'?'Con deuda en cualquier período':'De '+totalStudents()+' alumnos del curso'}
  const sal=[...root.querySelectorAll('.presMockKpi')].find(c=>String(c.querySelector('small')?.textContent||'').trim().startsWith('Saldo disponible'));
  if(sal){sal.querySelector('b').textContent=money(m.balance);const e=sal.querySelector('em');if(e)e.textContent='Ingresos − gastos registrados'}
}
function injectCss(){
  if(document.getElementById('mxPresSummaryScopeCss'))return;
  const s=document.createElement('style');s.id='mxPresSummaryScopeCss';
  s.textContent='.mxPresSummaryScope{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:28px 0 12px}.mxPresSummaryScope strong{font-size:20px;line-height:1.15;color:#0f172a}.mxPresSummaryScope select{border:1px solid #dbe2ea;border-radius:12px;background:#fff;color:#475569;padding:9px 34px 9px 12px;font:800 13px/1.2 inherit;min-width:132px}.mxPresSummaryScope option{font-weight:700}@media(max-width:560px){.mxPresSummaryScope{margin:24px 0 10px}.mxPresSummaryScope strong{font-size:19px}.mxPresSummaryScope select{min-width:128px;padding-top:8px;padding-bottom:8px}}';
  document.head.appendChild(s);
}
function ensureBar(root){
  let bar=root.parentElement?.querySelector(':scope > .mxPresSummaryScope');
  if(!bar){
    bar=document.createElement('div');bar.className='mxPresSummaryScope';
    bar.innerHTML='<strong>Resumen del curso</strong><select aria-label="Periodo del resumen del curso"><option value="month">Este mes</option><option value="all">Todos los meses</option></select>';
    root.insertAdjacentElement('beforebegin',bar);
    bar.querySelector('select').addEventListener('change',e=>{setScope(e.target.value);apply()});
  }
  bar.querySelector('select').value=scope();
}
function removeLegacyHeader(root){
  const parent=root.parentElement;if(!parent)return;
  [...parent.children].forEach(el=>{
    if(el===root||el.classList.contains('mxPresSummaryScope'))return;
    const t=String(el.textContent||'').trim().replace(/\s+/g,' ');
    if(t==='Resumen del curso Este mes'||t==='Resumen del curso Todos los meses'){
      el.style.display='none';
      el.dataset.mxLegacySummaryHeader='1';
    }
  });
}
let busy=false;
function apply(){
  if(busy)return;busy=true;
  try{
    injectCss();
    const root=document.querySelector('.presMockKpis');
    if(!root)return;
    ensureBar(root);removeLegacyHeader(root);
    const m=metrics();if(m)updateCards(root,m);
  }finally{busy=false}
}
let queued=false;
function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;apply()})}
function boot(){
  apply();
  const app=document.getElementById('app');
  if(app)new MutationObserver(schedule).observe(app,{childList:true,subtree:true});
  window.addEventListener('cursapp:dataChanged',schedule);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();