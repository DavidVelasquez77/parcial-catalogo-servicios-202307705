import { expect, test } from '@playwright/test';

test('portal Service Desk: ticket, CMDB, indicadores y conocimientos', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Usuario o correo').fill('admin.demo');
  await page.getByLabel('Contraseña').fill('Admin123!');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page.getByRole('heading', { name: 'Resumen del catálogo' })).toBeVisible();

  await page.getByRole('button', { name: 'CMDB', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'CMDB' })).toBeVisible();
  await expect(page.locator('table tbody tr').first()).toBeVisible();
  await page.locator('table tbody tr').first().click();
  const ci = page.getByRole('dialog', { name: 'Detalle de CI' });
  await expect(ci.getByRole('heading', { level: 2 }).first()).toBeVisible();
  await ci.getByRole('button', { name: 'Cerrar' }).click();

  await page.getByRole('button', { name: 'Tickets', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tickets' })).toBeVisible();
  await page.getByRole('button', { name: 'Nuevo ticket' }).click();
  const dialog = page.getByRole('dialog', { name: 'Nuevo ticket' });
  await dialog.getByLabel('Cola y proceso').selectOption({ label: 'Eventos · Eventos' });
  await dialog.getByLabel('Servicio existente').selectOption({ index: 1 });
  const title = `Evento web ${Date.now()}`;
  await dialog.getByLabel('Título').fill(title);
  await dialog.getByLabel('Descripción').fill('Registro de evento desde el portal.');
  await dialog.getByLabel('Categoría').selectOption('E0');
  await dialog.getByRole('button', { name: 'Crear ticket' }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByLabel('Buscar ticket').fill(title);
  await page.getByRole('button', { name: 'Buscar' }).click();
  await expect(page.getByText(title, { exact: true })).toBeVisible();
  await page.locator('table tbody tr').first().click();
  const ticket = page.getByRole('dialog', { name: 'Ficha de ticket' });
  await expect(ticket.getByText(title, { exact: true })).toBeVisible();
  await ticket.getByRole('button', { name: 'Cerrar', exact: true }).first().click();

  await page.getByRole('button', { name: 'Indicadores' }).click();
  await expect(page.getByRole('heading', { name: 'Tablero de atención' })).toBeVisible();
  await page.getByRole('button', { name: 'Conocimientos' }).click();
  await expect(page.getByRole('heading', { name: 'Base de conocimientos' })).toBeVisible();
});
