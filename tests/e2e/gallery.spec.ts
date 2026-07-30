import { expect, test } from '@playwright/test';
import { clearRateLimits } from './helpers';

const PASSWORD = 'e2e-password';

/* A 1x1 red PNG — real bytes, so it survives magic-byte validation and sharp. */
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

test.beforeEach(async () => {
  await clearRateLimits();
});

async function login(page: import('@playwright/test').Page) {
  await page.goto('/admin/login');
  await page.locator('#password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Entra' }).click();
  await expect(page).toHaveURL(/\/admin(\/|$)/);
}

test.describe('gallery — public', () => {
  test('shows a courteous empty state rather than a broken grid', async ({ page }) => {
    await page.goto('/galleria');
    const hasImages = (await page.locator('main img[srcset]').count()) > 0;
    if (!hasImages) {
      await expect(page.getByRole('heading', { name: 'Le foto arrivano presto' })).toBeVisible();
    }
  });

  test('is linked from the primary navigation', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('navigation', { name: 'Navigazione principale' }).first()
      .getByRole('link', { name: 'Galleria' }).click();
    await expect(page).toHaveURL(/\/galleria/);
  });
});

test.describe('gallery — admin', () => {
  test('requires a session to reach the manager', async ({ page }) => {
    await page.goto('/admin/galleria');
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test('uploads a photo and publishes it with alt text and a srcset', async ({ page }) => {
    await login(page);
    await page.goto('/admin/galleria');

    await page.locator('#photos').setInputFiles({
      name: 'prato.png',
      mimeType: 'image/png',
      buffer: PNG_1PX,
    });
    await page.locator('#alt').fill('Cane Corso nel prato recintato');
    await page.locator('#caption').fill('Area verde');
    await page.getByRole('button', { name: 'Carica' }).click();

    await expect(page.getByRole('status')).toContainText('1 foto caricata');

    await page.goto('/galleria');
    const image = page.locator('main img[srcset]').first();
    await expect(image).toBeVisible();
    await expect(image).toHaveAttribute('alt', 'Cane Corso nel prato recintato');
    await expect(page.getByText('Area verde')).toBeVisible();

    const srcset = await image.getAttribute('srcset');
    expect(srcset).toMatch(/\/media\/[a-z0-9]{16}-400\.webp 400w/);

    const src = await image.getAttribute('src');
    const served = await page.request.get(src!);
    expect(served.status()).toBe(200);
    expect(served.headers()['content-type']).toBe('image/webp');
    expect(served.headers()['cache-control']).toContain('immutable');
  });

  test('refuses a script disguised as an image', async ({ page }) => {
    await login(page);
    await page.goto('/admin/galleria');

    await page.locator('#photos').setInputFiles({
      name: 'evil.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>'),
    });
    await page.locator('#alt').fill('payload');
    await page.getByRole('button', { name: 'Carica' }).click();

    await expect(page.getByRole('status')).toContainText('Formato non supportato');
  });

  test('refuses an upload without alt text', async ({ page }) => {
    await login(page);
    await page.goto('/admin/galleria');

    const alt = page.locator('#alt');
    await expect(alt).toHaveAttribute('required', '');
  });

  test('edits and then deletes a photo', async ({ page }) => {
    await login(page);
    await page.goto('/admin/galleria');

    await page.locator('#photos').setInputFiles({
      name: 'temp.png',
      mimeType: 'image/png',
      buffer: PNG_1PX,
    });
    await page.locator('#alt').fill('Foto temporanea da eliminare');
    await page.getByRole('button', { name: 'Carica' }).click();
    await expect(page.getByRole('status')).toContainText('foto caricat');

    /* The alt text lives in an input value, which hasText cannot see — match the thumbnail instead. */
    const card = page
      .locator('li')
      .filter({ has: page.getByAltText('Foto temporanea da eliminare') })
      .first();

    /* The editor is collapsed until its summary is clicked. */
    await card.getByText('Modifica').click();
    await card.locator('[name="caption"]').fill('Didascalia aggiornata');
    await card.getByRole('button', { name: 'Salva' }).click();
    await expect(page.getByRole('status')).toContainText('Foto aggiornata');

    const updated = page
      .locator('li')
      .filter({ has: page.getByAltText('Foto temporanea da eliminare') })
      .first();
    await updated.getByText('Modifica').click();
    await expect(updated.locator('[name="caption"]')).toHaveValue('Didascalia aggiornata');

    await updated.getByRole('button', { name: 'Elimina' }).click();
    await expect(page.getByRole('status')).toContainText('Foto eliminata');
    await expect(page.getByAltText('Foto temporanea da eliminare')).toHaveCount(0);
  });
});

test.describe('lightbox', () => {
  test('opens a photo, navigates, and restores focus on close', async ({ page }) => {
    await login(page);
    await page.goto('/admin/galleria');

    for (const name of ['prima', 'seconda']) {
      await page.locator('#photos').setInputFiles({
        name: `${name}.png`,
        mimeType: 'image/png',
        buffer: PNG_1PX,
      });
      await page.locator('#alt').fill(`Foto ${name} del lightbox`);
      await page.getByRole('button', { name: 'Carica' }).click();
      await expect(page.getByRole('status')).toContainText('foto caricat');
    }

    await page.goto('/galleria');

    const dialog = page.locator('#lightbox');
    await expect(dialog).toBeHidden();

    const trigger = page.locator('[data-lb-open]').first();
    await trigger.click();
    await expect(dialog).toBeVisible();

    const counter = dialog.locator('[data-lb-counter]');
    const initial = await counter.textContent();
    expect(initial).toMatch(/^1 di \d+$/);

    await page.keyboard.press('ArrowRight');
    await expect(counter).not.toHaveText(initial!);

    await page.keyboard.press('ArrowLeft');
    await expect(counter).toHaveText(initial!);

    /* Native <dialog> gives Esc-to-close and focus restore for free. */
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('every thumbnail is a labelled button, not a bare image', async ({ page }) => {
    await page.goto('/galleria');
    const triggers = page.locator('[data-lb-open]');
    const count = await triggers.count();
    expect(count).toBeGreaterThan(0);

    for (let index = 0; index < count; index += 1) {
      const label = await triggers.nth(index).getAttribute('aria-label');
      expect(label).toMatch(/^Ingrandisci: .+/);
    }
  });
});

test.describe('media route', () => {
  test('refuses traversal and off-pattern names', async ({ request }) => {
    for (const path of [
      '/media/..%2f..%2fetc%2fpasswd',
      '/media/aaaaaaaaaaaaaaaa-999.webp',
      '/media/aaaaaaaaaaaaaaaa-800.png',
      '/media/short-800.webp',
    ]) {
      expect((await request.get(path)).status(), path).toBe(404);
    }
  });
});
