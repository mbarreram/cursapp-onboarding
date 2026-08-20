(function(){
  'use strict';
  if(window.__MX_APO_PUBLISHED_REPORT_V1__) return;
  window.__MX_APO_PUBLISHED_REPORT_V1__=true;

  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function clp(v){return '$'+Number(v||0).toLocaleString('es-CL');}
  function scoped(base){try{if(window.CURSAPP&&typeof window.CURSAPP.scopedKey==='function')return window.CURSAPP.scopedKey(base);}catch(_e){}return 'cursapp_'+base;}
  function reports(){try{var r=JSON.parse(localStorage.getItem(scoped('monthly_reports_v1'))||'[]');return Array.isArray(r)?r:[];}catch(_e){return [];}}
  function latest(){return reports().slice().sort(function(a,b){return String(b.generatedAt||b.created_at||'').localeCompare(String(a.generatedAt||a.created_at||''));})[0]||null;}
  function periodLabel(v){if(!v)return 'Informe publicado';var p=String(v).split('-'),y=Number(p[0]),m=Number(p[1]);if(!y||!m)return String(v);return new Date(y,m-1,1).toLocaleDateString('es-CL',{month:'long',year:'numeric'}).replace(/^./,function(c){return c.toUpperCase();});}
  function publishedAt(rep){var raw=rep&& (rep.generatedAt||rep.created_at);if(!raw)return '';try{return new Date(raw).toLocaleString('es-CL',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});}catch(_e){return '';}}
  function campaigns(rep){return Array.isArray(rep&&rep.campaigns)?rep.campaigns:[];}
  function campaignTitle(c){return c&& (c.title||c.titulo||c.name||c.nombre)||'Campaña';}
  function campaignCollected(c){return Number(c&& (c.recaudado??c.collected??c.cobrado??c.totalPaid) ||0);}
  function campaignPending(c){return Number(c&& (c.pendiente??c.pending??c.porCobrar??c.remaining) ||0);}
  function campaignGoal(c){return Number(c&& (c.goalTotal??c.goal_total??c.meta??c.objetivo) ||0);}

  function reportHTML(rep, forPrint){
    var rec=Number((rep.recaudadoCurso??rep.recaudado)||0);
    var gas=Number(rep.gastadoCurso||0);
    var saldo=Number((rep.disponibleCurso??(rec-gas))||0);
    var pend=Number((rep.pendienteCurso??rep.pendiente)||0);
    var deu=Number(rep.deudores||0);
    var camp=campaigns(rep);
    var expenses=Array.isArray(rep.expenses)?rep.expenses:[];
    return '<section class="mxPublishedReport '+(forPrint?'is-print':'')+'">'+
      '<header><div><small>MICURSOX · INFORME PUBLICADO</small><h1>Informe ejecutivo del curso</h1><p>Periodo <b>'+esc(periodLabel(rep.period))+'</b></p></div><div class="mxPublishedSeal">DIRECTIVA<br><b>CURSO</b></div></header>'+
      '<div class="mxPublishedMeta"><span>Publicado por la directiva</span><b>'+esc(publishedAt(rep))+'</b></div>'+
      '<div class="mxPublishedKpis">'+
        '<article><small>Recaudado total</small><strong>'+clp(rec)+'</strong></article>'+
        '<article><small>Gastado total</small><strong>'+clp(gas)+'</strong></article>'+
        '<article><small>Saldo disponible</small><strong>'+clp(saldo)+'</strong></article>'+
        '<article><small>Pendiente curso</small><strong>'+clp(pend)+'</strong></article>'+
      '</div>'+
      '<section class="mxPublishedBlock"><h2>Resumen del curso</h2><div class="mxPublishedSummary"><div><span>Deudores</span><b>'+deu+'</b></div><div><span>Campañas informadas</span><b>'+camp.length+'</b></div><div><span>Periodo</span><b>'+esc(rep.period||'—')+'</b></div></div></section>'+
      '<section class="mxPublishedBlock"><h2>Detalle por campaña</h2>'+
        (camp.length?camp.map(function(c){var goal=campaignGoal(c),col=campaignCollected(c),pending=campaignPending(c);var pct=goal>0?Math.max(0,Math.min(100,Math.round(col/goal*100))):0;return '<article class="mxPublishedCampaign"><div class="head"><b>'+esc(campaignTitle(c))+'</b><strong>'+pct+'%</strong></div><div class="bar"><i style="width:'+pct+'%"></i></div><div class="vals"><span>Recaudado <b>'+clp(col)+'</b></span><span>Pendiente <b>'+clp(pending)+'</b></span><span>Objetivo <b>'+clp(goal)+'</b></span></div></article>';}).join(''):'<p class="empty">Sin detalle de campañas en este informe.</p>')+
      '</section>'+
      '<section class="mxPublishedBlock"><h2>Rendiciones del periodo</h2>'+
        (expenses.length?expenses.slice(0,12).map(function(e){return '<div class="mxPublishedExpense"><span>'+esc(e.title||e.concept||e.category||e.descripcion||'Rendición')+'</span><b>'+clp(e.amount||e.monto||0)+'</b></div>';}).join(''):'<p class="empty">Sin rendiciones registradas en el snapshot publicado.</p>')+
      '</section>'+
      '<footer>Este documento corresponde al informe publicado por la directiva y disponible para los apoderados del curso.</footer>'+
    '</section>';
  }

  function css(){return '<style>@page{size:A4;margin:10mm}*{box-sizing:border-box}body{margin:0;background:#fff;color:#0f172a;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.mxPublishedReport{max-width:820px;margin:0 auto;padding:28px}.mxPublishedReport header{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;padding-bottom:20px;border-bottom:2px solid #ede9fe}.mxPublishedReport header small{color:#6d28d9;font-weight:900;letter-spacing:.08em}.mxPublishedReport h1{font-size:30px;line-height:1.05;margin:8px 0}.mxPublishedReport header p{margin:0;color:#64748b}.mxPublishedSeal{width:104px;height:104px;border:5px solid #7c3aed;border-radius:50%;display:grid;place-items:center;text-align:center;color:#7c3aed;font-weight:900;line-height:1.05}.mxPublishedMeta{display:flex;justify-content:space-between;gap:12px;margin:18px 0;padding:12px 14px;background:#f5f3ff;border-radius:14px;color:#5b21b6}.mxPublishedKpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.mxPublishedKpis article{border:1px solid #e2e8f0;border-radius:16px;padding:14px}.mxPublishedKpis small{display:block;color:#64748b;font-weight:700}.mxPublishedKpis strong{display:block;font-size:22px;margin-top:6px}.mxPublishedBlock{margin-top:18px;border:1px solid #e2e8f0;border-radius:18px;padding:16px}.mxPublishedBlock h2{font-size:18px;margin:0 0 12px}.mxPublishedSummary{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.mxPublishedSummary div{background:#f8fafc;border-radius:12px;padding:12px}.mxPublishedSummary span,.mxPublishedSummary b{display:block}.mxPublishedSummary span{color:#64748b;font-size:12px}.mxPublishedSummary b{margin-top:5px}.mxPublishedCampaign{padding:12px 0;border-top:1px solid #eef2f7}.mxPublishedCampaign:first-of-type{border-top:0}.mxPublishedCampaign .head{display:flex;justify-content:space-between;gap:10px}.mxPublishedCampaign .bar{height:8px;background:#ede9fe;border-radius:999px;overflow:hidden;margin:8px 0}.mxPublishedCampaign .bar i{display:block;height:100%;background:#7c3aed;border-radius:999px}.mxPublishedCampaign .vals{display:flex;gap:14px;flex-wrap:wrap;color:#64748b;font-size:12px}.mxPublishedCampaign .vals b{color:#0f172a}.mxPublishedExpense{display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-top:1px solid #eef2f7}.mxPublishedReport footer{margin-top:18px;padding-top:14px;border-top:1px solid #e2e8f0;color:#64748b;font-size:11px;text-align:center}.empty{color:#64748b;font-size:13px}@media(max-width:600px){.mxPublishedReport{padding:16px}.mxPublishedKpis{grid-template-columns:1fr 1fr}.mxPublishedSummary{grid-template-columns:1fr}.mxPublishedSeal{width:76px;height:76px;font-size:11px}.mxPublishedReport h1{font-size:24px}}@media print{.mxPublishedReport{max-width:none;padding:0}.mxPublishedBlock,.mxPublishedKpis article,.mxPublishedCampaign{break-inside:avoid}}</style>';}

  function printReport(rep){
    if(!rep){alert('Aún no hay un informe publicado por la directiva.');return;}
    var frame=document.createElement('iframe');
    frame.style.cssText='position:fixed;width:0;height:0;border:0;opacity:0;pointer-events:none';
    document.body.appendChild(frame);
    var doc=frame.contentDocument||frame.contentWindow.document;
    doc.open();doc.write('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Informe ejecutivo del curso</title>'+css()+'</head><body>'+reportHTML(rep,true)+'</body></html>');doc.close();
    var once=false;function go(){if(once)return;once=true;try{frame.contentWindow.focus();frame.contentWindow.print();}catch(_e){alert('No se pudo abrir el PDF del informe.');}setTimeout(function(){try{frame.remove();}catch(_e){}},2500);}frame.onload=function(){setTimeout(go,120);};setTimeout(go,500);
  }

  function preview(rep){
    if(!rep){alert('Aún no hay un informe publicado por la directiva.');return;}
    var root=document.getElementById('modalRoot');if(!root)return;
    root.innerHTML='<div class="mxPublishedOverlay"><div class="mxPublishedPreview"><div class="mxPublishedPreviewTop"><b>Informe publicado</b><div><button type="button" onclick="downloadPublishedReportPdf()">PDF</button><button type="button" onclick="closePublishedReport()">Cerrar</button></div></div><div class="mxPublishedScroll">'+reportHTML(rep,false)+'</div></div></div>';
    document.body.style.overflow='hidden';
  }
  window.closePublishedReport=function(){var root=document.getElementById('modalRoot');if(root)root.innerHTML='';document.body.style.overflow='';};
  window.downloadPublishedReportPdf=function(){printReport(latest());};
  window.openPublishedReport=function(){preview(latest());};
  window.downloadReportPdf=function(){printReport(latest());};
  window.shareReportPdf=async function(){var rep=latest();if(!rep){alert('Aún no hay un informe publicado por la directiva.');return;}var msg='Informe ejecutivo del curso · '+periodLabel(rep.period);try{if(navigator.share){await navigator.share({title:'Informe ejecutivo del curso',text:msg});return;}}catch(_e){return;}try{await navigator.clipboard.writeText(msg);}catch(_e){}}

  function decorate(){
    var page=document.querySelector('.apoReportPage');if(!page)return;
    var rep=latest();
    var old=document.getElementById('mxPublishedReportNotice');if(old)old.remove();
    var box=document.createElement('section');box.id='mxPublishedReportNotice';box.className='mxPublishedNotice';
    if(rep){
      box.innerHTML='<div class="mxPublishedNoticeIcon">✓</div><div class="mxPublishedNoticeCopy"><span>INFORME PUBLICADO</span><h2>'+esc(periodLabel(rep.period))+'</h2><p>La directiva publicó un informe oficial del curso'+(publishedAt(rep)?' · '+esc(publishedAt(rep)):'')+'.</p></div><div class="mxPublishedNoticeActions"><button type="button" onclick="openPublishedReport()">Ver informe</button><button type="button" onclick="downloadPublishedReportPdf()">PDF</button></div>';
    }else{
      box.classList.add('empty');box.innerHTML='<div class="mxPublishedNoticeIcon">i</div><div class="mxPublishedNoticeCopy"><span>INFORMES DEL CURSO</span><h2>Sin informe publicado</h2><p>Cuando la directiva publique uno, aparecerá destacado aquí.</p></div>';
    }
    var hero=page.querySelector('.apoReportHero');if(hero&&hero.nextSibling)page.insertBefore(box,hero.nextSibling);else page.prepend(box);
    var heroPdf=page.querySelector('.apoReportActions button:first-child');if(heroPdf){heroPdf.onclick=function(){window.downloadPublishedReportPdf();};heroPdf.setAttribute('aria-label','Descargar informe publicado');}
  }

  var style=document.createElement('style');style.textContent='\n.mxPublishedNotice{margin:16px 0 18px;padding:16px;border-radius:20px;background:linear-gradient(135deg,#ede9fe,#faf5ff);border:1px solid #c4b5fd;display:grid;grid-template-columns:48px 1fr auto;gap:12px;align-items:center;box-shadow:0 10px 28px rgba(109,40,217,.09)}.mxPublishedNoticeIcon{width:48px;height:48px;border-radius:16px;background:#6d28d9;color:#fff;display:grid;place-items:center;font-size:24px;font-weight:950}.mxPublishedNoticeCopy span{display:block;color:#6d28d9;font-size:10px;font-weight:950;letter-spacing:.08em}.mxPublishedNoticeCopy h2{margin:2px 0 3px;font-size:18px}.mxPublishedNoticeCopy p{margin:0;color:#64748b;font-size:12px;line-height:1.35}.mxPublishedNoticeActions{display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end}.mxPublishedNoticeActions button{border:0;border-radius:12px;padding:10px 12px;background:#6d28d9;color:#fff;font-weight:900}.mxPublishedNoticeActions button+button{background:#fff;color:#6d28d9;border:1px solid #c4b5fd}.mxPublishedNotice.empty{background:#f8fafc;border-color:#e2e8f0}.mxPublishedNotice.empty .mxPublishedNoticeIcon{background:#e2e8f0;color:#64748b}.mxPublishedOverlay{position:fixed;inset:0;z-index:100020;background:rgba(15,23,42,.58);display:flex;padding:max(8px,env(safe-area-inset-top)) 8px max(8px,env(safe-area-inset-bottom));align-items:stretch}.mxPublishedPreview{width:min(900px,100%);margin:auto;background:#fff;border-radius:22px;overflow:hidden;display:flex;flex-direction:column;max-height:100%}.mxPublishedPreviewTop{padding:10px 12px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #e2e8f0;flex:0 0 auto}.mxPublishedPreviewTop div{display:flex;gap:7px}.mxPublishedPreviewTop button{border:1px solid #d8dee8;border-radius:11px;padding:8px 11px;background:#fff;font-weight:900}.mxPublishedPreviewTop button:first-child{background:#6d28d9;color:#fff;border-color:#6d28d9}.mxPublishedScroll{overflow:auto;-webkit-overflow-scrolling:touch}.mxPublishedScroll .mxPublishedReport{padding-top:18px}@media(max-width:620px){.mxPublishedNotice{grid-template-columns:44px 1fr}.mxPublishedNoticeIcon{width:44px;height:44px}.mxPublishedNoticeActions{grid-column:1/-1;justify-content:stretch}.mxPublishedNoticeActions button{flex:1}.mxPublishedPreview{border-radius:18px}}\n';document.head.appendChild(style);

  var timer=setInterval(decorate,400);setTimeout(function(){clearInterval(timer);},12000);
  document.addEventListener('click',function(ev){var btn=ev.target&&ev.target.closest?ev.target.closest('.navItem[data-tab="informes"]'):null;if(btn)setTimeout(decorate,150);},true);
  window.addEventListener('hashchange',function(){setTimeout(decorate,150);});
})();
