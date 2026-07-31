import { expect, test } from '@playwright/test';

test.describe('foto allevamento', () => {
  test('shows a real photo, not the placeholder', async ({ page }) => {
    await page.goto('/');
    const section = page.locator('#allevamento').locator('xpath=ancestor::section[1]');

    await expect(section.locator('[data-placeholder="photo"]')).toHaveCount(0);
    const img = section.locator('figure img');
    await expect(img).toBeVisible();

    await img.evaluate((el: HTMLImageElement) =>
      el.complete ? null : new Promise((done) => { el.onload = done; el.onerror = done; }),
    );
    const natural = await img.evaluate((el: HTMLImageElement) => el.naturalWidth);
    expect(natural, 'the photo has to actually decode, not just exist in the DOM').toBeGreaterThan(0);
  });

  test('is described for people who cannot see it', async ({ page }) => {
    await page.goto('/');
    const img = page.locator('#allevamento').locator('xpath=ancestor::section[1]').locator('figure img');
    const alt = await img.getAttribute('alt');
    expect(alt).toMatch(/cane corso/i);
    expect(alt!.length).toBeGreaterThan(20);
  });

  test('reserves its space, so nothing jumps while it loads', async ({ page }) => {
    await page.goto('/');
    const img = page.locator('#allevamento').locator('xpath=ancestor::section[1]').locator('figure img');
    expect(Number(await img.getAttribute('width'))).toBeGreaterThan(0);
    expect(Number(await img.getAttribute('height'))).toBeGreaterThan(0);
  });

  test('ships responsive sources instead of one heavy original', async ({ page }) => {
    await page.goto('/');
    const img = page.locator('#allevamento').locator('xpath=ancestor::section[1]').locator('figure img');
    const srcset = (await img.getAttribute('srcset')) ?? '';
    expect(srcset.match(/\d+w/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
    expect(await img.getAttribute('sizes')).toBeTruthy();
  });

  test('serves a small file to a phone, not the 1440px one', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    const img = page.locator('#allevamento').locator('xpath=ancestor::section[1]').locator('figure img');
    await img.scrollIntoViewIfNeeded();
    await img.evaluate((el: HTMLImageElement) =>
      el.complete ? null : new Promise((done) => { el.onload = done; el.onerror = done; }),
    );
    const width = await img.evaluate((el: HTMLImageElement) => el.naturalWidth);
    expect(width).toBeLessThan(800);
  });
});
