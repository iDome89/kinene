import { expect, test } from '@playwright/test';
import { primaryNav } from '@/lib/links';

const PAGES = ['/', '/prezzi', '/regolamento', '/contatti', '/prenota', '/recensioni'];

for (const path of PAGES) {
  test(`${path} does not scroll horizontally on mobile`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState('networkidle');

    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));

    expect(overflow.scrollWidth, `horizontal overflow on ${path}`).toBeLessThanOrEqual(
      overflow.clientWidth + 1,
    );
  });
}

test('wide tables scroll inside their own container, not the page', async ({ page }) => {
  await page.goto('/prezzi');
  const scroller = page.locator('.overflow-x-auto').first();
  await expect(scroller).toBeVisible();

  const canScrollInside = await scroller.evaluate((el) => el.scrollWidth > el.clientWidth);
  expect(canScrollInside).toBe(true);
});

test('the mobile menu opens and exposes every primary link', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Apri il menu').click();

  /* Letto dalla sorgente: una copia della lista si sfasa al primo cambio di menu. */
  const nav = page.locator('details[open] nav');
  for (const item of primaryNav) {
    await expect(nav.getByRole('link', { name: item.label })).toBeVisible();
  }
});

test('primary tap targets meet the 44px minimum', async ({ page }) => {
  await page.goto('/');

  const tooSmall = await page.evaluate(() => {
    const selectors = 'a[href], button, input[type="checkbox"], summary';
    return [...document.querySelectorAll<HTMLElement>(selectors)]
      .filter((el) => el.offsetParent !== null && !el.className.includes('sr-only'))
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.width > 0 && r.height > 0 && r.height < 44 && r.width < 44)
      .map(({ el, r }) => `${el.tagName}.${el.className.slice(0, 30)} ${Math.round(r.width)}x${Math.round(r.height)}`);
  });

  expect(tooSmall).toEqual([]);
});
