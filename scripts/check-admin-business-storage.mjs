import { readFileSync } from 'node:fs';

const protectedFiles = [
  'assets/admin-secure.mjs',
  'assets/admin-tickets-supabase.mjs',
  'assets/admin-comms-supabase.mjs'
];

const forbiddenBusinessKeys = [
  'cursapp_admin_tickets',
  'tickets',
  'ticket_responses',
  'global_alerts',
  'admin_banners',
  'notifications',
  'notification_preferences',
  'mercado_publicaciones'
];

const failures = [];
for (const file of protectedFiles) {
  const source = readFileSync(file, 'utf8');
  for (const key of forbiddenBusinessKeys) {
    const pattern = new RegExp(`localStorage\\.setItem\\s*\\(\\s*['\"\\x60][^'\"\\x60]*${key}`, 'i');
    if (pattern.test(source)) failures.push(`${file}: escritura de negocio detectada para ${key}`);
  }
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('OK: los módulos seguros del Admin no escriben datos de negocio en localStorage.');
