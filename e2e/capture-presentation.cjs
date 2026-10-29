const { chromium } = require('@playwright/test');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  try {
    await page.goto(process.env.BASE_URL || 'http://web');
    await page.getByLabel('Usuario o correo').fill(process.env.DEMO_ADMIN_USERNAME || 'admin.demo');
    await page.getByLabel('Contraseña').fill(process.env.DEMO_ADMIN_PASSWORD || 'Admin123!');
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await page.getByRole('button', { name: 'Tickets', exact: true }).click();
    await page.getByRole('heading', { name: 'Tickets', exact: true }).waitFor();
    await page.locator('section.panel tbody tr').first().waitFor();
    await page.screenshot({ path: '/screens/01-lista-tickets.png' });

    await page.getByRole('button', { name: 'Nuevo ticket' }).click();
    let dialog = page.getByRole('dialog', { name: 'Nuevo ticket' });
    await dialog.screenshot({ path: '/screens/02-nuevo-ticket.png' });
    await dialog.getByRole('button', { name: 'Cerrar', exact: true }).click();

    await page.locator('section.panel tbody tr').first().click();
    dialog = page.getByRole('dialog', { name: 'Ficha de ticket' });
    await dialog.getByText('Tipo de ticket').waitFor();
    await page.screenshot({ path: '/screens/03-ficha-ticket.png' });
    await dialog.getByRole('heading', { name: 'Bitácora' }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: '/screens/04-bitacora-ticket.png' });
    await dialog.getByRole('button', { name: 'Cerrar', exact: true }).first().click();

    await page.getByRole('button', { name: 'Colas', exact: true }).click();
    await page.getByRole('heading', { name: 'Colas de atención', exact: true }).waitFor();
    await page.screenshot({ path: '/screens/05-colas.png' });
    await page.getByRole('button', { name: 'Permisos', exact: true }).first().click();
    await page.getByRole('heading', { name: /^Permisos de / }).waitFor();
    await page.getByRole('heading', { name: /^Permisos de / }).scrollIntoViewIfNeeded();
    await page.locator('section.panel').filter({ has: page.getByRole('heading', { name: /^Permisos de / }) }).screenshot({ path: '/screens/06-permisos-cola.png' });
    console.log('Capturas de presentación creadas.');
  } finally {
    await browser.close();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
