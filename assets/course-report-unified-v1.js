(function(){
'use strict';
if(window.__MICURSOX_COURSE_REPORT_UNIFIED_V1__) return;
window.__MICURSOX_COURSE_REPORT_UNIFIED_V1__=true;

function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function clp(v){return '$'+Math.round(Number(v||0)).toLocaleString('es-CL');}
function norm(v){return String(v==null?'':v).trim().toLowerCase();}
function scoped(base){try{if(window.CURSAPP&&typeof window.CURSAPP.scopedKey==='function') return window.CURSAPP.scopedKey(base);}catch(_e){}return 'cursapp_'+base;}
function load(base){try{var x=JSON.parse(localStorage.getItem(scoped(base))||'[]');return Array.isArray(x)?x:[];}catch(_e){return [];}}
function latestReport(){return load('monthly_reports_v1').slice().sort((a,b)=>String(b.generatedAt||'').localeCompare(String(a.generatedAt||'')))[0]||null;}
function periodLabel(v){if(!v)return 'Informe actual';var p=String(v).split('-'),y=Number(p[0]),m=Number(p[1]);if(!y||!m)return String(v);return new Date(y,m-1,1).toLocaleDateString('es-CL',{month:'long',year:'numeric'}).replace(/^./,c=>c.toUpperCase());}
function paymentTaskId(p){return String((p&&(p.fromTaskId||p.campana_id||p.taskId||p.campaignId))||'');}
function taskTitle(t){return String((t&&(t.title||t.titulo||t.name||t.nombre))||'Campaña');}
function studentTotal(){try{var x=JSON.parse(localStorage.getItem('cursapp_course_v1')||'{}')||{};var c=x.course||x;return Math.max(0,Number(c.totalAlumnos!=null?c.totalAlumnos:c.total_alumnos)||0)}catch(_e){return 0}}
function finance(){return window.CURSAPP_FINANCE_CORE||null;}

function snapshot(){
  var rep=latestReport()||{};
  var tasks=load('tasks_v1').filter(function(t){return t&&!t.closed&&!['cerrada','closed','cancelada','cancelled','eliminada'].includes(norm(t.status||t.estado));});
  var pays=load('payments_v1');
  var expenses=load('expenses_v1');
  var f=finance(), totalStudents=studentTotal();
  var repCampaigns=Array.isArray(rep.campaigns)?rep.campaigns:[];
  var rows=tasks.map(function(t){
    var id=String(t.id||t.campana_id||''),ps=pays.filter(function(p){return paymentTaskId(p)===id;});
    var goal=f&&f.taskExpectedTotal?f.taskExpectedTotal(t,totalStudents):Number(t.goalTotal||t.goal_total||t.meta||0)||0;
    var collected=ps.reduce(function(a,p){return a+(f&&f.paidAmount?f.paidAmount(p):0);},0);
    var pending=f&&f.taskPendingTotal?f.taskPendingTotal(t,pays,totalStudents):0;
    return{id:id,title:taskTitle(t),goal:goal,collected:collected,pending:pending,pct:goal>0?Math.max(0,Math.min(100,Math.round(collected/goal*100))):0};
  });
  if(!rows.length&&repCampaigns.length){rows=repCampaigns.map(function(x){var goal=Number(x.goalTotal||x.goal_total||x.meta||x.objetivo||0)||0,col=Number(x.recaudado||x.collected||x.cobrado||x.totalPaid||0)||0,pen=Number(x.pendiente||x.pending||0)||0;return{id:String(x.id||''),title:String(x.title||x.titulo||x.name||'Campaña'),goal:goal,collected:col,pending:Math.max(0,pen),pct:goal>0?Math.round(col/goal*100):0};});}
  var course=f&&f.courseSummary?f.courseSummary({payments:pays,expenses:expenses}):{collected:Number(rep.recaudadoCurso||0)||0,spent:Number(rep.gastadoCurso||0)||0,balance:Number(rep.disponibleCurso||0)||0};
  var currentPending=rows.reduce(function(a,r){return a+r.pending;},0);
  var target=course.collected+currentPending;
  var pct=target>0?Math.max(0,Math.min(100,Math.round(course.collected/target*100))):0;
  return {rep:rep,period:new Date().toISOString().slice(0,7),rec:course.collected,gas:course.spent,saldo:course.balance,pending:currentPending,target:target,pct:pct,rows:rows,debtors:Number(rep.deudores||0)||0};
}
function reportInner(data, includeActions){
  var rows=data.rows.map(r=>'<article class="mxURCampaign"><div class="mxURCampaignHead"><b>'+esc(r.title)+'</b><strong>'+r.pct+'%</strong></div><div class="mxURBar"><i style="width:'+r.pct+'%"></i></div><div class="mxURVals"><span>💰 Recaudado: <b>'+clp(r.collected)+'</b></span><span>⏳ Pendiente: <b>'+clp(r.pending)+'</b></span><span>🎯 Objetivo: <b>'+clp(r.goal)+'</b></span></div></article>').join('');
  return '<section class="mxUnifiedReport">'+
    '<div class="mxURHead"><div><h2>Informe ejecutivo del curso</h2><p>Estado actual · Periodo: <b>'+esc(data.period)+'</b></p></div>'+
    (includeActions?'<div class="mxURActions"><button type="button" onclick="window.MICURSOX_COURSE_REPORT.print()">PDF</button>'+(document.body.classList.contains('cursapp-presidente')?'<button type="button" onclick="window.shareExecutiveWhatsApp&&window.shareExecutiveWhatsApp()">Compartir</button>':'')+'</div>':'')+'</div>'+
    '<div class="mxURCompliance"><div class="mxURCompTop"><b>Cumplimiento del curso</b><strong>'+data.pct+'%</strong></div><div class="mxURBar big"><i style="width:'+data.pct+'%"></i></div><p>💵 Recaudado: <b>'+clp(data.rec)+'</b> · ⏳ Por cobrar: <b>'+clp(data.pending)+'</b></p></div>'+
    '<div class="mxURKpis"><article><small>💰 Recaudado total</small><strong>'+clp(data.rec)+'</strong></article><article><small>🧾 Gastado total</small><strong>'+clp(data.gas)+'</strong></article><article><small>🏦 Saldo disponible</small><strong>'+clp(data.saldo)+'</strong></article><article><small>⏳ Por cobrar</small><strong>'+clp(data.pending)+'</strong></article></div>'+
    '<div class="mxURSection"><h3>📌 Indicadores por campaña</h3><div class="mxURCampaigns">'+(rows||'<p class="mxUREmpty">No hay campañas activas.</p>')+'</div></div>'+
    '<div class="mxURFoot">Emitido: '+esc((data.rep&&data.rep.generatedAt)||new Date().toISOString())+'</div>'+
  '</section>';
}

function open(){
  var root=document.getElementById('modalRoot');if(!root)return;
  root.innerHTML='<div class="mxUROverlay" onclick="if(event.target===this)window.MICURSOX_COURSE_REPORT.close()"><div class="mxURModal"><div class="mxURModalTop"><b>Informe publicado</b><div><button type="button" onclick="window.MICURSOX_COURSE_REPORT.print()">PDF</button><button type="button" onclick="window.MICURSOX_COURSE_REPORT.close()">Cerrar</button></div></div><div class="mxURScroll">'+reportInner(snapshot(),false)+'</div></div></div>';
  document.body.style.overflow='hidden';
}
function close(){var root=document.getElementById('modalRoot');if(root)root.innerHTML='';document.body.style.overflow='';}
function print(){
  var data=snapshot();var frame=document.createElement('iframe');frame.style.cssText='position:fixed;width:0;height:0;border:0;opacity:0;pointer-events:none';document.body.appendChild(frame);var doc=frame.contentDocument||frame.contentWindow.document;doc.open();doc.write('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+styleText(true)+'</head><body>'+reportInner(data,false)+'</body></html>');doc.close();var done=false;function go(){if(done)return;done=true;try{frame.contentWindow.focus();frame.contentWindow.print();}catch(_e){}setTimeout(()=>{try{frame.remove();}catch(_e){}},2500);}frame.onload=()=>setTimeout(go,120);setTimeout(go,500);
}
function renderPresident(){
  if(!document.body.classList.contains('cursapp-presidente'))return;
  var root=document.querySelector('.presReportsExecutive');if(!root||root.dataset.mxUnified==='1')return;
  root.dataset.mxUnified='1';root.innerHTML=reportInner(snapshot(),true);
}

function styleText(printMode){return '<style>*{box-sizing:border-box}.mxUnifiedReport{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#0f172a;background:#fff;border-radius:22px;padding:18px}.mxURHead{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.mxURHead h2{font-size:20px!important;line-height:1.15!important;margin:0!important}.mxURHead p{margin:5px 0 0!important;color:#64748b!important;font-size:13px!important}.mxURActions{display:flex;gap:8px}.mxURActions button,.mxURModalTop button{border:1px solid #d8dee8;border-radius:12px;padding:9px 13px;background:#fff;color:#6d28d9;font-weight:900;font-size:13px}.mxURActions button:first-child,.mxURModalTop button:first-child{background:#6d28d9;color:#fff;border-color:#6d28d9}.mxURCompliance{margin-top:14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:18px;padding:14px}.mxURCompTop{display:flex;justify-content:space-between;gap:10px}.mxURCompTop b{font-size:15px}.mxURCompTop strong{font-size:18px}.mxURCompliance p{font-size:13px!important;margin:8px 0 0!important}.mxURBar{height:9px;background:#eef2ff;border-radius:999px;overflow:hidden;margin:8px 0}.mxURBar.big{height:11px}.mxURBar i{display:block;height:100%;background:#4f46e5;border-radius:999px}.mxURKpis{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}.mxURKpis article{border:1px solid #e2e8f0;border-radius:16px;padding:13px;min-width:0}.mxURKpis small{display:block;color:#64748b;font-size:12px}.mxURKpis strong{display:block;font-size:20px;margin-top:5px}.mxURSection{margin-top:16px}.mxURSection h3{font-size:17px!important;margin:0 0 10px!important}.mxURCampaigns{display:grid;gap:10px}.mxURCampaign{border:1px solid #e2e8f0;border-radius:17px;padding:13px}.mxURCampaignHead{display:flex;justify-content:space-between;gap:10px}.mxURCampaignHead b,.mxURCampaignHead strong{font-size:15px}.mxURVals{display:flex;gap:12px;flex-wrap:wrap;font-size:13px;color:#475569}.mxURVals b{color:#0f172a}.mxURFoot{margin-top:14px;color:#94a3b8;font-size:11px}.mxUROverlay{position:fixed;inset:0;z-index:100030;background:rgba(15,23,42,.58);display:flex;padding:max(8px,env(safe-area-inset-top)) 8px max(8px,env(safe-area-inset-bottom));align-items:stretch}.mxURModal{width:min(860px,100%);max-height:100%;margin:auto;background:#fff;border-radius:20px;overflow:hidden;display:flex;flex-direction:column}.mxURModalTop{padding:10px 12px;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;flex:0 0 auto}.mxURModalTop>div{display:flex;gap:7px}.mxURScroll{overflow:auto;-webkit-overflow-scrolling:touch}.mxURScroll .mxUnifiedReport{border-radius:0}.presReportsExecutive>.mxUnifiedReport{padding:0!important;border-radius:0!important}.presReportsExecutive svg{max-width:28px!important;max-height:28px!important}.presReportsExecutive .mxUnifiedReport *{max-width:100%}@media(max-width:620px){.mxUnifiedReport{padding:14px}.mxURHead{align-items:flex-start}.mxURHead h2{font-size:18px!important}.mxURKpis{grid-template-columns:1fr 1fr}.mxURKpis strong{font-size:18px}.mxURVals{display:grid;gap:4px}.mxURModal{border-radius:18px}}@media print{body{margin:0;background:#fff}.mxUnifiedReport{padding:0;border-radius:0}.mxURActions{display:none}.mxURCampaign,.mxURKpis article,.mxURCompliance{break-inside:avoid}}</style>';}

var s=document.createElement('div');s.innerHTML=styleText(false);document.head.appendChild(s.firstElementChild);
window.MICURSOX_COURSE_REPORT={open,close,print,snapshot};

function wireApoderado(){
  if(!document.body.classList.contains('cursapp-apoderado'))return;
  window.openPublishedReport=open;
  window.downloadPublishedReportPdf=print;
  window.downloadReportPdf=print;
  window.openReport=function(){open();};
}
function boot(){wireApoderado();renderPresident();var mo=new MutationObserver(function(){renderPresident();wireApoderado();});mo.observe(document.body,{childList:true,subtree:true});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();