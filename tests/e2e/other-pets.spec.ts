import { expect, test } from '@playwright/test';

const PAGES = ['/', '/prezzi', '/contatti'];

test.describe('animali diversi dal cane', () => {
  for (const path of PAGES) {
    test(`${path} says other pets are welcome and how to ask`, async ({ page }) => {
      await page.goto(path);
      const card = page.getByTestId('other-pets');
      await expect(card).toBeVisible();

      for (const species of ['Gatti', 'Pappagalli', 'rettili']) {
        await expect(card).toContainText(species, { ignoreCase: true });
      }

      await expect(card.locator('a[href^="tel:"]')).toBeVisible();
      await expect(card.locator('a[href*="wa.me"]')).toBeVisible();
    });
  }

  test('the booking form warns before anyone fills a dog form for a parrot', async ({ page }) => {
    await page.goto('/prenota');
    const notice = page.getByTestId('other-pets-notice');
    await expect(notice).toBeVisible();
    await expect(notice).toContainText('non usiamo il calendario online');
    await expect(notice.locator('a[href^="tel:"]')).toBeVisible();
    await expect(notice.locator('a[href*="wa.me"]')).toBeVisible();
  });

  test('the notice sits above the form, not buried under it', async ({ page }) => {
    await page.goto('/prenota');
    const noticeY = await page
      .getByText('Hai un animale che non è un cane?')
      .evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
    const formY = await page
      .locator('form[method="POST"]')
      .first()
      .evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
    expect(noticeY).toBeLessThan(formY);
  });

  test('the WhatsApp link opens a message that already explains the situation', async ({ page }) => {
    await page.goto('/contatti');
    const href = await page.getByTestId('other-pets').locator('a[href*="wa.me"]').getAttribute('href');
    expect(decodeURIComponent(href!)).toContain('non è un cane');
  });

  test('the homepage FAQ answers it, so search engines can quote it', async ({ page }) => {
    await page.goto('/');
    const jsonLd = await page.locator('script[type="application/ld+json"]').allTextContents();
    const faq = jsonLd.map((raw) => JSON.parse(raw)).find((node) => node['@type'] === 'FAQPage');
    const question = faq.mainEntity.find((entry: { name: string }) => /altri animali/i.test(entry.name));
    expect(question).toBeDefined();
    expect(question.acceptedAnswer.text).toMatch(/pappagalli/i);
  });

  test('every aria-labelledby points at an element that exists', async ({ page }) => {
    for (const path of [...PAGES, '/prenota']) {
      await page.goto(path);
      const dangling = await page.evaluate(() =>
        [...document.querySelectorAll('[aria-labelledby]')]
          .map((el) => el.getAttribute('aria-labelledby')!)
          .filter((id) => document.getElementById(id) === null),
      );
      expect(dangling, `${path} has dangling aria-labelledby`).toEqual([]);
    }
  });
});
