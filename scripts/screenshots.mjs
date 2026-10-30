// Capturas de la app (escritorio y móvil). Requiere `npm run preview` en marcha en el puerto 4173.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const URL = process.env.URL ?? 'http://localhost:4173/';
const OUT = 'docs/screenshots';
const TABS = ['Cap table', 'Control', 'Operaciones', 'Salida', 'Vesting', 'Precios'];
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
for (const [device, viewport] of [['escritorio', { width: 1440, height: 900 }], ['movil', { width: 390, height: 844 }]]) {
  const page = await browser.newPage({ locale: 'es-ES', viewport, deviceScaleFactor: device === 'movil' ? 2 : 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/${device}-inicio.png` });
  for (const tab of TABS) {
    await page.getByRole('tab', { name: tab }).click();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(700);
    const slug = tab.toLowerCase().replace(/\s+/g, '-');
    await page.screenshot({ path: `${OUT}/${device}-${slug}.png`, fullPage: true });
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  console.log(device, 'desbordamiento horizontal:', overflow, 'errores:', errors);
  await page.close();
}
await browser.close();
