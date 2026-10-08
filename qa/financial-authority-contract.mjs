import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=(p)=>fs.readFileSync(p,'utf8');
const core=read('assets/core.js');
const finance=read('assets/finance-core-v1.js');
const renderer=read('assets/course-report-unified-v2.js');
const reports=read('assets/apoderado-reports-supabase-v1.js');
const published=read('assets/apoderado-published-report-v1.js');
const treasurer=read('assets/tesorero.js');
const guardian=read('assets/apoderado.js');

assert.match(core,/MICURSOX_OPERATIONAL_FINANCE_STATE/, 'Missing Supabase operational in-memory state');
assert.match(core,/source:"supabase"/, 'Operational data must declare source');
assert.match(renderer,/operational\.courseId/, 'Renderer must scope campaign/payment snapshot by course');
assert.match(renderer,/taskFinancialMetrics\(t,pays,totalStudents\)/, 'Renderer must use canonical finance metrics');
assert.match(renderer,/expenseCounted\(e\)/, 'Renderer must use canonical approval predicate');
assert.match(finance,/function taskDebtorCount\(/, 'Missing canonical debtor count');
assert.match(reports,/rpc\/get_my_published_reports/, 'Published report must come from Supabase RPC');
assert.doesNotMatch(reports,/localStorage\.setItem\([^\n]*(?:monthly_reports|reports_v1)/, 'Published report must not be written to browser storage');
assert.doesNotMatch(published,/localStorage\.getItem\([^\n]*monthly_reports/, 'Published report must not fallback to browser storage');
assert.match(treasurer,/await paymentApi\.syncPaidLocalPayment/, 'Manual payments must await Supabase confirmation');
assert.match(treasurer,/if\(!confirmed \|\| !confirmed\.id/, 'Manual payments must validate server response');
assert.match(guardian,/Snapshot restoration is disabled/, 'Guardian snapshot replay must stay disabled');
for (const htmlPath of ['apoderado.html','presidente.html','tesorero.html']) {
  const html=read(htmlPath);
  assert.match(html,/finance-core-v1\.js\?v=/, htmlPath+': missing finance core');
  assert.match(html,/course-report-unified-v2\.js\?v=/, htmlPath+': missing shared report renderer');
  assert.match(html,/business-data-authority-v1\.js\?v=/, htmlPath+': missing authority bridge');
}
console.log('MiCursoX financial authority contract: OK');
