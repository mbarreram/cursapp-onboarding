import assert from 'node:assert/strict';
await import('../assets/finance-core-v1.js');
const f=globalThis.CURSAPP_FINANCE_CORE;
assert.ok(f,'finance core must load');

const paid=(id,task,who,amount,period,paidAt)=>({
  id,fromSupabase:true,fromTaskId:task,miembroId:who,amount,obligationAmount:amount,
  paidAmount:amount,monto_pagado:amount,amountRemaining:0,status:'paid',period,paidAt
});
const pending=(id,task,who,amount,period)=>({
  id,fromSupabase:true,fromTaskId:task,miembroId:who,amount,obligationAmount:amount,
  paidAmount:0,monto_pagado:0,amountRemaining:amount,status:'pending',period,paidAt:''
});

{
  const p={...paid('p1','t1','u1',1000,'2026-09','2026-09-10T12:00:00Z'),createdAt:'2026-10-07T12:00:00Z'};
  assert.equal(f.monthSummary({payments:[p],tasks:[],studentTotal:0,period:'2026-10'}).collected,0,'createdAt must never count as payment date');
}
{
  const task={id:'huevo',type:'monthly',amount:1500,months:9,startDate:'2026-03-01',mandatoryParticipation:true,closed:false};
  const rows=[];
  for(let i=1;i<=40;i++) rows.push(i<=23?paid('h'+i,'huevo','u'+i,1500,'2026-10','2026-10-05T12:00:00Z'):pending('h'+i,'huevo','u'+i,1500,'2026-10'));
  const m=f.monthSummary({payments:rows,tasks:[task],studentTotal:40,period:'2026-10'});
  assert.equal(m.collected,34500);
  assert.equal(m.projected,60000);
  assert.equal(m.pending,25500);
  assert.equal(m.debtors,17);
}
{
  const task={id:'gala',type:'monthly',amount:5000,months:20,startDate:'2026-03-01',mandatoryParticipation:false,goalTotal:4000000,closed:false};
  const rows=[1,2,3].map(i=>paid('g'+i,'gala','u'+i,5000,'2026-10','2026-10-05T12:00:00Z'));
  const m=f.monthSummary({payments:rows,tasks:[task],studentTotal:40,period:'2026-10'});
  assert.equal(m.projected,15000,'voluntary goal is not debt');
  assert.equal(m.pending,0,'paid voluntary commitments have no debt');
  assert.equal(f.taskPendingTotal(task,rows,40),0,'voluntary campaign target must not become pending debt');
}
{
  const task={id:'mandatory',type:'monthly',amount:2000,months:3,startDate:'2026-10-01',mandatoryParticipation:true,closed:false};
  const m=f.monthSummary({payments:[],tasks:[task],studentTotal:40,period:'2026-10'});
  assert.equal(m.projected,80000,'mandatory projection must not depend on rows being materialized');
  assert.equal(m.pending,80000);
  assert.equal(m.debtors,40);
}
{
  const row={id:'partial',fromTaskId:'x',miembroId:'u1',amount:100,paidAmount:40,amountRemaining:60,status:'partial',period:'2026-10',paidAt:'2026-10-03T12:00:00Z'};
  assert.equal(f.paidAmount(row),40);
  assert.equal(f.remaining(row),60);
  assert.equal(f.monthSummary({payments:[row],tasks:[],studentTotal:0,period:'2026-10'}).collected,40);
}
{
  const row={id:'opt',fromTaskId:'v',miembroId:'u1',amount:5000,paidAmount:0,amountRemaining:5000,status:'opted_out',period:'2026-10'};
  assert.equal(f.remaining(row),0);
  assert.equal(f.courseSummary({payments:[row],expenses:[]}).collected,0);
}
{
  const payments=[{status:'paid',amount:2492000,paidAmount:2492000,paidAt:'2026-09-01'}];
  const expenses=[{status:'aprobada',amount:578480}];
  const s=f.courseSummary({payments,expenses});
  assert.equal(s.collected,2492000);
  assert.equal(s.spent,578480);
  assert.equal(s.balance,1913520);
}
console.log('finance-core-v1: all assertions passed');

// Mandatory campaign: an opt-out marker cannot erase debt.
{
  const task={id:'mandatory-opt',type:'single',amount:5000,mandatoryParticipation:true,closed:true,dueDate:'2026-09-30'};
  const rows=[];
  for(let i=1;i<=39;i++) rows.push(paid('mo'+i,'mandatory-opt','u'+i,5000,'2026-09','2026-09-18T12:00:00Z'));
  rows.push({id:'mo40',fromTaskId:'mandatory-opt',miembroId:'u40',amount:5000,obligationAmount:5000,paidAmount:0,monto_pagado:0,amountRemaining:0,status:'opted_out',period:'2026-09',paidAt:''});
  assert.equal(f.taskPendingTotal(task,rows,40),5000,'mandatory opt-out must remain debt');
  assert.equal(f.taskDebtorCount(task,rows,40),1,'mandatory opt-out must count as debtor');
  assert.equal(f.taskPendingInstallments(task,rows),1,'mandatory opt-out must remain pending installment');
}
// Voluntary campaign: opt-out must exclude debt.
{
  const task={id:'vol-opt',type:'single',amount:5000,mandatoryParticipation:false,closed:false,dueDate:'2026-09-30'};
  const rows=[{id:'vo1',fromTaskId:'vol-opt',miembroId:'u1',amount:5000,obligationAmount:5000,paidAmount:0,monto_pagado:0,amountRemaining:5000,status:'opted_out',period:'2026-09'}];
  assert.equal(f.taskPendingTotal(task,rows,40),0);
  assert.equal(f.taskDebtorCount(task,rows,40),0);
  assert.equal(f.taskPendingInstallments(task,rows),0);
}
console.log('mandatory/voluntary opt-out invariants passed');
