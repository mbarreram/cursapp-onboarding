const SESSION_KEY = 'cursapp_session_v1';
const app = document.getElementById('adminApp');
const title = document.getElementById('viewTitle');
const sub = document.getElementById('viewSub');

function setStatus(main, detail) {
  if (title) title.textContent = main;
  if (sub) sub.textContent = detail || '';
}

function showBlocked(titleText, message) {
  document.body.classList.add('adminBlocked');
  setStatus(titleText, message);
  if (app) app.innerHTML = `<section class="panel"><div class="panelHead"><h2>${titleText}</h2></div><p class="muted" style="font-weight:800">${message}</p><div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px"><button class="adminBtn" onclick="location.reload()">Reintentar</button><a class="adminBtn ghost" href="/index.html">Volver al inicio</a></div></section>`;
}

function withTimeout(promise, ms, message) {
  return Promise.race([
    Promise.resolve(promise),
    new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms))
  ]);
}

try { localStorage.removeItem(SESSION_KEY); } catch (_) {}

const sb = window.CURSAPP_SUPABASE;
if (!sb || typeof sb.getCurrentUser !== 'function' || typeof sb.request !== 'function') {
  showBlocked('Configuración incompleta', 'No se pudo inicializar Supabase Auth.');
  throw new Error('Supabase Auth no disponible');
}

setStatus('Validando acceso…', 'Comprobando sesión Supabase');
let user;
try {
  user = await withTimeout(sb.getCurrentUser(),10000,'La validación de la sesión tardó demasiado. Reintenta el acceso.');
} catch (error) {
  showBlocked('Sesión requerida', error?.message || 'Inicia sesión con una cuenta administrativa válida.');
  throw error;
}

setStatus('Validando acceso…', 'Comprobando rol administrativo');
let rows;
try {
  rows = await withTimeout(sb.request(`admin_users?select=user_id,role,active&user_id=eq.${encodeURIComponent(user.id)}&active=eq.true&limit=1`),10000,'La validación del rol administrativo tardó demasiado.');
} catch (error) {
  showBlocked('No se pudo validar el acceso', error?.message || 'Error al consultar el rol administrativo.');
  throw error;
}

const admin = Array.isArray(rows) ? rows[0] : null;
if (!admin) {
  showBlocked('Acceso denegado', 'Esta cuenta no tiene un rol administrativo activo en la base de datos.');
  throw new Error('Usuario sin rol administrativo');
}

try {
  localStorage.setItem(SESSION_KEY, JSON.stringify({role:'admin',isAdmin:true,userId:user.id,email:user.email||'',verifiedBy:'supabase-admin-users',verifiedAt:new Date().toISOString()}));
} catch (_) {}

window.CURSAPP_ADMIN_AUTH = Object.freeze({user:Object.freeze({id:user.id,email:user.email||''}),role:admin.role,active:true});

setStatus('Cargando Admin…', 'Inicializando consola administrativa');
try {
  await import('/admin-console/assets/admin.js?v=19');
  document.dispatchEvent(new Event('DOMContentLoaded'));
} catch (error) {
  console.error('[Admin] No se pudo iniciar el núcleo', error);
  showBlocked('Error al iniciar Admin', 'La sesión fue validada, pero no se pudo cargar la consola administrativa. Reintenta.');
  throw error;
}

try {
  await import('/assets/admin-withdrawals-nav-fix.mjs?v=6');
} catch (error) {
  console.error('[Admin] Navegación Retiros no cargada:', error);
}

try {
  await import('/assets/admin-finance.mjs?v=2');
} catch (error) {
  console.error('[Admin] Finanzas / Contabilidad no cargó:', error);
}

try {
  await import('/assets/admin-privacy-compliance.mjs?v=1');
  await import('/assets/admin-privacy-response-tools.mjs?v=2');
} catch (error) {
  console.error('[Admin] Privacidad y Cumplimiento no cargó:', error);
}

const optionalModules = [
  '/admin-console/assets/admin-addons.js?v=26',
  '/assets/admin-tickets-supabase.mjs?v=2',
  '/assets/admin-comms-supabase.mjs?v=4',
  '/assets/admin-banner-upload.mjs?v=1',
  '/assets/admin-banner-rotation.mjs?v=1',
  '/assets/admin-notifications-dashboard.mjs?v=1',
  '/assets/admin-territories.mjs?v=5',
  '/assets/admin-school-map-markers.mjs?v=1',
  '/assets/admin-territories-phase3.mjs?v=1',
  '/assets/admin-territories-phase4.mjs?v=1',
  '/assets/admin-territories-official-data.mjs?v=1',
  '/assets/admin-territories-phase5.mjs?v=1',
  '/assets/admin-territories-ux.mjs?v=2'
];

const results = await Promise.allSettled(optionalModules.map(src => import(src)));
results.forEach((result, index) => {
  if (result.status === 'rejected') console.error('[Admin] Módulo opcional no cargado:', optionalModules[index], result.reason);
});