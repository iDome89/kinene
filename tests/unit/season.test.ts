import { describe, expect, it } from 'vitest';
import { easterSunday, isHighSeason, rangeTouchesHighSeason } from '@/lib/season';
import { formatDay, parseDay } from '@/lib/dates';

const day = (iso: string) => parseDay(iso)!;

describe('easterSunday', () => {
  it('matches known Gregorian Easter dates', () => {
    const known: Record<number, string> = {
      2024: '2024-03-31',
      2025: '2025-04-20',
      2026: '2026-04-05',
      2027: '2027-03-28',
      2028: '2028-04-16',
      2030: '2030-04-21',
      2038: '2038-04-25',
    };
    for (const [year, iso] of Object.entries(known)) {
      expect(formatDay(easterSunday(Number(year)))).toBe(iso);
    }
  });

  it('always lands on a Sunday', () => {
    for (let year = 2024; year <= 2060; year += 1) {
      expect((((easterSunday(year) + 4) % 7) + 7) % 7).toBe(0);
    }
  });
});

describe('isHighSeason', () => {
  it('covers the whole of August', () => {
    expect(isHighSeason(day('2026-07-31'))).toBe(false);
    expect(isHighSeason(day('2026-08-01'))).toBe(true);
    expect(isHighSeason(day('2026-08-31'))).toBe(true);
    expect(isHighSeason(day('2026-09-01'))).toBe(false);
  });

  it('wraps the Christmas window across the year boundary', () => {
    expect(isHighSeason(day('2026-12-19'))).toBe(false);
    expect(isHighSeason(day('2026-12-20'))).toBe(true);
    expect(isHighSeason(day('2026-12-31'))).toBe(true);
    expect(isHighSeason(day('2027-01-01'))).toBe(true);
    expect(isHighSeason(day('2027-01-06'))).toBe(true);
    expect(isHighSeason(day('2027-01-07'))).toBe(false);
  });

  it('tracks Easter as it moves year to year', () => {
    expect(isHighSeason(day('2026-04-02'))).toBe(true);
    expect(isHighSeason(day('2026-04-06'))).toBe(true);
    expect(isHighSeason(day('2026-04-07'))).toBe(false);
    expect(isHighSeason(day('2027-04-02'))).toBe(false);
    expect(isHighSeason(day('2027-03-25'))).toBe(true);
    expect(isHighSeason(day('2027-03-29'))).toBe(true);
  });

  it('finds an Easter window that spills over from the neighbouring year', () => {
    expect(isHighSeason(day('2038-04-22'))).toBe(true);
    expect(isHighSeason(day('2038-04-26'))).toBe(true);
  });

  it('leaves ordinary dates alone', () => {
    for (const iso of ['2026-02-11', '2026-05-20', '2026-06-30', '2026-10-15', '2026-11-03']) {
      expect(isHighSeason(day(iso))).toBe(false);
    }
  });
});

describe('rangeTouchesHighSeason', () => {
  it('is true when any single day inside the range qualifies', () => {
    expect(rangeTouchesHighSeason(day('2026-07-29'), day('2026-08-02'))).toBe(true);
  });

  it('respects the exclusive upper bound', () => {
    expect(rangeTouchesHighSeason(day('2026-07-29'), day('2026-08-01'))).toBe(false);
  });

  it('is false for a range entirely in low season', () => {
    expect(rangeTouchesHighSeason(day('2026-09-10'), day('2026-09-20'))).toBe(false);
  });

  it('is false for an empty range', () => {
    expect(rangeTouchesHighSeason(day('2026-08-10'), day('2026-08-10'))).toBe(false);
  });
});
