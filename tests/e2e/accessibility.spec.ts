import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const PUBLIC_PAGES = [
  '/',
  '/servizi/asilo-diurno',
  '/servizi/asilo-notturno',
  '/servizi/pensione',
  '/prezzi',
  '/regolamento',
  '/chi-siamo',
  '/galleria',
  '/recensioni',
  '/test-di-ingresso',
  '/contatti',
  '/privacy',
  '/cookie',
  '/prenota',
];

for (const path of PUBLIC_PAGES) {
  test(`${path} has no WCAG A/AA violations`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState('networkidle');

    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(
      violations.map((v) => `${v.id} (${v.nodes.length}): ${v.help}`),
      `axe violations on ${path}`,
    ).toEqual([]);
  });
}

test('every page has exactly one h1', async ({ page }) => {
  for (const path of PUBLIC_PAGES) {
    await page.goto(path);
    expect(await page.locator('h1').count(), `h1 count on ${path}`).toBe(1);
  }
});

test('the skip link is the first focusable element and reaches main', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');

  const focused = page.locator(':focus');
  await expect(focused).toHaveText(/Vai al contenuto principale/);
  await expect(focused).toHaveAttribute('href', '#main');
});

test('the booking calendar is operable with the keyboard alone', async ({ page }) => {
  await page.goto('/prenota');
  await page.waitForFunction(() => document.querySelectorAll('button[data-day]').length > 20);

  const firstFree = page.locator('button[data-day]:not([disabled])').first();
  await firstFree.focus();
  await expect(firstFree).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(page.locator('[name="startDate"]')).not.toHaveValue('');
  await expect(page.locator('[aria-live="polite"]')).toContainText('Selezionato');
});

/*
  Seeded rather than assumed: on the first of the month the calendar opens with
  no past days, and a test that waits for one to exist just fails at midnight.
*/
test('disabled calendar days announce why they cannot be chosen', async ({ page }) => {
  const closed = new Date();
  closed.setDate(closed.getDate() + 20);
  const closedDay = closed.toISOString().slice(0, 10);

  await page.goto('/admin/login');
  await page.locator('#password').fill('e2e-password');
  await page.getByRole('button', { name: 'Entra' }).click();
  await page.goto('/admin/chiusure');
  await page.locator('#fromDay').fill(closedDay);
  await page.locator('#toDay').fill(closedDay);
  await page.locator('#reason').fill('Chiusura per test a11y');
  await page.getByRole('button', { name: 'Aggiungi chiusura' }).click();
  await expect(page.getByRole('status')).toContainText('registrata');

  await page.goto('/prenota');
  await page.waitForFunction(() => document.querySelectorAll('button[data-day]').length > 20);

  const seeded = page.locator(`button[data-day="${closedDay}"]`);
  await expect(seeded).toBeDisabled();
  await expect(seeded).toHaveAttribute('aria-label', /chiuso/);

  const labels = await page.locator('button[data-day][disabled]').evaluateAll((nodes) =>
    nodes.map((n) => n.getAttribute('aria-label') ?? ''),
  );

  expect(labels.length).toBeGreaterThan(0);
  for (const label of labels) {
    expect(label).toMatch(/data passata|al completo|chiuso/);
  }

  /* Hand the date back: a closure left behind would block every other booking test. */
  await page.goto('/admin/chiusure');
  const row = page.locator('li, tr').filter({ hasText: 'Chiusura per test a11y' }).last();
  await row.getByRole('button', { name: 'Rimuovi' }).click();
  await expect(page.getByRole('status')).toBeVisible();
  await page.goto('/prenota');
  await page.waitForFunction(() => document.querySelectorAll('button[data-day]').length > 20);
  await expect(page.locator(`button[data-day="${closedDay}"]`)).toBeEnabled();
});

test('the admin login page is accessible', async ({ page }) => {
  await page.goto('/admin/login');
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(violations.map((v) => v.id)).toEqual([]);
});
