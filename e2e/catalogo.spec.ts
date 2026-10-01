import { expect, test } from '@playwright/test';

test('login, consulta de servicios, filtro y cierre de sesión', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Usuario o correo').fill('admin.demo');
  await page.getByLabel('Contraseña').fill('Admin123!');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();

  await expect(page.getByRole('heading', { name: 'Resumen del catálogo' })).toBeVisible();
  await page.getByRole('button', { name: 'Servicios', exact: true }).click();
  await page.getByPlaceholder('Buscar por código o nombre').fill('SE.12');
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();

  await expect(page.getByText('SE.12.1', { exact: true })).toBeVisible();
  await expect(page.getByText('SE.12.2', { exact: true })).toBeVisible();
  await expect(page.getByText('SE.12.3', { exact: true })).toBeVisible();

  await page.getByTitle('Cerrar sesión').click();
  await expect(page.getByRole('heading', { name: 'Catálogo de Servicios TI' })).toBeVisible();
});
