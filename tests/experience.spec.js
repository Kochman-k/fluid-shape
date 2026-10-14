import { test, expect } from '@playwright/test';

test('renders the particle cloud and gathers the moving trail back into a sphere', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' && /THREE|shader|WebGL/i.test(message.text())) errors.push(message.text());
  });
  await page.goto('/');
  const canvas = page.locator('canvas');
  await expect(canvas).toHaveAttribute('data-ready', 'true');
  expect(Number(await canvas.getAttribute('data-particles'))).toBeGreaterThan(10000);
  await expect.poll(async () => Number(await canvas.getAttribute('data-morph'))).toBeLessThan(.1);
  await page.screenshot({ path: '/tmp/fluid-idle.png' });
  await page.evaluate(() => {
    let step = 0;
    window.testMovement = setInterval(() => {
      document.getElementById('canvas-container').dispatchEvent(new PointerEvent('pointermove', {
        clientX: 560 + Math.sin(step * .1) * 180,
        clientY: 430 + Math.cos(step * .1) * 80,
        bubbles: true,
      }));
      step++;
    }, 35);
  });
  await expect.poll(async () => Number(await canvas.getAttribute('data-morph'))).toBeGreaterThan(.8);
  await page.waitForTimeout(1100);
  await page.screenshot({ path: '/tmp/fluid-ribbon.png' });
  await page.evaluate(() => clearInterval(window.testMovement));
  await expect.poll(async () => Number(await canvas.getAttribute('data-morph'))).toBeLessThan(.1);
  expect(errors).toEqual([]);
});

test('material, sliders, pause, reset, information and export work', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('canvas')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('button', { name: 'Amber', exact: true }).click();
  await expect(page.locator('#material-label')).toHaveText('AMBER DUST');
  await page.locator('#dispersion').fill('30');
  await expect(page.locator('#dispersion-value')).toHaveText('30%');
  await page.getByRole('button', { name: 'Wstrzymaj animację', exact: true }).click();
  const before = await page.locator('canvas').getAttribute('data-morph');
  await page.mouse.move(500, 500);
  await page.waitForTimeout(200);
  await expect(page.locator('canvas')).toHaveAttribute('data-morph', before);
  await page.getByRole('button', { name: 'Przywróć ustawienia', exact: true }).click();
  await expect(page.locator('#dispersion-value')).toHaveText('58%');
  await expect(page.locator('#material-label')).toHaveText('ROSE DUST');
  await page.getByRole('button', { name: 'O projekcie' }).click();
  await expect(page.locator('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('dialog')).not.toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Zapisz obraz rzeźby' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('fluid-rose.png');
});

test('mobile layout fits the screen and supports touch input', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('canvas')).toHaveAttribute('data-ready', 'true');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(page.locator('#particles-panel .controls')).toBeVisible();
  await page.locator('#canvas-container').dispatchEvent('pointermove', { clientX: 150, clientY: 330, pointerType: 'touch' });
  await expect.poll(async () => Number(await page.locator('canvas').getAttribute('data-morph'))).toBeGreaterThan(.1);
  await page.screenshot({ path: '/tmp/fluid-mobile.png' });
});

test('owl is rendered in a separate tab, rotates, exports and preserves particle settings', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && /THREE|shader|WebGL/i.test(message.text())) errors.push(message.text()); });
  await page.goto('/');
  await page.getByRole('button', { name: 'Amber', exact: true }).click();
  await page.getByRole('tab', { name: 'Polygonowa sowa' }).click();
  const canvas = page.locator('#owl-canvas canvas');
  await expect(canvas).toHaveAttribute('data-ready', 'true');
  await expect(canvas).toHaveAttribute('data-azimuth', /.+/);
  await expect(page.locator('#particles-panel')).toBeHidden();
  const angle = Number(await canvas.getAttribute('data-azimuth'));
  const bounds = await canvas.boundingBox();
  await page.mouse.move(bounds.x + bounds.width * .5, bounds.y + bounds.height * .5);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * .67, bounds.y + bounds.height * .53, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => Math.abs(Number(await canvas.getAttribute('data-azimuth')) - angle)).toBeGreaterThan(.3);
  await page.locator('#owl-reset').click();
  await page.screenshot({ path: '/tmp/fluid-owl.png' });
  await page.getByRole('button', { name: 'Automatyczny obrót', exact: true }).click();
  await expect(page.locator('#owl-rotate')).toHaveAttribute('aria-pressed', 'true');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Zapisz obraz sowy' }).click();
  expect((await downloadPromise).suggestedFilename()).toBe('fluid-owl.png');
  await page.getByRole('tab', { name: 'Drobinki' }).click();
  await expect(page.locator('#material-label')).toHaveText('AMBER DUST');
  await expect(page.locator('#owl-panel')).toBeHidden();
  expect(errors).toEqual([]);
});

test('owl direct link supports touch rotation and fits a mobile screen', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await page.goto('/#owl');
  const canvas = page.locator('#owl-canvas canvas');
  await expect(canvas).toHaveAttribute('data-azimuth', /.+/);
  const angle = Number(await canvas.getAttribute('data-azimuth'));
  const client = await context.newCDPSession(page);
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 150, y: 420 }] });
  await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 245, y: 440 }] });
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect.poll(async () => Math.abs(Number(await canvas.getAttribute('data-azimuth')) - angle)).toBeGreaterThan(.3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '/tmp/fluid-owl-mobile.png' });
  await context.close();
});
