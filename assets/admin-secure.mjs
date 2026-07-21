const SESSION_KEY = 'cursapp_session_v1';
const app = document.getElementById('adminApp');

function showBlocked(title, message) {
  document.body.classList.add('adminBlocked');
  if (app) {
    app.innerHTML = `<section class="panel"><div class="panelHead"><h2>${title}</h2></div><p class="muted" style="font-weight:800">${message}</p><a class="adminBtn" href="/index.html">Volver al inicio</a></section>`;
  }
}

try { localStorage.removeItem(SESSION_KEY); } catch (_) {}

const sb = window.CURSAPP_SUPABASE;
if (!sb || typeof sb.getCurrentUser !== 'function' || typeof sb.request !== 'function') {
  showBlocked('Configuración incompleta', 'No se pudo inicializar Supabase Auth.');
  throw new Error('Supabase Auth no disponible');
}

let user;
try {
  user = await sb.getCurrentUser();
} catch (error) {
  showBlocked('Sesión requerida', 'Inicia sesión con una cuenta administrativa válida.');
  throw error;
}

const rows = await sb.request(`admin_users?select=user_id,role,active&user_id=eq.${encodeURIComponent(user.id)}&active=eq.true&limit=1`);
const admin = Array.isArray(rows) ? rows[0] : null;
if (!admin) {
  showBlocked('Acceso denegado', 'Esta cuenta no tiene un rol administrativo activo en la base de datos.');
  throw new Error('Usuario sin rol administrativo');
}

try {
  localStorage.setItem(SESSION_KEY, JSON.stringify({
    role: 'admin',
    isAdmin: true,
    userId: user.id,
    email: user.email || '',
    verifiedBy: 'supabase-admin-users',
    verifiedAt: new Date().toISOString()
  }));
} catch (_) {}

window.CURSAPP_ADMIN_AUTH = Object.freeze({
  user: Object.freeze({ id: user.id, email: user.email || '' }),
  role: admin.role,
  active: true
});

await import('/assets/admin.js?v=18');
await import('/assets/admin-addons.js?v=26');
await import('/assets/admin-supabase-modules.mjs?v=1');
