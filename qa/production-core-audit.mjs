import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const entrypoints = ['apoderado.html','presidente.html','tesorero.html','perfil.html'];
const requiredScript = '/assets/user-facing-copy-production-v1.js?v=1';
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
  if (!html.includes(requiredScript)) errors.push(`${rel}: falta ${requiredScript}`);
  for (const rule of forbiddenInEntrypoints) {
    if (rule.test(html)) errors.push(`${rel}: contiene patrón productivo prohibido ${rule}`);
  }
  if (/admin-console|admin-secure|admin\.js/i.test(html)) errors.push(`${rel}: referencia inesperada a recursos Admin`);
}

const copyFile = path.join(ROOT, 'assets/user-facing-copy-production-v1.js');
if (!fs.existsSync(copyFile)) errors.push('Falta user-facing-copy-production-v1.js');
else {
  const copy = fs.readFileSync(copyFile, 'utf8');
  if (!/DEMO_MODE\s*=\s*false/.test(copy)) errors.push('La capa productiva no fuerza DEMO_MODE=false');
  if (!/searchParams\.delete\(key\)/.test(copy)) errors.push('La capa productiva no elimina flags debug/demo de URL');
  for (const token of ['Supabase Auth','RLS/DELETE','UUID','localStorage','(demo)']) {
    if (!copy.includes(token)) errors.push(`La capa productiva no contempla sanitización de ${token}`);
  }
}

if (errors.length) {
  console.error('\nMiCursoX · Production Core Audit: FALLÓ\n');
  errors.forEach(e => console.error(`- ${e}`));
  process.exit(1);
}

console.log('MiCursoX · Production Core Audit: OK');
console.log(`Entry points validados: ${entrypoints.join(', ')}`);
