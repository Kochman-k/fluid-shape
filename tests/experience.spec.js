import { test, expect } from '@playwright/test';

test('renders WebGL and morphs from idle to ribbon and back', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' && /THREE|shader|WebGL/i.test(message.text())) errors.push(message.text());
  });
  await page.goto('/');
  const canvas = page.locator('canvas');
  await expect(canvas).toHaveAttribute('data-ready', 'true');
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
  await page.screenshot({ path: '/tmp/fluid-ribbon.png' });
  await page.evaluate(() => clearInterval(window.testMovement));
  await expect.poll(async () => Number(await canvas.getAttribute('data-morph'))).toBeLessThan(.1);
  expect(errors).toEqual([]);
});

test('material, sliders, pause, reset, information and export work', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('canvas')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('button', { name: 'Amber', exact: true }).click();
  await expect(page.locator('#material-label')).toHaveText('AMBER RESIN');
  await page.locator('#transparency').fill('30');
  await expect(page.locator('#transparency-value')).toHaveText('30%');
  await page.getByRole('button', { name: 'Wstrzymaj animację', exact: true }).click();
  const before = await page.locator('canvas').getAttribute('data-morph');
  await page.mouse.move(500, 500);
  await page.waitForTimeout(200);
  await expect(page.locator('canvas')).toHaveAttribute('data-morph', before);
  await page.getByRole('button', { name: 'Przywróć ustawienia', exact: true }).click();
  await expect(page.locator('#transparency-value')).toHaveText('38%');
  await expect(page.locator('#material-label')).toHaveText('EMBER RESIN');
  await page.getByRole('button', { name: 'O projekcie' }).click();
  await expect(page.locator('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('dialog')).not.toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Zapisz obraz rzeźby' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('fluid-ember.png');
});

test('mobile layout fits the screen and supports touch input', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('canvas')).toHaveAttribute('data-ready', 'true');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(page.locator('.controls')).toBeVisible();
  await page.locator('#canvas-container').dispatchEvent('pointermove', { clientX: 150, clientY: 330, pointerType: 'touch' });
  await expect.poll(async () => Number(await page.locator('canvas').getAttribute('data-morph'))).toBeGreaterThan(.1);
  await page.screenshot({ path: '/tmp/fluid-mobile.png' });
});
