import { execFileSync } from 'node:child_process';

function git(args){
  return execFileSync('git', args, {encoding:'utf8', stdio:['ignore','pipe','pipe']});
}

let baseArgs;
if (process.env.GITHUB_EVENT_NAME === 'pull_request' && process.env.GITHUB_BASE_REF) {
  baseArgs = [`origin/${process.env.GITHUB_BASE_REF}...HEAD`];
} else {
  try { git(['rev-parse','HEAD^']); baseArgs = ['HEAD^','HEAD']; }
  catch { console.log('MiCursoX · localStorage audit: sin commit previo, se omite.'); process.exit(0); }
}

let diff = '';
try {
  diff = git(['diff','--unified=0',...baseArgs,'--','*.js','*.mjs']);
} catch (error) {
  console.error('No se pudo calcular el diff para auditoría localStorage.');
  process.exit(1);
}

const business = /(KEY_(PAYMENTS|TASKS|EXPENSES|REPORTS|PROFILES|ENROLLMENTS)|cursapp_(payments|tasks|expenses|profiles|enrollments|campaign_reports|retiros|withdrawals|rendiciones)|save\s*\(\s*KEY_(PAYMENTS|TASKS|EXPENSES|REPORTS)|localStorage\.setItem\([^\n]*(payments|tasks|expenses|profiles|enrollments|reports|retiros|rendiciones))/i;
const added = diff.split('\n').filter(line => line.startsWith('+') && !line.startsWith('+++'));
const violations = added.filter(line => business.test(line));

if (violations.length) {
  console.error('\nMiCursoX · No New Business localStorage: FALLÓ');
  console.error('No agregues nuevas escrituras de datos de negocio en localStorage. Usa la capa Supabase existente.\n');
  violations.forEach(v => console.error(v));
  process.exit(1);
}

console.log('MiCursoX · No New Business localStorage: OK');
