import { expect, test, type Page } from '@playwright/test';
import { clearRateLimits, countBookings } from './helpers';

const COMPLIANT_CHECKS = [
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

async function pickDates(page: Page, start: string, end?: string) {
  await waitForCalendar(page);
  await pickDay(page, start);
  if (end) await pickDay(page, end);
}

async function fillDog(page: Page, overrides: Record<string, string> = {}) {
  const values: Record<string, string> = {
    dogName: 'Ares',
    breed: 'Cane Corso',
    birthDate: '2021-05-14',
    sex: 'M',
    microchip: '380260000111222',
    firstName: 'Giulia',
    lastName: 'Ferrari',
    email: 'giulia@example.com',
    phone: '+39 340 9988776',
    ...overrides,
  };

  for (const [name, value] of Object.entries(values)) {
    const field = page.locator(`[name="${name}"]`).first();
    if (name === 'sex') await field.selectOption(value);
    else await field.fill(value);
  }
}

async function tickCompliance(page: Page, extra: string[] = []) {
  for (const name of [...COMPLIANT_CHECKS, ...extra]) {
    await page.locator(`[name="${name}"]`).first().check();
  }
  await page.locator('[name="acceptedRules"]').check();
  await page.locator('[name="acceptedPrivacy"]').check();
}

test.beforeEach(async () => {
  await clearRateLimits();
});

test.describe('booking', () => {
  test('accepts a compliant request and shows it is not yet confirmed', async ({ page }) => {
    await page.goto('/prenota');
    await pickDates(page, futureDate(5), futureDate(8));

    await expect(page.locator('[name="startDate"]')).toHaveValue(futureDate(5));
    await expect(page.getByText('3 × 30,00 € / notte')).toBeVisible();

    await fillDog(page);
    await tickCompliance(page);
    await page.getByTestId('submit-booking').click();

    await expect(page.getByRole('heading', { name: 'Richiesta inviata' })).toBeVisible();
    await expect(page.getByText('Non è ancora una conferma')).toBeVisible();
    await expect(page.getByText(/KIN-[A-Z0-9]{6}/)).toBeVisible();
    await expect(page.getByText('90,00 €')).toBeVisible();
  });

  test('rejects a dog under one year with the rule stated', async ({ page }) => {
    await page.goto('/prenota');
    await pickDates(page, futureDate(10), futureDate(12));
    await fillDog(page, { birthDate: futureDate(-120), microchip: '380260000333444' });
    await tickCompliance(page);
    await page.getByTestId('submit-booking').click();

    await expect(page.getByRole('alert')).toContainText('un anno di età');
    await expect(page.getByRole('heading', { name: 'Richiesta inviata' })).toBeHidden();
  });

  test('keeps the selected dates after a rejected submission', async ({ page }) => {
    await page.goto('/prenota');
    await pickDates(page, futureDate(14), futureDate(16));
    await fillDog(page, { birthDate: futureDate(-200), microchip: '380260000555666' });
    await tickCompliance(page);
    await page.getByTestId('submit-booking').click();

    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.locator('[name="startDate"]')).toHaveValue(futureDate(14));
    await expect(page.locator('[name="endDate"]')).toHaveValue(futureDate(16));
  });

  test('rejects a boarding stay longer than fourteen nights', async ({ page }) => {
    await page.goto('/prenota');
    await pickDates(page, futureDate(18), futureDate(38));

    await expect(page.getByText(/non può superare 14 notti/)).toBeVisible();

    await fillDog(page, { microchip: '380260000777888' });
    await tickCompliance(page);
    await page.getByTestId('submit-booking').click();

    await expect(page.getByRole('alert')).toContainText('non può superare 14');
  });

  test('rejects a female declared in heat', async ({ page }) => {
    await page.goto('/prenota');
    await pickDates(page, futureDate(40), futureDate(42));
    await fillDog(page, { sex: 'F', microchip: '380260000999000' });
    await tickCompliance(page, ['inHeatOrNear']);
    await page.getByTestId('submit-booking').click();

    await expect(page.getByRole('alert')).toContainText('femmine in calore');
  });

  test('rejects a declared aggression history', async ({ page }) => {
    await page.goto('/prenota');
    await pickDates(page, futureDate(44), futureDate(46));
    await fillDog(page, { microchip: '380260001111222' });
    await tickCompliance(page, ['hasAggressionHistory']);
    await page.getByTestId('submit-booking').click();

    await expect(page.getByRole('alert')).toContainText('aggressività');
  });

  test('requires the regolamento and the privacy consent separately', async ({ page }) => {
    await page.goto('/prenota');
    await pickDates(page, futureDate(48), futureDate(50));
    await fillDog(page, { microchip: '380260001333444' });

    for (const name of COMPLIANT_CHECKS) await page.locator(`[name="${name}"]`).first().check();
    await page.locator('[name="acceptedRules"]').check();
    await page.getByTestId('submit-booking').click();

    await expect(page.getByRole('alert')).toContainText('trattamento dei dati personali');
  });

  test('rejects a request missing the mandatory documents', async ({ page }) => {
    await page.goto('/prenota');
    await pickDates(page, futureDate(52), futureDate(54));
    await fillDog(page, { microchip: '380260001555666' });
    await page.locator('[name="acceptedRules"]').check();
    await page.locator('[name="acceptedPrivacy"]').check();
    await page.getByTestId('submit-booking').click();

    const alert = page.getByRole('alert');
    await expect(alert).toContainText('microchip');
    await expect(alert).toContainText('polizza');
    await expect(alert).toContainText('Vaccinazioni');
  });
});

test('refuses a flood of submissions from the same client', async ({ page }) => {
  await clearRateLimits();
  const before = await countBookings();

  let blocked = false;
  for (let attempt = 0; attempt < 9 && !blocked; attempt += 1) {
    await page.goto('/prenota');
    await pickDates(page, futureDate(5 + attempt), futureDate(6 + attempt));
    await fillDog(page, { microchip: `38026000200${String(attempt).padStart(4, '0')}` });
    await tickCompliance(page);
    await page.getByTestId('submit-booking').click();
    blocked = await page.getByText('Troppe richieste in poco tempo').isVisible();
  }

  expect(blocked, 'the rate limiter should refuse a flood of submissions').toBe(true);
  expect(await countBookings()).toBeLessThan(before + 9);
});
