import { describe, expect, it } from 'vitest';
import { formatEuro, quote } from '@/lib/pricing';
import { parseDay } from '@/lib/dates';
import { services } from '@/config/business';

const day = (iso: string) => parseDay(iso)!;

describe('quote', () => {
  it('bills boarding by nights, not by days present', () => {
    const q = quote('pensione', day('2026-09-10'), day('2026-09-13'));
    expect(q.units).toBe(3);
    expect(q.totalCents).toBe(3 * services.pensione.priceCents);
  });

  it('bills day care inclusively', () => {
    const q = quote('asilo-diurno', day('2026-09-10'), day('2026-09-10'));
    expect(q.units).toBe(1);
    expect(q.totalCents).toBe(services['asilo-diurno'].priceCents);
  });

  it('bills overnight care as exactly one night whatever end date arrives', () => {
    const q = quote('asilo-notturno', day('2026-09-10'), day('2026-09-20'));
    expect(q.units).toBe(1);
    expect(q.endDay).toBe(day('2026-09-11'));
    expect(q.totalCents).toBe(services['asilo-notturno'].priceCents);
  });

  it('never produces a negative total from an inverted range', () => {
    const q = quote('pensione', day('2026-09-10'), day('2026-09-05'));
    expect(q.units).toBe(0);
    expect(q.totalCents).toBe(0);
  });

  it('flags a stay that touches high season', () => {
    expect(quote('pensione', day('2026-07-30'), day('2026-08-02')).touchesHighSeason).toBe(true);
    expect(quote('pensione', day('2026-09-10'), day('2026-09-13')).touchesHighSeason).toBe(false);
  });

  it('produces line items that sum to the total', () => {
    const q = quote('pensione', day('2026-09-10'), day('2026-09-14'));
    const sum = q.lines.reduce((total, line) => total + line.totalCents, 0);
    expect(sum).toBe(q.totalCents);
  });

  it('stays in integer cents across every stay length', () => {
    for (let nights = 1; nights <= 14; nights += 1) {
      const q = quote('pensione', day('2026-09-01'), day('2026-09-01') + nights);
      expect(Number.isInteger(q.totalCents)).toBe(true);
    }
  });

  it('singularises the unit label for a one-unit stay', () => {
    expect(quote('pensione', day('2026-09-10'), day('2026-09-11')).lines[0]!.label).toContain('1 notte');
    expect(quote('pensione', day('2026-09-10'), day('2026-09-13')).lines[0]!.label).toContain('3 notti');
  });
});

describe('formatEuro', () => {
  it('renders italian currency', () => {
    expect(formatEuro(3000).replace(/ /g, ' ')).toBe('30,00 €');
    expect(formatEuro(0).replace(/ /g, ' ')).toBe('0,00 €');
  });
});

describe('più di un cane', () => {
  const from = day('2026-09-10');
  const to = day('2026-09-13');
  const one = quote('pensione', from, to).totalCents;

  it('leaves the single-dog price exactly where it was', () => {
    expect(quote('pensione', from, to, 1, false).totalCents).toBe(one);
    expect(quote('pensione', from, to, 1, true).totalCents).toBe(one);
  });

  it('halves the second dog when the two share a space', () => {
    expect(quote('pensione', from, to, 2, true).totalCents).toBe(one * 1.5);
  });

  it('charges the second dog in full when they are kept apart', () => {
    expect(quote('pensione', from, to, 2, false).totalCents).toBe(one * 2);
  });

  it('itemises the second dog so the customer sees where the money goes', () => {
    const shared = quote('pensione', from, to, 2, true);
    expect(shared.lines).toHaveLength(2);
    expect(shared.lines[1]!.label).toContain('stesso spazio');
    expect(shared.lines[1]!.totalCents).toBe(one / 2);

    const apart = quote('pensione', from, to, 2, false);
    expect(apart.lines[1]!.label).toContain('spazio separato');
    expect(apart.lines[1]!.totalCents).toBe(one);
  });

  it('reports sharing only when there is a second dog to share with', () => {
    expect(quote('pensione', from, to, 1, true).sharedSpace).toBe(false);
    expect(quote('pensione', from, to, 2, true).sharedSpace).toBe(true);
  });

  it('never invents a fractional cent', () => {
    for (const service of ['asilo-diurno', 'asilo-notturno', 'pensione'] as const) {
      const total = quote(service, from, to, 2, true).totalCents;
      expect(Number.isInteger(total)).toBe(true);
    }
  });

  it('treats a nonsense dog count as one dog rather than pricing zero', () => {
    expect(quote('pensione', from, to, 0, false).totalCents).toBe(one);
    expect(quote('pensione', from, to, -3, false).totalCents).toBe(one);
  });
});
