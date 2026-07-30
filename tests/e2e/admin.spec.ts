import { expect, test, type Page } from '@playwright/test';
import { clearRateLimits } from './helpers';

const PASSWORD = 'e2e-password';

function futureDate(daysAhead: number): string {
  const noon = new Date();
  noon.setHours(12, 0, 0, 0);
  return new Date(noon.getTime() + daysAhead * 86_400_000).toISOString().slice(0, 10);
}

async function login(page: Page) {
  await page.goto('/admin/login');
  await page.locator('#password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Entra' }).click();
  await expect(page.getByRole('heading', { name: 'Richieste da evadere' })).toBeVisible();
}

const MONTHS_IT = ['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'];

function dayLabel(iso: string): RegExp {
  const [y, m, d] = iso.split('-').map(Number);
  return new RegExp(`^${d} ${MONTHS_IT[m! - 1]} ${y} \u2014`);
}

async function pickDay(page: Page, iso: string) {
  await page.getByRole('button', { name: dayLabel(iso) }).click();
}

async function waitForCalendar(page: Page) {
  await page.waitForFunction(() => document.querySelectorAll('button[data-day]').length > 20);
}

async function submitBooking(page: Page, start: string, end: string, microchip: string) {
  await page.goto('/prenota');
  await waitForCalendar(page);
  await pickDay(page, start);
  await pickDay(page, end);

  await page.locator('[name="dogName"]').fill('Bruno');
  await page.locator('[name="birthDate"]').fill('2020-01-10');
  await page.locator('[name="sex"]').selectOption('M');
  await page.locator('[name="microchip"]').fill(microchip);
  await page.locator('[name="firstName"]').fill('Marco');
  await page.locator('[name="lastName"]').fill('Rossi');
  await page.locator('[name="email"]').fill('marco@example.com');
  await page.locator('[name="phone"]').fill('+39 333 1112223');
  await page.locator('[name="emergencyFirstName0"]').fill('Anna');
  await page.locator('[name="emergencyLastName0"]').fill('Bianchi');
  await page.locator('[name="emergencyPhone0"]').fill('+39 333 4445556');
  await page.locator('[name="emergencyFirstName1"]').fill('Luca');
  await page.locator('[name="emergencyLastName1"]').fill('Verdi');
  await page.locator('[name="emergencyPhone1"]').fill('059 111222');

  for (const name of [
    'hasMicrochip','hasHealthRecord','hasInsurance','hasVaccinations',
    'hasParasiteTreatment','isHealthy','knowsBaseCommands','acceptedRules','acceptedPrivacy',
  ]) {
    await page.locator(`[name="${name}"]`).first().check();
  }

  await page.getByTestId('submit-booking').click();
  await expect(page.getByRole('heading', { name: 'Richiesta inviata' })).toBeVisible();

  return (await page.getByText(/KIN-[A-Z0-9]{6}/).textContent())!.trim();
}

test.beforeEach(async () => {
  await clearRateLimits();
});

test.describe('admin access control', () => {
  test('redirects anonymous visitors to the login page', async ({ page }) => {
    for (const path of ['/admin', '/admin/calendario', '/admin/chiusure']) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/admin\/login/);
    }
  });

  test('rejects a wrong password', async ({ page }) => {
    await page.goto('/admin/login');
    await page.locator('#password').fill('not-the-password');
    await page.getByRole('button', { name: 'Entra' }).click();
    await expect(page.getByRole('alert')).toContainText('Password non corretta');
  });

  test('rejects a forged session cookie', async ({ page, context }) => {
    await context.addCookies([
      { name: 'kinene_admin', value: `${Date.now() + 999999}.${'a'.repeat(64)}`, url: 'http://127.0.0.1:4331' },
    ]);
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test('logs in, then logs out back to the gate', async ({ page }) => {
    await login(page);
    await page.getByRole('button', { name: 'Esci' }).click();
    await expect(page).toHaveURL(/\/admin\/login/);
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test('returns to the originally requested page after login', async ({ page }) => {
    await page.goto('/admin/chiusure');
    await expect(page).toHaveURL(/next=%2Fadmin%2Fchiusure/);
    await page.locator('#password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Entra' }).click();
    await expect(page).toHaveURL(/\/admin\/chiusure/);
  });
});

test.describe('admin workflow', () => {
  test('confirming a request consumes capacity on the public calendar', async ({ page }) => {
    const start = futureDate(22);
    const end = futureDate(25);

    await page.goto('/');
    const baseline = await page.evaluate(async (from) => {
      const r = await fetch(`/api/availability.json?from=${from}&days=1`);
      return (await r.json()).days[0].left;
    }, start);

    const reference = await submitBooking(page, start, end, '380260002000111');

    const stillFree = await page.evaluate(async (from) => {
      const r = await fetch(`/api/availability.json?from=${from}&days=1`);
      return (await r.json()).days[0].left;
    }, start);
    expect(stillFree).toBe(baseline);

    await login(page);
    const card = page.locator('li').filter({ hasText: reference });
    await expect(card).toBeVisible();
    await expect(card).toContainText('Anna Bianchi');
    await expect(card).toContainText('Luca Verdi');

    await card.getByRole('button', { name: 'Conferma' }).click();
    await expect(page.getByRole('status')).toContainText(`${reference} confermata`);

    const afterConfirm = await page.evaluate(async (from) => {
      const r = await fetch(`/api/availability.json?from=${from}&days=1`);
      return (await r.json()).days[0].left;
    }, start);
    expect(afterConfirm).toBe(baseline - 1);
  });

  test('rejecting a request tells the owner why, and frees nothing it never took', async ({ page }) => {
    const start = futureDate(28);
    const end = futureDate(30);
    const reference = await submitBooking(page, start, end, '380260002000222');

    await login(page);
    const card = page.locator('li').filter({ hasText: reference });
    await card.locator('[name="staffNote"]').fill('Siamo al completo in quelle date');
    await card.getByRole('button', { name: 'Rifiuta' }).click();

    const status = page.getByRole('status');
    await expect(status).toContainText(`${reference} rifiutata`);
    /* No Resend key under test, and the panel must say so rather than imply the owner was told. */
    await expect(status).toContainText('NON inviata');
  });

  test('a blackout closes those days on the public calendar', async ({ page }) => {
    const from = futureDate(300);
    const to = futureDate(302);
    const after = futureDate(303);

    await login(page);
    await page.goto('/admin/chiusure');
    await page.locator('#fromDay').fill(from);
    await page.locator('#toDay').fill(to);
    await page.locator('#reason').fill('Ferie E2E');
    await page.getByRole('button', { name: 'Aggiungi chiusura' }).click();
    await expect(page.getByRole('status')).toContainText('registrata');

    const statuses = await page.evaluate(async (day) => {
      const r = await fetch(`/api/availability.json?from=${day}&days=4`);
      return (await r.json()).days.map((d: { d: string; s: number }) => [d.d, d.s]);
    }, from);

    expect(statuses[0]).toEqual([from, 2]);
    expect(statuses[2]).toEqual([to, 2]);
    expect(statuses[3]).toEqual([after, 0]);
  });

  test('a capacity override of zero closes a single day', async ({ page }) => {
    const day = futureDate(320);

    await login(page);
    await page.goto('/admin/chiusure');
    await page.locator('#day').fill(day);
    await page.locator('#maxDogs').fill('0');
    await page.getByRole('button', { name: 'Imposta capienza' }).click();
    await expect(page.getByRole('status')).toContainText('impostata a 0');

    const status = await page.evaluate(async (d) => {
      const r = await fetch(`/api/availability.json?from=${d}&days=1`);
      return (await r.json()).days[0].s;
    }, day);
    expect(status).toBe(2);
  });
});
