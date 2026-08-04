import { expect, test, type Page } from '@playwright/test';
import { clearRateLimits } from './helpers';

const CHECKS = [
  'hasMicrochip',
  'hasHealthRecord',
  'hasInsurance',
  'hasVaccinations',
  'hasParasiteTreatment',
  'isHealthy',
  'knowsBaseCommands',
];

function futureDate(daysAhead: number): string {
  const noon = new Date();
  noon.setHours(12, 0, 0, 0);
  return new Date(noon.getTime() + daysAhead * 86_400_000).toISOString().slice(0, 10);
}

const MONTHS_IT = ['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'];
const dayLabel = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new RegExp(`^${d} ${MONTHS_IT[m! - 1]} ${y} —`);
};

async function pickDates(page: Page, start: string, end: string) {
  await page.waitForFunction(() => document.querySelectorAll('button[data-day]').length > 20);
  await page.getByRole('button', { name: dayLabel(start) }).click();
  await page.getByRole('button', { name: dayLabel(end) }).click();
}

async function fillDog(page: Page, slot: number, name: string, microchip: string) {
  await page.locator(`[name="dogName${slot}"]`).fill(name);
  await page.locator(`[name="birthDate${slot}"]`).fill('2020-03-04');
  await page.locator(`[name="sex${slot}"]`).selectOption('M');
  await page.locator(`[name="microchip${slot}"]`).fill(microchip);
  for (const check of CHECKS) await page.locator(`[name="${check}${slot}"]`).check();
}

async function fillOwner(page: Page, email: string) {
  await page.locator('[name="firstName"]').fill('Giulia');
  await page.locator('[name="lastName"]').fill('Ferrari');
  await page.locator('[name="email"]').fill(email);
  await page.locator('[name="phone"]').fill('+39 340 9988776');
  await page.locator('[name="emergencyFirstName0"]').fill('Anna');
  await page.locator('[name="emergencyLastName0"]').fill('Bianchi');
  await page.locator('[name="emergencyPhone0"]').fill('+39 333 1112223');
  await page.locator('[name="emergencyFirstName1"]').fill('Luca');
  await page.locator('[name="emergencyLastName1"]').fill('Verdi');
  await page.locator('[name="emergencyPhone1"]').fill('059 111222');
  await page.locator('[name="acceptedRules"]').check();
  await page.locator('[name="acceptedPrivacy"]').check();
}

const totalText = (page: Page) =>
  page.locator('dl').filter({ hasText: 'Totale stimato' }).locator('dd').last().innerText();

test.beforeEach(async () => {
  await clearRateLimits();
});

test.describe('due cani', () => {
  test('the second block is hidden until asked for, and comes back on demand', async ({ page }) => {
    await page.goto('/prenota');
    const blocks = page.locator('[data-dog-block]');
    await expect(blocks.first()).toBeVisible();
    await expect(blocks.nth(1)).toBeHidden();
    await expect(page.locator('[data-shared-space]')).toBeHidden();

    await page.getByRole('button', { name: /Aggiungi un cane/ }).click();
    await expect(blocks.nth(1)).toBeVisible();
    await expect(page.locator('[data-shared-space]')).toBeVisible();

    await page.getByRole('button', { name: /Togli questo cane/ }).click();
    await expect(blocks.nth(1)).toBeHidden();
    await expect(page.locator('[data-shared-space]')).toBeHidden();
  });

  test('halves the second dog only when the space is shared', async ({ page }) => {
    await page.goto('/prenota');
    await pickDates(page, futureDate(10), futureDate(12));

    const one = await totalText(page);
    await page.getByRole('button', { name: /Aggiungi un cane/ }).click();
    const apart = await totalText(page);
    await page.locator('[name="sharedSpace"]').check();
    const shared = await totalText(page);

    const cents = (text: string) => Number(text.replace(/[^\d,]/g, '').replace(',', '.')) * 100;
    expect(Math.round(cents(apart))).toBe(Math.round(cents(one) * 2));
    expect(Math.round(cents(shared))).toBe(Math.round(cents(one) * 1.5));
  });

  test('names the second dog in the quote so the discount is legible', async ({ page }) => {
    await page.goto('/prenota');
    await pickDates(page, futureDate(14), futureDate(16));
    await page.getByRole('button', { name: /Aggiungi un cane/ }).click();

    const summary = page.locator('dl').filter({ hasText: 'Totale stimato' });
    await expect(summary.getByText(/Secondo cane in spazio separato/)).toBeVisible();
    await page.locator('[name="sharedSpace"]').check();
    await expect(summary.getByText(/Secondo cane nello stesso spazio/)).toBeVisible();
  });

  test('stores both dogs against one booking', async ({ page }) => {
    await page.goto('/prenota');
    await pickDates(page, futureDate(18), futureDate(20));
    await page.getByRole('button', { name: /Aggiungi un cane/ }).click();
    await fillDog(page, 0, 'Ares', '380260005000001');
    await fillDog(page, 1, 'Nala', '380260005000002');
    await page.locator('[name="sharedSpace"]').check();
    await fillOwner(page, 'duecani@example.com');
    await page.getByTestId('submit-booking').click();

    await expect(page.getByRole('heading', { name: 'Richiesta inviata' })).toBeVisible();

    await page.goto('/admin/login');
    await page.locator('#password').fill('e2e-password');
    await page.getByRole('button', { name: 'Entra' }).click();

    const card = page.locator('li').filter({ hasText: 'Ares' }).filter({ hasText: 'Nala' }).first();
    await expect(card).toBeVisible();
    await expect(card).toContainText('Insieme, stesso spazio');
    await expect(card.getByRole('button', { name: /Test superato per Ares/ })).toBeVisible();
    await expect(card.getByRole('button', { name: /Test superato per Nala/ })).toBeVisible();
  });

  test('rejects the same microchip twice', async ({ page }) => {
    await page.goto('/prenota');
    await pickDates(page, futureDate(24), futureDate(26));
    await page.getByRole('button', { name: /Aggiungi un cane/ }).click();
    await fillDog(page, 0, 'Ares', '380260005000010');
    await fillDog(page, 1, 'Clone', '380260005000010');
    await fillOwner(page, 'clone@example.com');
    await page.getByTestId('submit-booking').click();

    await expect(page.getByRole('alert')).toContainText('stesso microchip');
  });

  test('judges the second dog on its own merits', async ({ page }) => {
    await page.goto('/prenota');
    await pickDates(page, futureDate(28), futureDate(30));
    await page.getByRole('button', { name: /Aggiungi un cane/ }).click();
    await fillDog(page, 0, 'Ares', '380260005000020');
    await fillDog(page, 1, 'Cucciolo', '380260005000021');
    await page.locator('[name="birthDate1"]').fill(futureDate(-120));
    await fillOwner(page, 'cucciolo@example.com');
    await page.getByTestId('submit-booking').click();

    await expect(page.getByRole('alert')).toContainText('un anno di età');
  });

  test('a two-dog booking takes two places off the calendar', async ({ page }) => {
    const start = futureDate(32);
    const before = await page.evaluate(async (from) => {
      const r = await fetch(`/api/availability.json?from=${from}&days=1`);
      return (await r.json()).days[0].left;
    }, start).catch(async () => {
      await page.goto('/prenota');
      return page.evaluate(async (from) => {
        const r = await fetch(`/api/availability.json?from=${from}&days=1`);
        return (await r.json()).days[0].left;
      }, start);
    });

    await page.goto('/prenota');
    await pickDates(page, start, futureDate(34));
    await page.getByRole('button', { name: /Aggiungi un cane/ }).click();
    await fillDog(page, 0, 'Rocky', '380260005000030');
    await fillDog(page, 1, 'Luna', '380260005000031');
    await fillOwner(page, 'capienza@example.com');
    await page.getByTestId('submit-booking').click();
    await expect(page.getByRole('heading', { name: 'Richiesta inviata' })).toBeVisible();

    await page.goto('/admin/login');
    await page.locator('#password').fill('e2e-password');
    await page.getByRole('button', { name: 'Entra' }).click();
    const card = page.locator('li').filter({ hasText: 'Rocky' }).first();
    await card.getByRole('button', { name: 'Conferma' }).click();
    await expect(page.getByRole('status')).toContainText('confermata');

    const after = await page.evaluate(async (from) => {
      const r = await fetch(`/api/availability.json?from=${from}&days=1`);
      return (await r.json()).days[0].left;
    }, start);

    expect(after).toBe(before - 2);
  });
});
