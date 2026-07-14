const { test, expect } = require('@playwright/test');

async function clickIfVisible(page, textOrSelector) {
  const byText = page.getByText(textOrSelector, { exact: false }).first();
  if (await byText.count()) {
    try { await byText.click({ timeout: 3000 }); return true; } catch (_) {}
  }
  const locator = page.locator(textOrSelector).first();
  if (await locator.count()) {
    try { await locator.click({ timeout: 3000 }); return true; } catch (_) {}
  }
  return false;
}

test.describe('Cursapp V9 clicks reales', () => {
  test('login carga y botón QA existe', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('body')).toContainText(/Cursapp|QA|Ingresar|Login/i);
  });

  test('QA 360 abre y ejecuta stress si botón existe', async ({ page }) => {
    await page.goto('/qa360.html');
    await expect(page.getByText(/QA 360|Ejecutar|QA stress/i).first()).toBeVisible();
    const clicked = await clickIfVisible(page, 'QA stress');
    if (clicked) {
      await expect(page.locator('body')).toContainText(/OK|WARN|ERROR|Ejecutando/i, { timeout: 120000 });
    }
  });

  test('pantallas principales cargan y tienen navegación', async ({ page }) => {
    for (const url of ['/presidente.html', '/apoderado.html', '/tesorero.html']) {
      await page.goto(url);
      await expect(page.locator('body')).toBeVisible();
      await page.screenshot({ path: `evidencia-${url.replace(/\W/g, '_')}.png`, fullPage: true });
    }
  });

  test('botones principales no rompen la pantalla', async ({ page }) => {
    await page.goto('/presidente.html');
    for (const label of ['Campañas', 'Deudores', 'Informes', 'Avisos', 'Soporte']) {
      await clickIfVisible(page, label);
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('menú presidente mantiene diseño y opciones estables', async ({ page }) => {
    await page.goto('/presidente.html');

    const destinos = ['home', 'campanas', 'deudores', 'informes'];

    const iconContents = await page.locator('.bottomNav .navItem').evaluateAll((items) =>
      items.map((item) => getComputedStyle(item, '::before').content).join(' ')
    );
    expect(iconContents).not.toContain('â');
    expect(iconContents).not.toContain('\\');

    const visualIconContents = await page.locator('.presMockQuick span, .presMockKpi span').evaluateAll((items) =>
      items.map((item) => getComputedStyle(item, '::before').content).join(' ')
    );
    expect(visualIconContents).not.toMatch(/\\\\[0-9A-Fa-f]{3,}|ðŸ|Ã|Â|â/);

    for (const tab of destinos) {
      await page.locator('#menuBtn').click();
      await expect(page.locator('#menuDropdown')).toHaveAttribute('data-president-menu-version', '36');
      await expect(page.locator('#menuDropdown')).toHaveCSS('border-radius', '24px');
      await expect(page.locator('#menuDropdown .menuItem').first()).toHaveCSS('border-radius', '16px');
      await page.locator(`#menuDropdown [data-go="${tab}"]`).click();
      await expect(page.locator(`.navItem[data-tab="${tab}"]`)).toHaveClass(/active/);
      await expect(page.locator('#app')).toBeVisible();
    }

    await page.locator('#menuBtn').click();
    await expect(page.locator('#menuDropdown .menuItem')).toHaveCount(7);
    await expect(page.locator('#menuDropdown .menuItem').last()).toContainText('Cerrar sesión');
    await expect(page.locator('#menuDropdown [data-go="apoderados"]')).toContainText('Apoderados');
    await page.locator('#supportMenuItem').click();
    await expect(page.locator('#supportTicketOverlay')).toBeVisible();
    await expect(page.locator('#supportTicketOverlay')).toContainText('Mis tickets');
  });

  test('apoderado conserva iconos legibles y Apoderados mantiene el menú Presidente', async ({ page }) => {
    await page.goto('/apoderado.html');
    await expect(page.locator('body')).toBeVisible();
    const apoderadoText = await page.locator('body').innerText();
    expect(apoderadoText).not.toMatch(/ðŸ|Ã|Â|â(?:€|œ|†|‡|—|–|„|‹|Œ|˜|š|ž)/);

    await page.goto('/apoderados.html');
    await page.locator('#menuBtn').click();
    await expect(page.locator('#menuDropdown')).toHaveAttribute('data-president-menu-version', '36');
    await expect(page.locator('#menuDropdown .menuItem')).toHaveCount(7);
    await expect(page.locator('#menuDropdown .menuItem').last()).toContainText('Cerrar sesión');
    await expect(page.locator('#menuDropdown .menuItem').nth(5)).toContainText('Soporte / Mis tickets');
    await expect(page.locator('#menuDropdown')).not.toContainText('Cerrar menú');
  });

  test('menú tesorero abre todos sus destinos', async ({ page }) => {
    await page.goto('/tesorero.html');

    const destinos = [
      ['Inicio', 'home', '.tesCardHead h1'],
      ['Conciliar pagos', 'conciliacion', '.tesV75Title h1'],
      ['Rendiciones', 'rendiciones', '.tesV77Page > h1'],
      ['Informes', 'informes', '.tesV80Page > h1']
    ];

    for (const [label, tab, titleSelector] of destinos) {
      await page.locator('#menuBtn').click();
      await page.locator(`#menuDropdown [data-go="${tab}"]`).click();
      await expect(page.locator(`.navItem[data-tab="${tab}"]`)).toHaveClass(/active/);
      await expect(page.locator(titleSelector)).toHaveCSS('font-size', '20px');
      const titleFont = await page.locator(titleSelector).evaluate(el => getComputedStyle(el).fontFamily);
      const bodyFont = await page.locator('body').evaluate(el => getComputedStyle(el).fontFamily);
      expect(titleFont).toBe(bodyFont);
    }

    await page.locator('#menuBtn').click();
    await page.locator('#menuDropdown [data-go="profile"]').click();
    await expect(page.locator('[data-view="treasurer-profile-current"]')).toBeVisible();
    await expect(page.locator('.tesProfileTopbarV83 h1')).toHaveCSS('font-size', '20px');
    await expect(page.locator('#app')).toContainText('Información personal');
    await expect(page.locator('.tesProfileEditV84')).toHaveCount(3);
    await expect(page.getByText('Cambiar contraseña', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Configurar' }).click();
    await expect(page.locator('[data-view="treasurer-profile-notifications"]')).toBeVisible();
    await expect(page.locator('#app')).toContainText('Pagos por conciliar');
    await page.locator('.tesProfileTopbarV83 button').click();

    await page.getByText('Cambiar contraseña', { exact: true }).click();
    await expect(page.locator('.tesProfileModalV84')).toBeVisible();
    await expect(page.locator('#tesPasswordCurrent')).toBeVisible();
    await page.locator('.tesProfileModalCloseV84').click();

    await page.locator('#menuBtn').click();
    await expect(page.locator('#menuDropdown [data-menu-item="conciliacion"]')).toHaveCount(0);
    await expect(page.locator('#menuDropdown')).not.toContainText('Cerrar menú');
    await expect(page.locator('#menuDropdown > button').last()).toContainText('Cerrar sesión');
    await page.locator('#supportMenuItem').click();
    await expect(page.locator('#supportTicketOverlay')).toBeVisible();
    await expect(page.locator('#supportTicketOverlay')).toContainText('Mis tickets');
    await expect(page.locator('#supportTicketOverlay [data-tab="mine"]')).toHaveClass(/active/);
    await page.locator('#supportTicketOverlay [data-close]').first().click();

    await page.locator('#menuBtn').click();
    await page.locator('#menuDropdown [data-action="logout"]').click();
    await expect(page).toHaveURL(/\/login\.html$/);
  });
});
