const { test, expect } = require('@playwright/test');

const USER_ID = '11111111-1111-4111-8111-111111111111';
const COURSE_ID = '22222222-2222-4222-8222-222222222222';
const MEMBER_ID = '33333333-3333-4333-8333-333333333333';

test.describe('Perfil Supabase-first', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(({ userId, memberId }) => {
      localStorage.setItem('cursapp_session_v1', JSON.stringify({
        userId,
        name: 'Nombre local obsoleto',
        phone: 'antiguo',
        currentRole: 'apoderado',
        role: 'apoderado',
        courseKey: 'curso-prueba'
      }));
      localStorage.setItem('cursapp_supabase_auth_session_v1', JSON.stringify({
        access_token: 'token-prueba',
        user: { id: userId }
      }));
      localStorage.setItem('cursapp_active_miembro_id_v1', memberId);
      localStorage.setItem('cursapp_profiles_v1', JSON.stringify([{ apoderado: { name: 'Nombre local obsoleto' } }]));
    }, { userId: USER_ID, memberId: MEMBER_ID });

    await page.route('**/rest/v1/usuarios**', async route => {
      if (route.request().method() === 'PATCH') {
        const body = route.request().postDataJSON();
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: USER_ID, email: null, nombre: body.nombre, telefono: body.telefono, estado: 'activo' }]) });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: USER_ID, email: null, nombre: 'Nombre oficial', telefono: 'telefono oficial', estado: 'activo' }]) });
    });
    await page.route('**/rest/v1/cursos**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: COURSE_ID, course_key: 'curso-prueba', nivel: '2°', letra: 'B', anio: 2026, jornada: 'Mañana', colegios: { nombre: 'Colegio Central' } }]) }));
    await page.route('**/rest/v1/miembros_curso**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: MEMBER_ID, curso_id: COURSE_ID, usuario_id: USER_ID, rol: 'apoderado', nombre_apoderado: 'Nombre oficial', nombre_alumno: 'Alumno seleccionado', estado: 'aprobado', created_at: '2026-01-10T12:00:00Z' }]) }));
    await page.route('**/rest/v1/preferencias_notificaciones**', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([route.request().postDataJSON()]) });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ usuario_id: USER_ID, pagos: true, cuotas: true, 'campañas': true, avisos: true, tickets: true, push: false, email: true, whatsapp: false }]) });
    });
  });

  test('ignora el nombre local antiguo y usa la identidad autenticada', async ({ page }) => {
    await page.goto('/perfil.html');
    await expect(page.locator('[data-profile-source="supabase"]')).toBeVisible();
    await expect(page.locator('#pfName')).toHaveValue('Nombre oficial');
    await expect(page.locator('#pfPhone')).toHaveValue('telefono oficial');
    await expect(page.locator('#pfAlumno')).toHaveValue('Alumno seleccionado');
    await expect(page.locator('#perfilContent')).not.toContainText('Nombre local obsoleto');
  });

  test('guarda datos y preferencias, y presenta cambio de contraseña seguro', async ({ page }) => {
    await page.goto('/perfil.html');
    await page.locator('#pfName').fill('Nombre oficial actualizado');
    const personalPatch = page.waitForRequest(req => req.url().includes('/rest/v1/usuarios') && req.method() === 'PATCH');
    await page.locator('#pfSave').click();
    expect((await personalPatch).postDataJSON()).toEqual({ nombre: 'Nombre oficial actualizado', telefono: 'telefono oficial' });
    await expect(page.locator('#pfPersonalMessage')).toContainText('Supabase');

    const prefsPost = page.waitForRequest(req => req.url().includes('/rest/v1/preferencias_notificaciones') && req.method() === 'POST');
    await page.locator('#pfPrefsSave').click();
    expect((await prefsPost).postDataJSON().usuario_id).toBe(USER_ID);
    await expect(page.locator('#pfPrefsMessage')).toContainText('Supabase');

    await page.locator('#pfPasswordOpen').click();
    await expect(page.locator('#pfCurrentPassword')).toHaveAttribute('type', 'password');
    await expect(page.locator('#pfNewPassword')).toHaveAttribute('type', 'password');
    await expect(page.locator('#pfConfirmPassword')).toHaveAttribute('type', 'password');
  });
});
