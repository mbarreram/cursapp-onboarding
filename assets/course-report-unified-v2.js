(function(){
'use strict';
if(window.__MICURSOX_COURSE_REPORT_UNIFIED_V2__) return;
window.__MICURSOX_COURSE_REPORT_UNIFIED_V2__=true;
const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clp=v=>'$'+Math.round(Number(v||0)).toLocaleString('es-CL');
const norm=v=>String(v==null?'':v).trim().toLowerCase();
function scoped(base){try{if(window.CURSAPP&&typeof window.CURSAPP.scopedKey==='function')return window.CURSAPP.scopedKey(base);}catch(_e){}return 'cursapp_'+base;}
function load(base){
 // Treasury reports and expenses must come from the successful Supabase hydration.
 const state=window.MICURSOX_TREASURY_REPORT_STATE;
 if(state&&state.source==='supabase'){
   const course=(()=>{try{const x=JSON.parse(localStorage.getItem('cursapp_course_v1')||'{}');return x.course||x;}catch(_){return {};}})();
   const cid=String(course.curso_id||course.courseId||course.id||'');
   if(cid&&cid===String(state.courseId||'')){
     if(base==='expenses_v1')return state.expenses.slice();
     if(base==='monthly_reports_v1')return state.reports.slice();
   }
 }
 try{const x=JSON.parse(localStorage.getItem(scoped(base))||'[]');return Array.isArray(x)?x:[];}catch(_e){return[];}
}
function reports(){return load('monthly_reports_v1').slice().sort((a,b)=>String(b.generatedAt||'').localeCompare(String(a.generatedAt||'')));}
function getReport(period){const all=reports();return (period?all.find(r=>String(r.period||'')===String(period)):null)||all[0]||null;}
function paymentTaskId(p){return String((p&&(p.fromTaskId||p.campana_id||p.taskId||p.campaignId))||'');}
function title(t){return String((t&&(t.title||t.titulo||t.name||t.nombre))||'Campaña');}
function taskDue(t){return String((t&&(t.dueDate||t.fecha_vencimiento||t.endDate||t.fecha_fin))||'').slice(0,10);}
function taskState(t){
  const raw=norm(t&&(t.status||t.estado));
  const closed=!!(t&&t.closed)||['cerrada','cerrado','closed','finalizada','finalizado'].includes(raw);
  const cancelled=['cancelada','cancelado','cancelled','eliminada','eliminado'].includes(raw);
  if(cancelled)return 'cerrada';
  if(closed)return 'cerrada';
  const due=taskDue(t);
  if(due&&due<new Date().toISOString().slice(0,10))return 'vencida';
  return 'activa';
}
function stateLabel(v){return v==='activa'?'Activa':(v==='vencida'?'Vencida':'Cerrada');}
function studentTotal(){
  try{const x=JSON.parse(localStorage.getItem('cursapp_course_v1')||'{}')||{};const c=x.course||x;return Math.max(0,Number(c.totalAlumnos??c.total_alumnos??0)||0)}catch(_e){return 0}
}
function finance(){return window.CURSAPP_FINANCE_CORE||null;}
function snapshot(period){
 const rep=getReport(period)||{};
 const tasks=load('tasks_v1').filter(t=>t&&!['eliminada','eliminado','deleted'].includes(norm(t.status||t.estado)));
 const pays=load('payments_v1');
 const expenses=load('expenses_v1');
 const f=finance();
 const totalStudents=studentTotal();
 const rc=Array.isArray(rep.campaigns)?rep.campaigns:[];
 let rows=tasks.map(t=>{
   const id=String(t.id||t.campana_id||'');
   const ps=pays.filter(p=>paymentTaskId(p)===id);
   const sr=rc.find(c=>String(c.id||c.taskId||c.campana_id||'')===id)||rc.find(c=>norm(c.title||c.titulo||c.name)===norm(title(t)))||{};
   const metrics=f?.taskFinancialMetrics?f.taskFinancialMetrics(t,pays,totalStudents):null;
   const collected=metrics?metrics.collected:ps.reduce((a,p)=>a+(f?.paidAmount?f.paidAmount(p):0),0);
   const pending=metrics?metrics.pending:(f?.taskPendingTotal?f.taskPendingTotal(t,pays,totalStudents):0);
   const goal=metrics?metrics.expected:Math.max((f?.taskExpectedTotal?f.taskExpectedTotal(t,totalStudents):(Number(t.goalTotal??t.goal_total??t.meta??0)||0)),collected+pending);
   const spent=expenses.filter(e=>String(e?.campaignId||e?.campana_id||e?.taskId||e?.fromTaskId||'')===id&&(f?.expenseCounted?f.expenseCounted(e):!['pendiente','pending','observada','observado','rejected','rechazada','rechazado','anulada','anulado','void'].includes(norm(e?.status||e?.estado||e?.approvalStatus)))).reduce((a,e)=>a+(Number(e?.amount??e?.monto??0)||0),0);
   const state=taskState(t);
   const taskAmount=Math.max(0,Number(t?.amount??t?.monto??0)||0);
   const obligationValues=Array.from(new Set(ps.map(p=>Math.max(0,Number(p?.obligationAmount??p?.amount??p?.monto??0)||0)).filter(v=>v>0))).sort((a,b)=>a-b);
   const feeMin=taskAmount>0?taskAmount:(obligationValues[0]||0);
   const feeMax=obligationValues.length?obligationValues[obligationValues.length-1]:feeMin;
   const feeMonthly=!!(f?.isMonthly&&f.isMonthly(t));
   const feeLabel=feeMin>0?(feeMax>feeMin?(`${clp(feeMin)}–${clp(feeMax)} según alumno/a`):(`${clp(feeMin)}${feeMonthly?' por mes':''}`)):'No definido';
   return{id,title:title(t),goal,collected,pending,spent,state,feeLabel,pct:metrics?metrics.pct:(goal>0?Math.max(0,Math.min(100,Math.round(collected/goal*100))):0)};
 });
 if(!rows.length&&rc.length){
   rows=rc.map(c=>{const g=Number(c.goalTotal??c.goal_total??c.meta??c.objetivo??0)||0;const col=Number(c.recaudado??c.collected??c.cobrado??c.totalPaid??0)||0;const pen=Number(c.pendiente??c.pending??0)||0;const state=norm(c.status||c.estado)==='vencida'?'vencida':(['cerrada','cerrado','closed','finalizada','finalizado'].includes(norm(c.status||c.estado))?'cerrada':'activa');const fee=Number(c.amount??c.monto??c.cuota??0)||0;return{id:String(c.id||''),title:String(c.title||c.titulo||c.name||'Campaña'),goal:g,collected:col,pending:Math.max(0,pen),spent:Number(c.spent??c.gastado??0)||0,state,feeLabel:fee>0?clp(fee):'No definido',pct:g>0?Math.round(col/g*100):0};});
 }
 rows=rows.filter(r=>r.collected>0||r.pending>0||r.spent>0||r.goal>0);
 const course=f?.courseSummary?f.courseSummary({payments:pays,expenses}):{collected:Number(rep.recaudadoCurso||0)||0,spent:Number(rep.gastadoCurso||0)||0,balance:Number(rep.disponibleCurso||0)||0};
 const pending=rows.reduce((a,r)=>a+r.pending,0);
 const target=course.collected+pending;
 return{rep,period:period||new Date().toISOString().slice(0,7),rec:course.collected,gas:course.spent,saldo:course.balance,pending,target,pct:target>0?Math.max(0,Math.min(100,Math.round(course.collected/target*100))):0,rows};
}
function filteredRows(data,filter){
 const rows=Array.isArray(data?.rows)?data.rows:[];
 if(filter==='active')return rows.filter(r=>r.state==='activa');
 if(filter==='closed')return rows.filter(r=>r.state==='cerrada'||r.state==='vencida');
 return rows;
}
function body(data,filter,interactive){
 const fkey=filter||'all', rows=filteredRows(data,fkey), showFilters=interactive!==false;
 const filters=showFilters?'<div class="mxR2Filters" role="group" aria-label="Filtrar campañas"><button class="'+(fkey==='all'?'active':'')+'" onclick="window.MICURSOX_COURSE_REPORT_V2.setFilter(\'all\')">Todas</button><button class="'+(fkey==='active'?'active':'')+'" onclick="window.MICURSOX_COURSE_REPORT_V2.setFilter(\'active\')">Activas</button><button class="'+(fkey==='closed'?'active':'')+'" onclick="window.MICURSOX_COURSE_REPORT_V2.setFilter(\'closed\')">Cerradas/Vencidas</button></div>':'';
 return '<section class="mxR2">'+
 '<header><div><h1>Informe ejecutivo del curso</h1><p>Estado actual · Periodo: <b>'+esc(data.period)+'</b></p></div></header>'+
 '<section class="mxR2Compliance"><div><b>Cumplimiento del curso</b><strong>'+data.pct+'%</strong></div><span><i style="width:'+data.pct+'%"></i></span><p>💵 Recaudado: <b>'+clp(data.rec)+'</b> · ⏳ Por cobrar: <b>'+clp(data.pending)+'</b></p></section>'+
 '<div class="mxR2Kpis"><article><small>💰 Recaudado total</small><strong>'+clp(data.rec)+'</strong></article><article><small>🧾 Gastado total</small><strong>'+clp(data.gas)+'</strong></article><article><small>🏦 Saldo disponible</small><strong>'+clp(data.saldo)+'</strong></article><article><small>⏳ Por cobrar</small><strong>'+clp(data.pending)+'</strong></article></div>'+
 '<div class="mxR2CampaignHeader"><h2>📌 Campañas incluidas en este informe</h2>'+filters+'<p class="mxR2ScopeNote">Incluye campañas activas, cerradas o vencidas con movimientos u obligaciones financieras asociadas al informe.</p></div>'+
 '<div class="mxR2Campaigns">'+(rows.map(r=>'<article><div class="head"><div><b>'+esc(r.title)+'</b><span class="mxR2State '+esc(r.state)+'">'+esc(stateLabel(r.state))+'</span></div><strong>'+r.pct+'%</strong></div><p class="mxR2Fee">👤 Cuota por alumno/a: <b>'+esc(r.feeLabel||'No definido')+'</b></p><span class="bar"><i style="width:'+r.pct+'%"></i></span><p>💰 Recaudado: <b>'+clp(r.collected)+'</b></p><p>⏳ Pendiente: <b>'+clp(r.pending)+'</b></p>'+(r.spent>0?'<p>🧾 Gastado: <b>'+clp(r.spent)+'</b></p>':'')+'<p>🎯 Objetivo: <b>'+clp(r.goal)+'</b></p></article>').join('')||'<p class="mxR2Empty">No hay campañas para este filtro.</p>')+'</div><footer>Emitido: '+esc((data.rep&&data.rep.generatedAt)||new Date().toISOString())+'</footer></section>';
}
function css(){return '<style>*{box-sizing:border-box}html,body{margin:0;background:#fff;color:#0f172a;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.mxR2{width:100%;max-width:780px;margin:auto;padding:18px}.mxR2 h1{font-size:22px;line-height:1.15;margin:0}.mxR2 header p{margin:5px 0 0;color:#64748b}.mxR2Compliance{margin-top:16px;padding:14px;border:1px solid #e2e8f0;border-radius:18px;background:#f8fafc}.mxR2Compliance>div,.mxR2Campaigns .head{display:flex;justify-content:space-between;gap:12px}.mxR2Compliance>span,.mxR2Campaigns .bar{display:block;height:10px;background:#eef2ff;border-radius:999px;overflow:hidden;margin:9px 0}.mxR2Compliance i,.mxR2Campaigns i{display:block;height:100%;background:#4f46e5;border-radius:999px}.mxR2Compliance p,.mxR2Campaigns p{margin:5px 0;font-size:13px}.mxR2Kpis{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}.mxR2Kpis article,.mxR2Campaigns article{border:1px solid #e2e8f0;border-radius:16px;padding:13px}.mxR2Kpis small{display:block;color:#64748b}.mxR2Kpis strong{display:block;font-size:20px;margin-top:4px}.mxR2 h2{font-size:18px;margin:18px 0 10px}.mxR2CampaignHeader{margin-top:18px}.mxR2CampaignHeader h2{margin-bottom:8px}.mxR2ScopeNote{margin:8px 0 10px;color:#64748b;font-size:12px;line-height:1.4}.mxR2Filters{display:flex;gap:6px;overflow-x:auto;padding:2px 0 4px}.mxR2Filters button{border:1px solid #dbe2ea;background:#fff;color:#64748b;border-radius:999px;padding:7px 10px;font-weight:850;font-size:12px;white-space:nowrap}.mxR2Filters button.active{background:#6d28d9;color:#fff;border-color:#6d28d9}.mxR2Campaigns{display:grid;gap:10px}.mxR2Campaigns .head>div{display:flex;align-items:center;gap:7px;min-width:0}.mxR2Fee{margin:7px 0 2px!important;padding:6px 8px;border-radius:10px;background:#f8fafc;color:#475569!important;font-size:12px!important}.mxR2Fee b{color:#0f172a}.mxR2Campaigns .head b,.mxR2Campaigns .head strong{font-size:15px}.mxR2State{display:inline-flex;align-items:center;border-radius:999px;padding:3px 7px;font-size:10px;font-weight:900;line-height:1}.mxR2State.activa{background:#dcfce7;color:#15803d}.mxR2State.cerrada{background:#e2e8f0;color:#475569}.mxR2State.vencida{background:#ffedd5;color:#c2410c}.mxR2Empty{color:#64748b;font-size:13px}.mxR2 footer{margin-top:14px;color:#94a3b8;font-size:11px}@media(max-width:600px){.mxR2{padding:14px}.mxR2Kpis{grid-template-columns:1fr 1fr}.mxR2 h1{font-size:20px}}@media print{@page{size:A4;margin:10mm}.mxR2{max-width:none;padding:0}.mxR2Kpis article,.mxR2Campaigns article,.mxR2Compliance{break-inside:avoid}}</style>';}
let currentPeriod='';let currentFilter='all';
function close(){const r=document.getElementById('modalRoot');if(r)r.innerHTML='';document.documentElement.style.overflow='';document.body.style.overflow='';}
function open(period){currentPeriod=period||'';currentFilter='all';const root=document.getElementById('modalRoot');if(!root)return;root.innerHTML='<div class="mxR2Overlay"><div class="mxR2Modal"><div class="mxR2Top"><b>Informe mensual publicado</b><div><button id="mxR2Pdf">PDF</button><button id="mxR2Close">Cerrar</button></div></div><div class="mxR2Scroll">'+body(snapshot(currentPeriod),currentFilter,true)+'</div></div></div>';document.documentElement.style.overflow='hidden';document.body.style.overflow='hidden';document.getElementById('mxR2Close').onclick=close;document.getElementById('mxR2Pdf').onclick=()=>print(currentPeriod);}
function openTreasurerPreview(period,published){currentPeriod=period||'';currentFilter='all';const root=document.getElementById('modalRoot');if(!root)return;root.innerHTML='<div class="mxR2Overlay"><div class="mxR2Modal"><div class="mxR2Top"><b>Vista previa para apoderados</b><div><button id="mxR2Publish">'+(published?'Actualizar para apoderados':'Publicar para apoderados')+'</button><button id="mxR2Close">Cerrar</button></div></div><div class="mxR2Scroll">'+body(snapshot(currentPeriod),currentFilter,true)+'</div></div></div>';document.documentElement.style.overflow='hidden';document.body.style.overflow='hidden';document.getElementById('mxR2Close').onclick=close;document.getElementById('mxR2Publish').onclick=()=>{close();if(typeof window.tesV80Publish==='function')window.tesV80Publish();};}
window.openTreasurerReportPreview=function(period,published){return openTreasurerPreview(period,!!published);};
function setFilter(filter){currentFilter=['all','active','closed'].includes(filter)?filter:'all';const scroll=document.querySelector('.mxR2Modal .mxR2Scroll');if(scroll)scroll.innerHTML=body(snapshot(currentPeriod),currentFilter,true);}
window.MICURSOX_COURSE_REPORT_V2={openTreasurerPreview,snapshot,body,setFilter};
function print(period){const frame=document.createElement('iframe');frame.style.cssText='position:fixed;width:0;height:0;border:0;opacity:0';document.body.appendChild(frame);const doc=frame.contentDocument||frame.contentWindow.document;doc.open();doc.write('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+css()+'</head><body>'+body(snapshot(period||currentPeriod),'all',false)+'</body></html>');doc.close();let once=false;const go=()=>{if(once)return;once=true;try{frame.contentWindow.focus();frame.contentWindow.print();}catch(_e){}setTimeout(()=>frame.remove(),2500)};frame.onload=()=>setTimeout(go,100);setTimeout(go,450);}
async function share(period){const d=snapshot(period||currentPeriod);const text='Informe ejecutivo del curso · '+d.period+' · Recaudado '+clp(d.rec)+' · Por cobrar '+clp(d.pending);try{if(navigator.share){await navigator.share({title:'Informe ejecutivo del curso',text});return;}}catch(_e){return;}try{await navigator.clipboard.writeText(text);alert('Resumen del informe copiado.');}catch(_e){alert(text);}}
function wire(){
 window.openReportApoderado=function(period){open(period)};
 window.printCurrentInforme=function(){print()};
 window.shareExecutiveWhatsApp=function(){share()};
 if(document.body.classList.contains('cursapp-apoderado')){window.openPublishedReport=function(){open()};window.downloadPublishedReportPdf=function(){print()};window.downloadReportPdf=function(){print()};}
 if(document.body.classList.contains('cursapp-presidente')){const root=document.querySelector('.presReportsExecutive');if(root&&!root.dataset.mxR2){root.dataset.mxR2='1';const d=snapshot();root.innerHTML='<div class="mxR2InlineHead"><div><h2>Informe ejecutivo del curso</h2><p>Estado actual · Periodo: <b>'+esc(d.period)+'</b></p></div><div><button onclick="window.printCurrentInforme()">PDF</button><button onclick="window.shareExecutiveWhatsApp()">Compartir</button></div></div>'+body(d);}}

}
const st=document.createElement('style');st.textContent='.mxR2Overlay{position:fixed;inset:0;z-index:100050;background:rgba(15,23,42,.62);padding:max(8px,env(safe-area-inset-top)) 8px max(8px,env(safe-area-inset-bottom));display:flex}.mxR2Modal{width:min(860px,100%);height:calc(100dvh - max(16px,env(safe-area-inset-top)) - max(16px,env(safe-area-inset-bottom)));margin:auto;background:#fff;border-radius:20px;overflow:hidden;display:flex;flex-direction:column;min-height:0}.mxR2Top{position:sticky;top:0;z-index:3;flex:0 0 auto;background:#fff;border-bottom:1px solid #e2e8f0;padding:10px 12px;display:flex;justify-content:space-between;align-items:center;gap:8px}.mxR2Top>div,.mxR2InlineHead>div:last-child{display:flex;gap:8px}.mxR2Top button,.mxR2InlineHead button{border:1px solid #d8dee8;background:#fff;color:#6d28d9;border-radius:12px;padding:9px 13px;font-weight:900}.mxR2Top button:first-child,.mxR2InlineHead button:first-child{background:#6d28d9;color:#fff;border-color:#6d28d9}.mxR2Scroll{flex:1 1 auto;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}.mxR2InlineHead{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:12px}.mxR2InlineHead h2{margin:0}.mxR2InlineHead p{margin:5px 0 0;color:#64748b}.presReportsExecutive>.mxR2{padding:0}.presReportsExecutive>.mxR2 header{display:none}@media(max-width:620px){.mxR2InlineHead{flex-direction:column}.mxR2InlineHead>div:last-child{width:100%}.mxR2InlineHead button{flex:1}.mxR2Modal{border-radius:18px}}';document.head.appendChild(st);const wrap=document.createElement('div');wrap.innerHTML=css();document.head.appendChild(wrap.firstElementChild);
function boot(){wire();const mo=new MutationObserver(()=>wire());mo.observe(document.body,{childList:true,subtree:true});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();