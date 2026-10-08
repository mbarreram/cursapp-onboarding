(function(root){
  'use strict';
  if(root.CURSAPP_FINANCE_CORE_V1)return;

  const n=v=>{const x=Number(v);return Number.isFinite(x)?x:0};
  const ym=v=>{
    const s=String(v||'').trim();
    if(/^\d{4}-\d{2}$/.test(s))return s;
    const m=s.match(/^(\d{4}-\d{2})-\d{2}/);
    return m?m[1]:'';
  };
  const status=p=>String(p?.status??p?.estado??'').toLowerCase().trim();
  const excluded=p=>['opted_out','no_participa','no participa','excluido','excluida','void','cancelled','cancelado','cancelada','anulado','anulada','credit_used'].includes(status(p));
  const taskId=p=>String(p?.fromTaskId??p?.campaignId??p?.campana_id??'').trim();
  const identity=p=>String(p?.miembroId??p?.memberId??p?.miembro_id??p?.alumnoId??p?.apoderadoKey??p?.apoderadoId??p?.apoderadoEmail??p?.email??'').toLowerCase().trim();
  const obligation=p=>Math.max(0,n(p?.obligationAmount??p?.amount??p?.monto));
  const paidAmount=p=>{
    const explicit=p?.paidAmount??p?.monto_pagado??p?.amountPaid;
    if(explicit!==undefined&&explicit!==null&&explicit!=='')return Math.max(0,n(explicit));
    return ['paid','pagado','conciliado','completed','completado'].includes(status(p))?obligation(p):0;
  };
  const remaining=p=>{
    if(!p||excluded(p))return 0;
    const explicit=p?.amountRemaining;
    if(explicit!==undefined&&explicit!==null&&explicit!=='')return Math.max(0,n(explicit));
    return Math.max(0,obligation(p)-paidAmount(p));
  };
  const paidPeriod=p=>ym(p?.paidAt??p?.paid_at??p?.paidDate??p?.paid_on??'');
  const obligationPeriod=p=>ym(p?.period??p?.periodo??p?.dueDate??p?.fecha_vencimiento??'');
  const isMonthly=t=>String(t?.type??t?.tipo??'single').toLowerCase().includes('month')||String(t?.type??t?.tipo??'').toLowerCase().includes('mens');
  const mandatory=t=>t?.mandatoryParticipation!==false&&t?.obligatoria!==false;
  const closed=t=>!!t?.closed||['closed','cerrada','cerrado','cancelada','cancelado','eliminada','eliminado'].includes(String(t?.status??t?.estado??'').toLowerCase().trim());
  const taskAmount=t=>Math.max(0,n(t?.amount??t?.monto));
  const taskMonths=t=>Math.max(1,Math.trunc(n(t?.months??t?.meses??1))||1);
  const addMonths=(period,offset)=>{
    if(!/^\d{4}-\d{2}$/.test(period))return '';
    const y=Number(period.slice(0,4)),m=Number(period.slice(5,7));
    const d=new Date(Date.UTC(y,m-1+offset,1));
    return d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0');
  };
  const taskAppliesInMonth=(t,period)=>{
    if(!period)return false;
    if(isMonthly(t)){
      const start=ym(t?.startDate??t?.fecha_inicio??t?.dueDate??t?.fecha_vencimiento??'');
      if(!start)return false;
      for(let i=0;i<taskMonths(t);i++)if(addMonths(start,i)===period)return true;
      return false;
    }
    return ym(t?.dueDate??t?.fecha_vencimiento??'')===period;
  };
  const taskExpectedTotal=(t,studentTotal)=>{
    const explicit=Math.max(0,n(t?.goalTotal),n(t?.goal_total),n(t?.meta),n(t?.goal),n(t?.target),n(t?.amountGoal));
    if(explicit>0)return explicit;
    return taskAmount(t)*Math.max(0,n(studentTotal))*(isMonthly(t)?taskMonths(t):1);
  };
  const voluntaryOptOut=p=>['opted_out','no_participa','no participa','excluido','excluida'].includes(status(p));
  const hardExcluded=p=>['void','cancelled','cancelado','cancelada','anulado','anulada','credit_used'].includes(status(p));
  const excludedForTask=(p,t)=>hardExcluded(p)||(!mandatory(t)&&voluntaryOptOut(p));
  const remainingForTask=(p,t)=>{
    if(!p||excludedForTask(p,t))return 0;
    if(mandatory(t)&&voluntaryOptOut(p))return obligation(p);
    return remaining(p);
  };
  const taskIdentity=p=>identity(p);

  function rowsForTaskPeriod(payments,id,period){
    return (payments||[]).filter(p=>taskId(p)===String(id||'')&&obligationPeriod(p)===period&&!excluded(p));
  }
  function taskMonthMetrics(t,payments,studentTotal,period){
    const id=String(t?.id??t?.supabaseId??t?.campana_id??'');
    const rows=rowsForTaskPeriod(payments,id,period);
    const materialized=rows.reduce((s,p)=>s+obligation(p),0);
    const appliedPaid=rows.reduce((s,p)=>s+Math.min(obligation(p),paidAmount(p)),0);
    const materializedPending=rows.reduce((s,p)=>s+remaining(p),0);
    let expected=materialized;
    if(mandatory(t)&&!closed(t)&&taskAppliesInMonth(t,period)){
      expected=Math.max(materialized,taskAmount(t)*Math.max(0,n(studentTotal)));
    }
    const missing=Math.max(0,expected-materialized);
    return {taskId:id,materialized,appliedPaid,materializedPending,missing,expected,pending:materializedPending+missing,rows};
  }
  const expensePeriod=e=>ym(e?.date??e?.fecha??e?.expenseDate??e?.fecha_gasto??e?.fecha_rendicion??'');
  function monthSummary({payments=[],tasks=[],expenses=[],studentTotal=0,period}={}){
    const p=period||'';
    const collected=payments.reduce((s,row)=>s+(!excluded(row)&&paidPeriod(row)===p?paidAmount(row):0),0);
    const taskIds=new Set((tasks||[]).map(t=>String(t?.id??t?.supabaseId??t?.campana_id??'')).filter(Boolean));
    const byTask=(tasks||[]).map(t=>taskMonthMetrics(t,payments,studentTotal,p));
    let projected=byTask.reduce((s,x)=>s+x.expected,0);
    let pending=byTask.reduce((s,x)=>s+x.pending,0);
    let appliedPaid=byTask.reduce((s,x)=>s+x.appliedPaid,0);
    const orphan=(payments||[]).filter(row=>obligationPeriod(row)===p&&!excluded(row)&&!taskIds.has(taskId(row)));
    projected+=orphan.reduce((s,row)=>s+obligation(row),0);
    pending+=orphan.reduce((s,row)=>s+remaining(row),0);
    appliedPaid+=orphan.reduce((s,row)=>s+Math.min(obligation(row),paidAmount(row)),0);

    const requiredTasks=(tasks||[]).filter(t=>{
      if(!mandatory(t))return false;
      const id=String(t?.id??t?.supabaseId??t?.campana_id??'');
      return taskAppliesInMonth(t,p)||rowsForTaskPeriod(payments,id,p).length>0;
    });
    let debtors=0;
    if(requiredTasks.length){
      const settledByTask=new Map();
      requiredTasks.forEach(t=>{
        const id=String(t?.id??t?.supabaseId??t?.campana_id??'');
        const set=new Set();
        const debts=new Set();
        rowsForTaskPeriod(payments,id,p).forEach(row=>{
          const who=identity(row);
          if(!who)return;
          if(remainingForTask(row,t)>0)debts.add(who);
          else if(!excludedForTask(row,t))set.add(who);
        });
        debts.forEach(who=>set.delete(who));
        settledByTask.set(id,set);
      });
      const allIds=new Set();
      requiredTasks.forEach(t=>{
        const id=String(t?.id??t?.supabaseId??t?.campana_id??'');
        rowsForTaskPeriod(payments,id,p).forEach(row=>{const who=identity(row);if(who)allIds.add(who)});
      });
      let fullySettled=0;
      allIds.forEach(who=>{
        if(requiredTasks.every(t=>settledByTask.get(String(t?.id??t?.supabaseId??t?.campana_id??''))?.has(who)))fullySettled++;
      });
      const universe=Math.max(Math.max(0,n(studentTotal)),allIds.size);
      debtors=Math.max(0,universe-fullySettled);
    }
    const spent=(expenses||[]).filter(expenseCounted).reduce((s,e)=>s+(expensePeriod(e)===p?Math.max(0,n(e?.amount??e?.monto??e?.total_gastado)):0),0);
    return {period:p,collected,projected,pending,appliedPaid,debtors,spent,byTask};
  }
  function allSummary({payments=[],tasks=[],expenses=[],studentTotal=0}={}){
    const usableTasks=(tasks||[]).filter(t=>!['eliminada','eliminado','deleted'].includes(String(t?.status??t?.estado??'').toLowerCase().trim()));
    const course=courseSummary({payments,expenses});
    const pending=usableTasks.reduce((s,t)=>s+taskPendingTotal(t,payments,studentTotal),0);
    const debtorIds=new Set();
    let projectedDebtors=0;
    usableTasks.forEach(t=>{
      const id=String(t?.id??t?.supabaseId??t?.campana_id??'');
      (payments||[]).filter(p=>taskId(p)===id&&!hardExcluded(p)).forEach(p=>{
        if(remainingForTask(p,t)>0){const who=identity(p);if(who)debtorIds.add(who)}
      });
      projectedDebtors=Math.max(projectedDebtors,taskDebtorCount(t,payments,studentTotal));
    });
    return {
      collected:course.collected,
      spent:course.spent,
      balance:course.balance,
      pending,
      debtors:Math.max(debtorIds.size,projectedDebtors)
    };
  }

  function expenseCounted(e){
    const st=String(e?.status??e?.estado??e?.approvalStatus??'').toLowerCase().trim();
    return !['pending','pendiente','observed','observada','observado','rejected','rechazada','rechazado','cancelled','cancelada','cancelado','anulada','anulado','void'].includes(st);
  }
  function courseSummary({payments=[],expenses=[]}={}){
    const collected=payments.reduce((s,p)=>s+(excluded(p)?0:paidAmount(p)),0);
    const spent=(expenses||[]).filter(expenseCounted).reduce((s,e)=>s+Math.max(0,n(e?.amount??e?.monto??e?.total_gastado)),0);
    return {collected,spent,balance:collected-spent};
  }
  function taskPendingTotal(t,payments,studentTotal){
    const id=String(t?.id??t?.supabaseId??t?.campana_id??'');
    const rows=(payments||[]).filter(p=>taskId(p)===id&&!hardExcluded(p));
    const materializedPending=rows.reduce((s,p)=>s+remainingForTask(p,t),0);
    if(!mandatory(t))return materializedPending;
    const expected=taskExpectedTotal(t,studentTotal);
    const paid=rows.reduce((s,p)=>s+(!excludedForTask(p,t)?paidAmount(p):0),0);
    return Math.max(materializedPending,Math.max(0,expected-paid));
  }
  function taskDebtorCount(t,payments,studentTotal){
    const id=String(t?.id??t?.supabaseId??t?.campana_id??'');
    const rows=(payments||[]).filter(p=>taskId(p)===id&&!hardExcluded(p));
    const debtors=new Set();
    rows.forEach(p=>{if(remainingForTask(p,t)>0){const who=taskIdentity(p);if(who)debtors.add(who)}});
    if(!mandatory(t))return debtors.size;
    const universe=Math.max(Math.max(0,n(studentTotal)),new Set(rows.map(taskIdentity).filter(Boolean)).size);
    // A member is settled only when every materialized obligation in this
    // campaign is satisfied. One paid installment cannot clear other debts.
    const grouped=new Map();
    rows.forEach(p=>{
      const who=taskIdentity(p);
      if(!who)return;
      const entry=grouped.get(who)||{hasDebt:false,hasValidPayment:false};
      if(remainingForTask(p,t)>0)entry.hasDebt=true;
      if(!excludedForTask(p,t))entry.hasValidPayment=true;
      grouped.set(who,entry);
    });
    let settled=0;
    grouped.forEach(v=>{if(v.hasValidPayment&&!v.hasDebt)settled++;});
    return Math.max(debtors.size,Math.max(0,universe-settled));
  }
  function taskFinancialMetrics(t,payments,studentTotal){
    const id=String(t?.id??t?.supabaseId??t?.campana_id??'');
    const rows=(payments||[]).filter(p=>taskId(p)===id&&!hardExcluded(p));
    const collected=rows.reduce((s,p)=>s+(!excludedForTask(p,t)?paidAmount(p):0),0);
    const pending=taskPendingTotal(t,payments,studentTotal);
    const expectedBase=taskExpectedTotal(t,studentTotal);
    const expected=Math.max(0,expectedBase,collected+pending);
    const debtors=taskDebtorCount(t,payments,studentTotal);
    const pct=expected>0?Math.max(0,Math.min(100,Math.round((collected/expected)*100))):0;
    return {taskId:id,collected,pending,expected,debtors,pct};
  }

  function taskPendingInstallments(t,payments){
    const id=String(t?.id??t?.supabaseId??t?.campana_id??'');
    return (payments||[]).filter(p=>taskId(p)===id&&!hardExcluded(p)&&remainingForTask(p,t)>0).length;
  }

  const api=Object.freeze({
    ym,status,excluded,taskId,identity,obligation,paidAmount,remaining,paidPeriod,obligationPeriod,expensePeriod,
    isMonthly,mandatory,closed,expenseCounted,taskAppliesInMonth,taskExpectedTotal,excludedForTask,remainingForTask,taskDebtorCount,taskFinancialMetrics,taskPendingInstallments,taskMonthMetrics,monthSummary,allSummary,courseSummary,taskPendingTotal
  });
  root.CURSAPP_FINANCE_CORE_V1=true;
  root.CURSAPP_FINANCE_CORE=api;
})(typeof window!=='undefined'?window:globalThis);
