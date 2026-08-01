import { expect, test } from '@playwright/test';

/* Every surface a customer might read before booking has to carry the deadline. */
const PAGES = ['/', '/prezzi', '/regolamento', '/test-di-ingresso', '/servizi/pensione', '/prenota'];

test.describe('preavviso test d’ingresso', () => {
  for (const path of PAGES) {
    test(`${path} states the seven-day notice`, async ({ page }) => {
      await page.goto(path);
      /* Anchored on 'almeno': plain '7 giorni prima' also matches the cancellation policy. */
      await expect(page.locator('body')).toContainText(/almeno 7 giorni prima/);
    });
  }

  test('the rule is a binding requirement in the regolamento, not a suggestion', async ({ page }) => {
    await page.goto('/regolamento');
    const card = page.locator('li').filter({ hasText: 'Test d’ingresso' }).first();
    await expect(card).toContainText('almeno 7 giorni prima');
    await expect(card).toContainText('non può essere confermata');
  });

  test('search engines can quote it from the FAQ data', async ({ page }) => {
    await page.goto('/');
    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
    const faq = blocks.map((raw) => JSON.parse(raw)).find((node) => node['@type'] === 'FAQPage');
    const answer = faq.mainEntity.find((entry: { name: string }) => /test d’ingresso/i.test(entry.name));
    expect(answer.acceptedAnswer.text).toContain('7 giorni prima');
  });

  test('the booking page says it before the form, not after', async ({ page }) => {
    await page.goto('/prenota');
    await expect(page.getByText(/almeno 7 giorni prima/).first()).toBeVisible();
  });
});
