import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const guardedEntrypoints = [
  'login.html',
  'onboarding/dashboard.html',
  'apoderado.html',
  'presidente.html',
  'tesorero.html',
  'perfil.html',
  'pay.html',
  'pay_result.html'
];
const requiredScript = '/assets/user-facing-copy-production-v1.js?v=1';
const forbiddenInEntrypoints = [
  /\bdebug=1\b/i,
  /\bDEMO_MODE\s*=\s*true\b/i,
  /Datos guardados en Supabase/i,
  /Cargando perfil desde Supabase/i,
  /Supabase Auth/i,
  /Error JS:/i,
  /Login Apple disponible en pr[oó]xima integraci[oó]n/i,
  /\(demo\)/i
];

const errors = [];
for (const rel of guardedEntrypoints) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) {
    errors.push(`${rel}: archivo no encontrado`);
    continue;
  }
  const html = fs.readFileSync(file, 'utf8');
  if (!html.includes(requiredScript)) errors.push(`${rel}: falta ${requiredScript}`);
  for (const rule of forbiddenInEntrypoints) {
    if (rule.test(html)) errors.push(`${rel}: contiene patrón productivo prohibido ${rule}`);
  }
  if (/admin-console|admin-secure|admin\.js/i.test(html)) errors.push(`${rel}: referencia inesperada a recursos Admin`);
}

const login = fs.readFileSync(path.join(ROOT,'login.html'),'utf8');
if (!login.includes('/legal.html#terminos')) errors.push('login.html: términos legales no apuntan a la página legal');
if (!login.includes('/legal.html#privacidad')) errors.push('login.html: privacidad no apunta a la página legal');
if (/Apple disponible|pr[oó]xima integraci[oó]n/i.test(login)) errors.push('login.html: no debe mostrar integraciones no disponibles');

const onboarding = fs.readFileSync(path.join(ROOT,'onboarding/dashboard.html'),'utf8');
if (!/No pudimos continuar/.test(onboarding)) errors.push('onboarding/dashboard.html: falta mensaje de error productivo');
if (/Error JS:/i.test(onboarding)) errors.push('onboarding/dashboard.html: expone diagnóstico técnico');
if (!onboarding.includes('/onboarding/assets/onboarding-production-source-v1.js?v=1')) errors.push('onboarding/dashboard.html: falta guard de fuente productiva');

const territorialFile = path.join(ROOT,'onboarding/assets/territorial-catalog-v2.js');
if (!fs.existsSync(territorialFile)) errors.push('Falta catálogo territorial productivo');
else {
  const territorial = fs.readFileSync(territorialFile,'utf8');
  if (/REGION_FALLBACK/.test(territorial)) errors.push('territorial-catalog-v2.js: no debe usar fallback local de regiones');
  if (!/source:'supabase'/.test(territorial)) errors.push('territorial-catalog-v2.js: no declara Supabase como fuente del catálogo');
  if (!/catalogo_oficial=eq\.true/.test(territorial)) errors.push('territorial-catalog-v2.js: búsqueda de colegios no filtra catálogo oficial');
}

const businessAuthority = path.join(ROOT,'assets/business-data-authority-v1.js');
if (!fs.existsSync(businessAuthority)) errors.push('Falta business-data-authority-v1.js');
else {
  const authority = fs.readFileSync(businessAuthority,'utf8');
  if (!/MICURSOX_BUSINESS_SOURCE\s*=\s*'supabase'/.test(authority)) errors.push('business-data-authority-v1.js: no declara Supabase como fuente de negocio');
  if (!/CURSAPP_PAYMENTS_V11\?\.refresh/.test(authority)) errors.push('business-data-authority-v1.js: no refresca pagos canónicos');
  if (!/CURSAPP_TREASURY\?\.hydrate/.test(authority)) errors.push('business-data-authority-v1.js: no hidrata tesorería canónica');
  if (!/cursapp_payments_snapshot_v584_/.test(authority)) errors.push('business-data-authority-v1.js: no neutraliza snapshots antiguos de pagos');
}

for (const rel of ['apoderado.html','presidente.html','tesorero.html']) {
  const html = fs.readFileSync(path.join(ROOT,rel),'utf8');
  if (!html.includes('/assets/business-data-authority-v1.js?v=1')) errors.push(`${rel}: falta autoridad Supabase de datos de negocio`);
}

for (const rel of ['registro-apoderado.html','registro-presidente.html']) {
  const html = fs.readFileSync(path.join(ROOT,rel),'utf8');
  if (!/<title>[^<]*MiCursoX/i.test(html)) errors.push(`${rel}: branding anterior en título`);
}

const copyFile = path.join(ROOT, 'assets/user-facing-copy-production-v1.js');
if (!fs.existsSync(copyFile)) errors.push('Falta user-facing-copy-production-v1.js');
else {
  const copy = fs.readFileSync(copyFile, 'utf8');
  if (!/DEMO_MODE\s*=\s*false/.test(copy)) errors.push('La capa productiva no fuerza DEMO_MODE=false');
  if (!/searchParams\.delete\(key\)/.test(copy)) errors.push('La capa productiva no elimina flags debug/demo de URL');
  for (const token of ['Supabase Auth','RLS/DELETE','UUID','localStorage','(demo)','En celular no existe F12','permission denied']) {
    if (!copy.includes(token)) errors.push(`La capa productiva no contempla sanitización de ${token}`);
  }
}

if (errors.length) {
  console.error('\nMiCursoX · Production Core Audit: FALLÓ\n');
  errors.forEach(e => console.error(`- ${e}`));
  process.exit(1);
}

console.log('MiCursoX · Production Core Audit: OK');
console.log(`Entry points validados: ${guardedEntrypoints.join(', ')}`);
