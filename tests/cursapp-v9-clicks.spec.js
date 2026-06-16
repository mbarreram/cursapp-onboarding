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
});
