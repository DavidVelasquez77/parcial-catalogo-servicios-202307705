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

  await page.getByLabel('Categoría', { exact: true }).selectOption({ label: 'Hardware' });
  await page.getByLabel('Estado del CI').selectOption('ACTIVE');
  await page.getByLabel('Tipo de elemento').selectOption('true');
  await expect(page.locator('.pagination')).toContainText('CI');
  await page.getByLabel('Buscar CI').fill('CMDB-XLSX-5');
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  const originalCiRow = page.locator('table tbody tr').filter({ hasText: 'CMDB-XLSX-5' });
  await expect(originalCiRow).toBeVisible();
  await originalCiRow.click();
  const originalCi = page.getByRole('dialog', { name: 'Detalle de CI' });
  await expect(originalCi).toContainText('Servidor de Aplicaciones');
  await expect(originalCi).toContainText('Equipo de Infraestructura');
  await expect(originalCi).toContainText('Trazabilidad del Excel');
  const relatedTicket = originalCi.locator('section').filter({ hasText: 'Tickets relacionados' }).getByRole('button').first();
  await expect(relatedTicket).toBeVisible();
  await relatedTicket.click();
  await expect(page.getByRole('dialog', { name: 'Ficha de ticket' })).toBeVisible();
  await page.getByRole('dialog', { name: 'Ficha de ticket' }).getByRole('button', { name: 'Cerrar', exact: true }).first().click();

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
  await expect(page.getByText('Antigüedad abierta (min)')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Objetivos de atención' })).toBeVisible();
  await page.getByRole('button', { name: 'Conocimientos' }).click();
  await expect(page.getByRole('heading', { name: 'Base de conocimientos' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'FAQ-L0-01 · Registrar una solicitud' })).toBeVisible();
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
  await queuePanel.getByLabel('Responsable').selectOption({index:1});
  await queuePanel.getByLabel('Regla de orden').selectOption('AGE_PRIORITY');
  await queuePanel.getByRole('button', { name: 'Crear cola' }).click();
  const queueRow = page.locator('table tbody tr').filter({ hasText: code });
  await expect(queueRow).toBeVisible();
  await expect(queueRow).toContainText('Antigüedad y prioridad');
  await queueRow.getByRole('button', { name: 'Editar' }).click();
  const queueDialog = page.getByRole('dialog', { name: `Editar cola ${code}` });
  await queueDialog.getByLabel('Nombre').fill('Cola revisada');
  await queueDialog.getByLabel('Regla de orden').selectOption('PRIORITY_AGE');
  await queueDialog.getByLabel('Primera respuesta (min)').fill('45');
  await queueDialog.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(queueRow).toContainText('Cola revisada');
  await expect(queueRow).toContainText('Prioridad y antigüedad');
});
