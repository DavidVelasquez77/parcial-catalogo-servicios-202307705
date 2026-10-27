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
  await page.getByLabel('Filtrar prioridad').selectOption('3');
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

test('mantenimiento visual de categoría, ubicación y cola', async ({ page }) => {
  const code = `UI-${Date.now()}`;
  await page.goto('/');
  await page.getByLabel('Usuario o correo').fill('admin.demo');
  await page.getByLabel('Contraseña').fill('Admin123!');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();

  await page.getByRole('button', { name: 'CMDB', exact: true }).click();
  const categoryPanel = page.locator('section.panel').filter({ has: page.getByRole('heading', { name: 'Jerarquía de clasificación' }) });
  await categoryPanel.getByLabel('Código').fill(code);
  await categoryPanel.getByLabel('Nombre').fill('Categoría de interfaz');
  await categoryPanel.getByRole('button', { name: 'Agregar categoría' }).click();
  const categoryCard = categoryPanel.locator('.desk-note').filter({ hasText: code });
  await expect(categoryCard).toBeVisible();
  await categoryCard.getByRole('button', { name: 'Editar categoría' }).click();
  const categoryDialog = page.getByRole('dialog', { name: `Editar categoría ${code}` });
  await categoryDialog.getByLabel('Nombre').fill('Categoría revisada');
  await categoryDialog.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(categoryCard).toContainText('Categoría revisada');

  const locationPanel = page.locator('section.panel').filter({ has: page.getByRole('heading', { name: 'Ubicaciones controladas' }) });
  await locationPanel.getByLabel('Código').fill(code);
  await locationPanel.getByLabel('Nombre').fill('Ubicación de interfaz');
  await locationPanel.getByRole('button', { name: 'Agregar ubicación' }).click();
  const locationCard = locationPanel.locator('.desk-note').filter({ hasText: code });
  await expect(locationCard).toBeVisible();
  await locationCard.getByRole('button', { name: 'Editar ubicación' }).click();
  const locationDialog = page.getByRole('dialog', { name: `Editar ubicación ${code}` });
  await locationDialog.getByLabel('Nombre').fill('Ubicación revisada');
  await locationDialog.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(locationCard).toContainText('Ubicación revisada');

  await page.getByRole('button', { name: 'Colas', exact: true }).click();
  const queuePanel = page.locator('section.panel').filter({ has: page.getByRole('heading', { name: 'Crear cola' }) });
  await queuePanel.getByLabel('Código').fill(code);
  await queuePanel.getByLabel('Nombre').fill('Cola de interfaz');
  await queuePanel.getByRole('button', { name: 'Crear cola' }).click();
  const queueRow = page.locator('table tbody tr').filter({ hasText: code });
  await expect(queueRow).toBeVisible();
  await queueRow.getByRole('button', { name: 'Editar' }).click();
  const queueDialog = page.getByRole('dialog', { name: `Editar cola ${code}` });
  await queueDialog.getByLabel('Nombre').fill('Cola revisada');
  await queueDialog.getByLabel('Primera respuesta (min)').fill('45');
  await queueDialog.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(queueRow).toContainText('Cola revisada');
});
