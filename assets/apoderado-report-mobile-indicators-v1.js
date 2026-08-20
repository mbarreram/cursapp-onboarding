(function(){
  'use strict';
  if(window.__MX_APO_REPORT_MOBILE_INDICATORS_V1__) return;
  window.__MX_APO_REPORT_MOBILE_INDICATORS_V1__ = true;

  function clp(value){ return '$' + Number(value || 0).toLocaleString('es-CL'); }
  function norm(value){ return String(value == null ? '' : value).trim().toLowerCase(); }
  function currentYM(){ var d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'); }
  function scoped(base){
    try{ if(window.CURSAPP && typeof window.CURSAPP.scopedKey === 'function') return window.CURSAPP.scopedKey(base); }catch(_e){}
    return 'cursapp_'+base;
  }
  function load(base){
    try{ var v=JSON.parse(localStorage.getItem(scoped(base)) || '[]'); return Array.isArray(v) ? v : []; }catch(_e){ return []; }
  }
  function status(p){ return norm(p && (p.status || p.estado)); }
  function excluded(p){ return ['opted_out','no_participa','no participa','void','cancelled','cancelado','anulado'].includes(status(p)); }
  function paid(p){ return ['paid','pagado','conciliado'].includes(status(p)); }
  function amountPaid(p){ return Number((p && (p.amountPaid ?? p.monto_pagado ?? p.amount ?? p.monto)) || 0) || 0; }
  function amountDue(p){ return Number((p && (p.amountRemaining ?? p.amount ?? p.monto)) || 0) || 0; }
  function taskId(p){ return String((p && (p.fromTaskId || p.campana_id || p.taskId || p.campaignId)) || ''); }
  function taskTitle(t){ return String((t && (t.title || t.titulo || t.name || t.nombre)) || 'Campaña'); }
  function taskType(t){ var s=norm(t && (t.type || t.tipo)); return (s.indexOf('mens')>=0 || s==='monthly') ? 'monthly' : 'single'; }
  function taskMonths(t){ return Math.max(1, Number((t && (t.months || t.meses || t.cuotas)) || 1) || 1); }
  function taskAmount(t){ return Number((t && (t.amount || t.monto)) || 0) || 0; }
  function taskGoal(t){ return Number((t && (t.goalTotal || t.goal_total || t.meta)) || 0) || 0; }
  function taskPeriod(t){ return String((t && (t.dueDate || t.fecha_vencimiento || t.startDate || t.fecha_inicio || t.createdAt || t.created_at)) || '').slice(0,7); }
  function paymentPeriod(p){ return String((p && (p.period || p.periodo || p.dueDate || p.fecha_vencimiento || p.paidAt || p.paid_at)) || '').slice(0,7); }

  function calc(){
    var ym=currentYM();
    var tasks=load('tasks_v1').filter(function(t){ return t && !(t.closed === true) && !['cerrada','closed','cancelada','cancelled'].includes(norm(t.status || t.estado)); });
    var payments=load('payments_v1').filter(function(p){ return p && !excluded(p); });
    var byId={};
    var byTitle={};
    var totalTargetMonth=0;
    var totalCollectedMonth=0;
    var maxDebtors=0;

    tasks.forEach(function(t){
      var id=String(t.id || t.campana_id || '');
      var ps=payments.filter(function(p){ return taskId(p)===id; });
      var type=taskType(t);
      var months=taskMonths(t);
      var goal=taskGoal(t);
      var amount=taskAmount(t);
      var objective=goal>0 ? goal : ps.reduce(function(sum,p){ return sum + amountDue(p); },0);
      if(!objective && amount) objective=amount;

      var collectedTotal=ps.filter(paid).reduce(function(sum,p){ return sum + amountPaid(p); },0);
      var relevantMonth = type==='monthly' ? true : (taskPeriod(t)===ym || taskPeriod(t)==='');
      var monthTarget = relevantMonth ? (type==='monthly' ? objective/months : objective) : 0;
      var collectedMonth = ps.filter(function(p){
        if(!paid(p)) return false;
        if(type==='single') return relevantMonth;
        return paymentPeriod(p)===ym;
      }).reduce(function(sum,p){ return sum + amountPaid(p); },0);
      var pendingMonth=Math.max(0, Math.round(monthTarget-collectedMonth));
      var perStudent=amount>0 ? amount : 0;
      var expectedStudents=perStudent>0 && monthTarget>0 ? Math.round(monthTarget/perStudent) : 0;
      var paidStudents=new Set(ps.filter(function(p){ return paid(p) && (type==='single' ? relevantMonth : paymentPeriod(p)===ym); }).map(function(p){ return String(p.miembroId || p.miembro_id || p.payerProfileId || p.profileId || p.userId || p.apoderadoEmail || p.email || p.id || ''); }).filter(Boolean)).size;
      maxDebtors=Math.max(maxDebtors, Math.max(0, expectedStudents-paidStudents));
      totalTargetMonth += monthTarget;
      totalCollectedMonth += collectedMonth;
      var row={id:id,title:taskTitle(t),objective:objective,collectedTotal:collectedTotal,pendingMonth:pendingMonth,monthTarget:monthTarget,collectedMonth:collectedMonth};
      byId[id]=row;
      byTitle[norm(row.title)]=row;
    });
    return {ym:ym,byId:byId,byTitle:byTitle,targetMonth:Math.round(totalTargetMonth),collectedMonth:Math.round(totalCollectedMonth),pendingMonth:Math.max(0,Math.round(totalTargetMonth-totalCollectedMonth)),debtors:maxDebtors};
  }

  function findExactText(root, text){
    return Array.from(root.querySelectorAll('div,span,p,small')).find(function(el){ return String(el.textContent || '').trim()===text; }) || null;
  }

  function patchReport(){
    var root=document.getElementById('modalRoot');
    var card=document.getElementById('modalCard');
    if(!root || !card) return;
    root.classList.add('mxApoReportOpen');

    var close=document.createElement('button');
    close.type='button';
    close.className='mxApoReportFloatingClose';
    close.setAttribute('aria-label','Cerrar informe');
    close.textContent='×';
    close.onclick=function(){ if(typeof window.closeModal==='function') window.closeModal(); };
    root.appendChild(close);

    var data=calc();
    var indicatorHeading=Array.from(card.querySelectorAll('div')).find(function(el){ return String(el.textContent||'').trim()==='📌 Indicadores por campaña'; });
    if(indicatorHeading && indicatorHeading.nextElementSibling){
      Array.from(indicatorHeading.nextElementSibling.children).forEach(function(campaignCard){
        var first=campaignCard.querySelector('div[style*="font-weight:950"]');
        var title=first ? norm(first.textContent) : '';
        var row=data.byTitle[title];
        if(!row) return;
        Array.from(campaignCard.querySelectorAll('div')).forEach(function(line){
          var txt=String(line.textContent||'').trim();
          if(txt.indexOf('⏳ Pendiente mes:')===0) line.innerHTML='⏳ Pendiente mes: <b>'+clp(row.pendingMonth)+'</b>';
        });
      });
    }

    var labels=Array.from(card.querySelectorAll('div')).filter(function(el){ return String(el.textContent||'').trim()==='⏳ Por cobrar este mes'; });
    labels.forEach(function(label){ if(label.nextElementSibling) label.nextElementSibling.textContent=clp(data.pendingMonth); });

    var compliance=Array.from(card.querySelectorAll('div')).find(function(el){ var t=String(el.textContent||''); return t.indexOf('💵 Cobrado mes:')>=0 && t.indexOf('Proyección mes:')>=0; });
    if(compliance){
      compliance.innerHTML='💵 Cobrado mes: <b>'+clp(data.collectedMonth)+'</b> · ⏳ Proyección mes: <b>'+clp(data.targetMonth)+'</b> · 👥 Deudores mes: <b>'+data.debtors+'</b>';
      var box=compliance.parentElement;
      if(box){
        var pct=data.targetMonth>0 ? Math.max(0,Math.min(100,Math.round(data.collectedMonth/data.targetMonth*100))) : 0;
        var top=box.querySelector('div[style*="font-weight:950;font-size:18px"]');
        if(top) top.textContent=pct+'%';
        var bars=Array.from(box.querySelectorAll('div')).filter(function(el){ return String(el.getAttribute('style')||'').indexOf('background:#16a34a')>=0; });
        bars.forEach(function(bar){ bar.style.width=pct+'%'; });
      }
    }
  }

  var style=document.createElement('style');
  style.textContent='\n#modalRoot.mxApoReportOpen>div{align-items:stretch!important;padding-top:max(8px,env(safe-area-inset-top))!important;padding-bottom:max(8px,env(safe-area-inset-bottom))!important;padding-left:8px!important;padding-right:8px!important;}\n#modalRoot.mxApoReportOpen #modalCard{max-height:calc(100dvh - max(16px,env(safe-area-inset-top)) - max(16px,env(safe-area-inset-bottom)))!important;margin:0!important;border-radius:20px!important;overflow:auto!important;}\n#modalRoot.mxApoReportOpen #modalCard>div>div{overflow:visible!important;}\n#modalRoot .mxApoReportFloatingClose{position:fixed;top:max(12px,calc(env(safe-area-inset-top) + 6px));right:12px;z-index:100005;width:44px;height:44px;border-radius:999px;border:1px solid rgba(15,23,42,.12);background:#fff;color:#111827;font-size:30px;line-height:1;display:grid;place-items:center;box-shadow:0 8px 28px rgba(15,23,42,.18);}\n';
  document.head.appendChild(style);

  function install(){
    if(typeof window.openReport!=='function') return false;
    if(window.openReport.__mxApoReportFixed) return true;
    var original=window.openReport;
    var wrapped=function(){
      var result=original.apply(this,arguments);
      setTimeout(patchReport,0);
      setTimeout(patchReport,120);
      return result;
    };
    wrapped.__mxApoReportFixed=true;
    window.openReport=wrapped;

    var originalClose=window.closeModal;
    if(typeof originalClose==='function' && !originalClose.__mxApoReportFixed){
      var closeWrapped=function(){
        var r=originalClose.apply(this,arguments);
        var root=document.getElementById('modalRoot');
        if(root) root.classList.remove('mxApoReportOpen');
        return r;
      };
      closeWrapped.__mxApoReportFixed=true;
      window.closeModal=closeWrapped;
    }
    return true;
  }

  var tries=0;
  var timer=setInterval(function(){ tries++; if(install() || tries>50) clearInterval(timer); },100);
})();
