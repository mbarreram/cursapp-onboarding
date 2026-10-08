import fs from 'node:fs';
import assert from 'node:assert/strict';
const file=fs.readFileSync('assets/apoderado-reports-supabase-v1.js','utf8');
const start=file.indexOf('function reportFromDb(row){');
const end=file.indexOf('async function hydratePublished',start);
assert.ok(start>=0&&end>start,'Historical report adapter not found');
const reportFromDb=Function(file.slice(start,end)+'\nreturn reportFromDb;')();
const paid=(id,name,amount)=>({fromTaskId:id,title:name,amount,paidAmount:amount,status:'paid'});
const unpaid=(id,name,amount,status='pending')=>({fromTaskId:id,title:name,amount,paidAmount:0,status});
const historic={collected:2492000,spent:578480,balance:1913520,ps:[
  paid('h','Cuota del Huevo',1500),unpaid('h','Cuota del Huevo',1500),
  paid('r','Rifa I semestre',20000),unpaid('r','Rifa I semestre',20000),
  unpaid('t','Trajes de 18',15500,'opted_out')
],okE:[{amount:578480}],period:'2026-10'};
const report=reportFromDb({id:'legacy',contenido:JSON.stringify(historic),periodo:'2026-10',publicado:true});
assert.equal(report.recaudadoCurso,2492000);
assert.equal(report.gastadoCurso,578480);
assert.equal(report.disponibleCurso,1913520);
assert.equal(report.campaigns.length,3);
assert.equal(report.pendienteCurso,37000);
assert.equal(report.campaigns.find(c=>c.id==='h').pending,1500);
assert.equal(report.campaigns.find(c=>c.id==='t').pending,15500);
assert.equal(report.expenses.length,1);
assert.equal(historic.campaigns,undefined,'Original historical object must remain unchanged');
const modern=reportFromDb({id:'modern',contenido:{recaudadoCurso:50,gastadoCurso:10,campaigns:[{id:'m',collected:50,pending:0}],expenses:[]},periodo:'2026-10',publicado:true});
assert.equal(modern.campaigns.length,1);
assert.equal(modern.recaudadoCurso,50);
console.log('MiCursoX historical published reports: OK');
