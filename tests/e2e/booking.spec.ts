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

/* I campi del cane sono numerati per slot; quelli del proprietario no. */
const DOG_FIELDS = new Set(['dogName', 'breed', 'birthDate', 'sex', 'microchip', 'insurancePolicy', 'vetName', 'vetPhone', 'foodNotes', 'allergies', 'medications', 'hasMicrochip', 'hasHealthRecord', 'hasInsurance', 'hasVaccinations', 'hasParasiteTreatment', 'isHealthy', 'knowsBaseCommands', 'inHeatOrNear', 'hasAggressionHistory']);
const fieldName = (name: string, slot: number) => (DOG_FIELDS.has(name) ? `${name}${slot}` : name);

async function fillDog(page: Page, overrides: Record<string, string> = {}, slot = 0) {
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
    const field = page.locator(`[name="${fieldName(name, slot)}"]`).first();
    if (name === 'sex') await field.selectOption(value);
    else await field.fill(value);
  }
}

async function fillEmergencyContacts(page: Page) {
  await page.locator('[name="emergencyFirstName0"]').fill('Anna');
  await page.locator('[name="emergencyLastName0"]').fill('Bianchi');
  await page.locator('[name="emergencyPhone0"]').fill('+39 333 1112223');
  await page.locator('[name="emergencyFirstName1"]').fill('Luca');
  await page.locator('[name="emergencyLastName1"]').fill('Verdi');
  await page.locator('[name="emergencyPhone1"]').fill('059 111222');
}

async function tickCompliance(page: Page, extra: string[] = []) {
  for (const name of [...COMPLIANT_CHECKS.map((n) => `${n}0`), ...extra]) {
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
    await pickDates(page, futureDate(3), futureDate(6));

    await expect(page.locator('[name="startDate"]')).toHaveValue(futureDate(3));
    const summary = page.locator('dl').filter({ hasText: 'Totale stimato' });
    await expect(summary.getByText('Pensione — 3 notti')).toBeVisible();
    await expect(summary.locator('dd').last()).toHaveText('90,00 €');

    await fillDog(page);
    await fillEmergencyContacts(page);
    await tickCompliance(page);
    await page.getByTestId('submit-booking').click();

    await expect(page.getByRole('heading', { name: 'Richiesta inviata' })).toBeVisible();
    await expect(page.getByText('Non è ancora una conferma')).toBeVisible();
    await expect(page.getByText(/KIN-[A-Z0-9]{6}/)).toBeVisible();
    await expect(page.getByText('90,00 €')).toBeVisible();
  });

  test('rejects a dog under one year with the rule stated', async ({ page }) => {
    await page.goto('/prenota');
    await pickDates(page, futureDate(8), futureDate(10));
    await fillDog(page, { birthDate: futureDate(-120), microchip: '380260000333444' });
    await fillEmergencyContacts(page);
    await tickCompliance(page);
    await page.getByTestId('submit-booking').click();

    await expect(page.getByRole('alert')).toContainText('un anno di età');
    await expect(page.getByRole('heading', { name: 'Richiesta inviata' })).toBeHidden();
  });

  test('keeps the selected dates after a rejected submission', async ({ page }) => {
    await page.goto('/prenota');
    await pickDates(page, futureDate(12), futureDate(14));
    await fillDog(page, { birthDate: futureDate(-200), microchip: '380260000555666' });
    await fillEmergencyContacts(page);
    await tickCompliance(page);
    await page.getByTestId('submit-booking').click();

    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.locator('[name="startDate"]')).toHaveValue(futureDate(12));
    await expect(page.locator('[name="endDate"]')).toHaveValue(futureDate(14));
  });

  test('rejects day care spanning more than one day', async ({ page }) => {
    await page.goto('/prenota');
    await page.waitForFunction(() => document.querySelectorAll('button[data-day]').length > 20);
    await page.getByRole('radio', { name: 'Asilo diurno' }).check({ force: true });
    await pickDay(page, futureDate(16));
    await pickDay(page, futureDate(18));

    await expect(page.getByText(/la durata massima è di 1 giorno/)).toBeVisible();
  });

  test('rejects a boarding stay longer than fourteen nights', async ({ page }) => {
    await page.goto('/prenota');
    await pickDates(page, futureDate(4), futureDate(20));

    await expect(page.getByText(/la durata massima è di 14 notti/)).toBeVisible();

    await fillDog(page, { microchip: '380260000777888' });
    await fillEmergencyContacts(page);
    await tickCompliance(page);
    await page.getByTestId('submit-booking').click();

    await expect(page.getByRole('alert')).toContainText('durata massima è di 14 notti');
  });

  test('rejects a female declared in heat', async ({ page }) => {
    await page.goto('/prenota');
    await pickDates(page, futureDate(22), futureDate(24));
    await fillDog(page, { sex: 'F', microchip: '380260000999000' });
    await fillEmergencyContacts(page);
    await tickCompliance(page, ['inHeatOrNear0']);
    await page.getByTestId('submit-booking').click();

    await expect(page.getByRole('alert')).toContainText('femmine in calore');
  });

  test('rejects a declared aggression history', async ({ page }) => {
    await page.goto('/prenota');
    await pickDates(page, futureDate(2), futureDate(4));
    await fillDog(page, { microchip: '380260001111222' });
    await fillEmergencyContacts(page);
    await tickCompliance(page, ['hasAggressionHistory0']);
    await page.getByTestId('submit-booking').click();

    await expect(page.getByRole('alert')).toContainText('aggressività');
  });

  test('requires the regolamento and the privacy consent separately', async ({ page }) => {
    await page.goto('/prenota');
    await pickDates(page, futureDate(6), futureDate(8));
    await fillDog(page, { microchip: '380260001333444' });
    await fillEmergencyContacts(page);

    for (const name of COMPLIANT_CHECKS) await page.locator(`[name="${name}0"]`).first().check();
    await page.locator('[name="acceptedRules"]').check();
    await page.getByTestId('submit-booking').click();

    await expect(page.getByRole('alert')).toContainText('trattamento dei dati personali');
  });

  test('rejects a request with fewer than two emergency contacts', async ({ page }) => {
    await page.goto('/prenota');
    await pickDates(page, futureDate(22), futureDate(24));
    await fillDog(page, { microchip: '380260001777888' });
    await page.locator('[name="emergencyFirstName0"]').fill('Anna');
    await page.locator('[name="emergencyLastName0"]').fill('Bianchi');
    await page.locator('[name="emergencyPhone0"]').fill('+39 333 1112223');
    await tickCompliance(page);
    await page.getByTestId('submit-booking').click();

    await expect(page.getByRole('alert')).toContainText('almeno 2 contatti di emergenza');
  });

  test('rejects an emergency contact missing a phone number', async ({ page }) => {
    await page.goto('/prenota');
    await pickDates(page, futureDate(26), futureDate(28));
    await fillDog(page, { microchip: '380260001999000' });
    await fillEmergencyContacts(page);
    await page.locator('[name="emergencyPhone1"]').fill('');
    await tickCompliance(page);
    await page.getByTestId('submit-booking').click();

    await expect(page.getByRole('alert')).toContainText('almeno 2 contatti di emergenza');
  });

  test('rejects a request missing the mandatory documents', async ({ page }) => {
    await page.goto('/prenota');
    await pickDates(page, futureDate(18), futureDate(20));
    await fillDog(page, { microchip: '380260001555666' });
    await fillEmergencyContacts(page);
    await page.locator('[name="acceptedRules"]').check();
    await page.locator('[name="acceptedPrivacy"]').check();
    await page.getByTestId('submit-booking').click();

    const alert = page.getByRole('alert');
    await expect(alert).toContainText('microchip');
    await expect(alert).toContainText('polizza');
    await expect(alert).toContainText('Vaccinazioni');
  });
});

test('refuses a flood of submissions from the same client', async ({ request, page }) => {
  await clearRateLimits();
  const before = await countBookings();

  const body = (attempt: number) => ({
    service: 'pensione',
    startDate: futureDate(3 + attempt),
    endDate: futureDate(4 + attempt),
    dogName0: 'Ares',
    birthDate0: '2021-05-14',
    sex0: 'M',
    microchip0: `38026000300${String(attempt).padStart(4, '0')}`,
    firstName: 'Giulia',
    lastName: 'Ferrari',
    email: 'giulia@example.com',
    phone: '+39 340 9988776',
    emergencyFirstName0: 'Anna',
    emergencyLastName0: 'Bianchi',
    emergencyPhone0: '+39 333 1112223',
    emergencyFirstName1: 'Luca',
    emergencyLastName1: 'Verdi',
    emergencyPhone1: '059 111222',
    hasMicrochip0: 'on',
    hasHealthRecord0: 'on',
    hasInsurance0: 'on',
    hasVaccinations0: 'on',
    hasParasiteTreatment0: 'on',
    isHealthy0: 'on',
    knowsBaseCommands0: 'on',
    acceptedRules: 'on',
    acceptedPrivacy: 'on',
  });

  let blockedAt = -1;
  for (let attempt = 0; attempt < 9 && blockedAt < 0; attempt += 1) {
    const response = await request.post('/prenota', {
      form: body(attempt),
      headers: { origin: 'http://127.0.0.1:4331' },
    });
    expect(response.status()).toBe(200);
    if ((await response.text()).includes('Troppe richieste in poco tempo')) blockedAt = attempt;
  }

  expect(blockedAt, 'the rate limiter should refuse a flood of submissions').toBeGreaterThan(0);
  expect(await countBookings(), 'blocked submissions must not reach the database').toBe(before + blockedAt);

  await page.goto('/prenota');
  await expect(page.getByText('Troppe richieste in poco tempo')).toBeHidden();
});
