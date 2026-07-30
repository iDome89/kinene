import { expect, test, type Page } from '@playwright/test';
import { clearRateLimits } from './helpers';

const PASSWORD = 'e2e-password';

test.beforeEach(async () => {
  await clearRateLimits();
});

async function login(page: Page) {
  await page.goto('/admin/login');
  await page.locator('#password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Entra' }).click();
  await expect(page).toHaveURL(/\/admin(\/|$)/);
}

async function submitReview(page: Page, overrides: Record<string, string> = {}) {
  const values = {
    firstName: 'Marco',
    lastName: 'Rossi',
    email: 'marco@example.com',
    dogName: 'Ares',
    body: 'Struttura pulita e personale competente, il cane è tornato sereno e stanco al punto giusto.',
    ...overrides,
  };

  await page.goto('/recensioni');
  await page.getByRole('radio', { name: '5 ★' }).check({ force: true });
  for (const [name, value] of Object.entries(values)) {
    await page.locator(`[name="${name}"]`).fill(value);
  }
  await page.locator('[name="acceptedPrivacy"]').check();
  await page.getByTestId('submit-review').click();
}

test.describe('review submission', () => {
  test('accepts a review and says it awaits moderation', async ({ page }) => {
    await submitReview(page);
    const success = page.locator('div').filter({ has: page.getByRole('heading', { name: 'Grazie' }) }).last();
    await expect(success).toBeVisible();
    await expect(success).toContainText('dopo una verifica');
  });

  test('does not publish it immediately', async ({ page }) => {
    const body = 'Questa recensione non deve comparire prima della moderazione, mai e poi mai.';
    await submitReview(page, { body, email: 'pending@example.com' });
    await expect(page.getByRole('heading', { name: 'Grazie' })).toBeVisible();

    await page.goto('/recensioni');
    await expect(page.getByText(body)).toHaveCount(0);
  });

  test('rejects a review that is too short', async ({ page }) => {
    await submitReview(page, { body: 'Bravi', email: 'short@example.com' });
    await expect(page.getByRole('alert')).toContainText('almeno 20 caratteri');
  });

  test('rejects an invalid email', async ({ page }) => {
    await submitReview(page, { email: 'not-an-email' });
    await expect(page.getByRole('alert')).toContainText('email valido');
  });

  test('requires a name and a surname', async ({ page }) => {
    await submitReview(page, { firstName: '', lastName: '', email: 'noname@example.com' });
    const alert = page.getByRole('alert');
    await expect(alert).toContainText('nome');
    await expect(alert).toContainText('cognome');
  });

  test('requires consent before publishing personal data', async ({ page }) => {
    await page.goto('/recensioni');
    await page.getByRole('radio', { name: '4 ★' }).check({ force: true });
    await page.locator('[name="firstName"]').fill('Anna');
    await page.locator('[name="lastName"]').fill('Bianchi');
    await page.locator('[name="email"]').fill('anna@example.com');
    await page.locator('[name="body"]').fill('Testo abbastanza lungo da superare il minimo richiesto.');
    await page.getByTestId('submit-review').click();

    await expect(page.getByRole('alert')).toContainText('pubblicazione');
  });

  test('keeps what was typed when the submission is rejected', async ({ page }) => {
    await submitReview(page, { email: 'broken', body: 'Un testo abbastanza lungo da essere valido davvero.' });
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.locator('[name="firstName"]')).toHaveValue('Marco');
    await expect(page.locator('[name="body"]')).toHaveValue(/Un testo abbastanza lungo/);
  });

  test('swallows a bot that fills the honeypot, without storing anything', async ({ page }) => {
    await page.goto('/recensioni');
    const trap = 'Recensione inviata da un bot che riempie ogni campo del modulo.';

    await page.evaluate((body) => {
      const form = document.querySelector('form[method="POST"]') as HTMLFormElement;
      const set = (name: string, value: string) => {
        const field = form.querySelector(`[name="${name}"]`) as HTMLInputElement;
        if (field.type === 'checkbox' || field.type === 'radio') field.checked = true;
        else field.value = value;
      };
      (form.querySelector('[name="rating"][value="5"]') as HTMLInputElement).checked = true;
      set('firstName', 'Bot');
      set('lastName', 'Spam');
      set('email', 'bot@spam.io');
      set('body', body);
      set('website', 'https://spam.example');
      set('acceptedPrivacy', 'on');
      form.submit();
    }, trap);

    await expect(page.getByRole('heading', { name: 'Grazie' })).toBeVisible();
    await page.goto('/recensioni');
    await expect(page.getByText(trap)).toHaveCount(0);
  });
});

test.describe('review moderation', () => {
  test('requires a session', async ({ page }) => {
    await page.goto('/admin/recensioni');
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test('publishes a review, which then appears on the public page', async ({ page }) => {
    const body = 'Recensione da pubblicare durante il test end to end, con testo sufficientemente lungo.';
    await submitReview(page, { body, email: 'publish@example.com', firstName: 'Chiara', lastName: 'Ricci' });
    await expect(page.getByRole('heading', { name: 'Grazie' })).toBeVisible();

    await login(page);
    await page.goto('/admin/recensioni');

    const card = page.locator('li').filter({ hasText: body }).first();
    await expect(card).toBeVisible();
    await card.getByRole('button', { name: 'Pubblica' }).click();
    await expect(page.getByRole('status')).toContainText('pubblicata');

    await page.goto('/recensioni');
    await expect(page.getByText(body).first()).toBeVisible();
    await expect(page.getByText('Chiara Ricci').first()).toBeVisible();
  });

  test('never exposes the reviewer email publicly', async ({ page }) => {
    const body = 'Recensione con email che non deve mai finire sulla pagina pubblica, testo lungo.';
    await submitReview(page, { body, email: 'segreta@example.com', firstName: 'Luca', lastName: 'Verdi' });

    await login(page);
    await page.goto('/admin/recensioni');
    const card = page.locator('li').filter({ hasText: body }).first();
    await expect(card).toContainText('segreta@example.com');
    await card.getByRole('button', { name: 'Pubblica' }).click();

    await page.goto('/recensioni');
    expect(await page.content()).not.toContain('segreta@example.com');
  });

  test('rejects a review and keeps it off the site', async ({ page }) => {
    const body = 'Recensione da rifiutare perché contiene spam evidente, con testo abbastanza lungo.';
    await submitReview(page, { body, email: 'spam@example.com' });

    await login(page);
    await page.goto('/admin/recensioni');
    const card = page.locator('li').filter({ hasText: body }).first();
    await card.getByRole('button', { name: 'Rifiuta' }).click();
    await expect(page.getByRole('status')).toContainText('rifiutata');

    await page.goto('/recensioni');
    await expect(page.getByText(body)).toHaveCount(0);
  });
});

/* The carousel only has somewhere to go once there are more reviews than visible slots. */
async function publishReviews(page: Page, count: number) {
  await login(page);
  for (let index = 0; index < count; index += 1) {
    await clearRateLimits();
    await submitReview(page, {
      body: `Recensione numero ${index + 1} per il carosello, con testo sufficientemente lungo da passare.`,
      email: `carosello${index}@example.com`,
      firstName: `Cliente${index}`,
      lastName: 'Prova',
    });
    await expect(page.getByRole('heading', { name: 'Grazie' })).toBeVisible();
  }

  await page.goto('/admin/recensioni');
  const pending = page.getByRole('button', { name: 'Pubblica' });
  for (let remaining = await pending.count(); remaining > 0; remaining -= 1) {
    await pending.first().click();
    await expect(page.getByRole('status')).toBeVisible();
  }
}

test.describe('carousel', () => {
  test('never spills past the container width', async ({ page }) => {
    await page.goto('/recensioni');
    const carousel = page.locator('[data-carousel]').first();
    if ((await carousel.count()) === 0) test.skip(true, 'no published reviews in this run');

    const overflow = await page.evaluate(() => ({
      doc: document.documentElement.scrollWidth,
      view: document.documentElement.clientWidth,
    }));
    expect(overflow.doc).toBeLessThanOrEqual(overflow.view + 1);

    const fits = await carousel.evaluate((el) => {
      const wrap = el.closest('.wrap') as HTMLElement;
      return el.getBoundingClientRect().width <= wrap.getBoundingClientRect().width + 1;
    });
    expect(fits).toBe(true);
  });

  test('advances and rewinds with the controls', async ({ page }) => {
    await publishReviews(page, 5);

    await page.goto('/recensioni');
    const carousel = page.locator('[data-carousel]').first();
    await expect(carousel).toBeVisible();

    await carousel.getByLabel('Metti in pausa lo scorrimento').click();
    const status = carousel.locator('[data-carousel-status]');
    const position = async () => Number((await status.textContent())!.match(/Recensione (\d+)/)![1]);

    await expect(status).toHaveText(/^Recensione 1 di \d+$/);

    await carousel.getByLabel('Recensione successiva').click();
    await expect(status).toHaveText(/^Recensione 2 di \d+$/);
    expect(await position()).toBe(2);

    await carousel.getByLabel('Recensione precedente').click();
    await expect(status).toHaveText(/^Recensione 1 di \d+$/);
  });

  test('can be paused and resumed, as auto-updating content must be', async ({ page }) => {
    await page.goto('/recensioni');
    const carousel = page.locator('[data-carousel]').first();
    if ((await carousel.count()) === 0) test.skip(true, 'no published reviews in this run');

    const pause = carousel.getByLabel('Metti in pausa lo scorrimento');
    await expect(pause).toBeVisible();
    await pause.click();
    await expect(carousel.getByLabel('Riprendi lo scorrimento')).toBeVisible();
  });

  test('announces the position for screen readers', async ({ page }) => {
    await page.goto('/recensioni');
    const carousel = page.locator('[data-carousel]').first();
    if ((await carousel.count()) === 0) test.skip(true, 'no published reviews in this run');

    const status = carousel.locator('[data-carousel-status]');
    await expect(status).toHaveAttribute('aria-live', 'polite');
    await expect(status).toHaveText(/Recensione \d+ di \d+/);
  });
});
