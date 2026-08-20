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
function paid(p){return ['paid','pagado','conciliado'].includes(norm(p&&(p.status||p.estado)));}
function excluded(p){return ['opted_out','no_participa','no participa','cancelled','cancelado','void','anulado'].includes(norm(p&&(p.status||p.estado)));}
function paymentTaskId(p){return String((p&&(p.fromTaskId||p.campana_id||p.taskId||p.campaignId))||'');}
function taskTitle(t){return String((t&&(t.title||t.titulo||t.name||t.nombre))||'Campaña');}
function taskGoal(t){return Number((t&&(t.goalTotal??t.goal_total??t.meta??t.objetivo))||0)||0;}
function taskAmount(t){return Number((t&&(t.amount??t.monto))||0)||0;}
function amountPaid(p){return Number((p&&(p.amountPaid??p.monto_pagado??p.amount??p.monto))||0)||0;}
function amountDue(p){return Number((p&&(p.amountRemaining??p.amount??p.monto))||0)||0;}

function snapshot(){
  var rep=latestReport()||{};
  var tasks=load('tasks_v1').filter(t=>t&&!t.closed&&!['cerrada','closed','cancelada','cancelled'].includes(norm(t.status||t.estado)));
  var pays=load('payments_v1').filter(p=>p&&!excluded(p));
  var repCampaigns=Array.isArray(rep.campaigns)?rep.campaigns:[];
  var rows=tasks.map(function(t){
    var id=String(t.id||t.campana_id||'');
    var title=taskTitle(t);
    var ps=pays.filter(p=>paymentTaskId(p)===id);
    var sr=repCampaigns.find(c=>String(c.id||c.taskId||c.campana_id||'')===id)||repCampaigns.find(c=>norm(c.title||c.titulo||c.name)===norm(title))||{};
    var goal=taskGoal(t)||Number(sr.goalTotal??sr.goal_total??sr.meta??sr.objetivo??0)||0;
    if(!goal){var sum=ps.reduce((a,p)=>a+amountDue(p),0);goal=sum||taskAmount(t);}
    var liveCollected=ps.filter(paid).reduce((a,p)=>a+amountPaid(p),0);
    var snapCollected=Number(sr.recaudado??sr.collected??sr.cobrado??sr.totalPaid??0)||0;
    var collected=Math.max(liveCollected,snapCollected);
    var pending=Math.max(0,goal-collected);
    return {id,title,goal,collected,pending,pct:goal>0?Math.max(0,Math.min(100,Math.round(collected/goal*100))):0};
  });
  if(!rows.length&&repCampaigns.length){rows=repCampaigns.map(function(c){var goal=Number(c.goalTotal??c.goal_total??c.meta??c.objetivo??0)||0;var collected=Number(c.recaudado??c.collected??c.cobrado??c.totalPaid??0)||0;return{id:String(c.id||''),title:String(c.title||c.titulo||c.name||'Campaña'),goal,collected,pending:Math.max(0,goal-collected),pct:goal>0?Math.round(collected/goal*100):0};});}
  var currentCollected=rows.reduce((a,r)=>a+r.collected,0);
  var currentPending=rows.reduce((a,r)=>a+r.pending,0);
  var rec=Math.max(Number(rep.recaudadoCurso??rep.recaudado??0)||0,currentCollected);
  var gas=Number(rep.gastadoCurso??0)||0;
  var saldo=rec-gas;
  var target=rec+currentPending;
  var pct=target>0?Math.max(0,Math.min(100,Math.round(rec/target*100))):0;
  return {rep,period:rep.period||new Date().toISOString().slice(0,7),rec,gas,saldo,pending:currentPending,target,pct,rows,debtors:Number(rep.deudores||0)||0};
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