import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const entrypoints = ['apoderado.html','presidente.html','tesorero.html','perfil.html'];
const requiredScripts = [
  '/assets/production-core-guard-v1.js?v=1',
  '/assets/user-facing-copy-production-v1.js?v=1'
];
const forbiddenInEntrypoints = [
  /\bdebug=1\b/i,
  /\bDEMO_MODE\s*=\s*true\b/i,
  /Datos guardados en Supabase/i,
  /Cargando perfil desde Supabase/i,
  /Supabase Auth/i,
  /\(demo\)/i
];

const errors = [];
for (const rel of entrypoints) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) {
    errors.push(`${rel}: archivo no encontrado`);
    continue;
  }
  const html = fs.readFileSync(file, 'utf8');
  for (const script of requiredScripts) {
    if (!html.includes(script)) errors.push(`${rel}: falta ${script}`);
  }
  for (const rule of forbiddenInEntrypoints) {
    if (rule.test(html)) errors.push(`${rel}: contiene patrón productivo prohibido ${rule}`);
  }
  if (/admin-console|admin-secure|admin\.js/i.test(html)) {
    errors.push(`${rel}: referencia inesperada a recursos Admin`);
  }
}

const guardFile = path.join(ROOT, 'assets/production-core-guard-v1.js');
if (!fs.existsSync(guardFile)) errors.push('Falta production-core-guard-v1.js');
else {
  const guard = fs.readFileSync(guardFile, 'utf8');
  if (!/DEMO_MODE\s*=\s*false/.test(guard)) errors.push('El guard no fuerza DEMO_MODE=false');
  if (!/searchParams\.delete\(key\)/.test(guard)) errors.push('El guard no elimina flags de debug/demo de URL');
}

if (errors.length) {
  console.error('\nMiCursoX · Production Core Audit: FALLÓ\n');
  errors.forEach(e => console.error(`- ${e}`));
  process.exit(1);
}

console.log('MiCursoX · Production Core Audit: OK');
console.log(`Entry points validados: ${entrypoints.join(', ')}`);
