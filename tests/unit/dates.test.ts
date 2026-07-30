import { describe, expect, it } from 'vitest';
import {
  addDays,
  civilFromDay,
  dayFromCivil,
  daysInMonth,
  endOfMonth,
  formatDay,
  formatDayShortIt,
  isLeapYear,
  isValidCivilDate,
  parseDay,
  startOfMonth,
  todayInBusinessTimezone,
  weekdayOf,
} from '@/lib/dates';

describe('day numbering', () => {
  it('anchors day zero to the unix epoch', () => {
    expect(dayFromCivil(1970, 1, 1)).toBe(0);
    expect(formatDay(0)).toBe('1970-01-01');
  });

  it('round-trips civil dates', () => {
    for (const iso of ['2026-01-01', '2026-02-28', '2028-02-29', '2026-12-31', '1999-06-15']) {
      expect(formatDay(parseDay(iso)!)).toBe(iso);
    }
  });

  it('survives DST boundaries in Europe/Rome', () => {
    const beforeSpringForward = parseDay('2026-03-28')!;
    const afterSpringForward = parseDay('2026-03-29')!;
    expect(afterSpringForward - beforeSpringForward).toBe(1);

    const beforeFallBack = parseDay('2026-10-24')!;
    const afterFallBack = parseDay('2026-10-25')!;
    expect(afterFallBack - beforeFallBack).toBe(1);
  });
});

describe('parseDay', () => {
  it('rejects malformed input', () => {
    for (const bad of ['', '2026-1-1', '26-01-01', '2026/01/01', 'oggi', '2026-01-01T00:00']) {
      expect(parseDay(bad)).toBeNull();
    }
  });

  it('rejects impossible calendar dates instead of rolling them over', () => {
    expect(parseDay('2026-02-30')).toBeNull();
    expect(parseDay('2026-13-01')).toBeNull();
    expect(parseDay('2026-00-10')).toBeNull();
    expect(parseDay('2026-04-31')).toBeNull();
    expect(parseDay('2027-02-29')).toBeNull();
    expect(parseDay('2028-02-29')).not.toBeNull();
  });
});

describe('leap years', () => {
  it('applies the full Gregorian rule', () => {
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2027)).toBe(false);
    expect(isLeapYear(1900)).toBe(false);
    expect(isLeapYear(2000)).toBe(true);
  });

  it('reports February length accordingly', () => {
    expect(daysInMonth(2027, 2)).toBe(28);
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(2026, 4)).toBe(30);
    expect(daysInMonth(2026, 12)).toBe(31);
  });
});

describe('weekdayOf', () => {
  it('maps sunday to zero', () => {
    expect(weekdayOf(parseDay('2026-08-02')!)).toBe(0);
    expect(weekdayOf(parseDay('2026-08-03')!)).toBe(1);
    expect(weekdayOf(parseDay('2026-08-08')!)).toBe(6);
  });

  it('never returns a negative index before the epoch', () => {
    expect(weekdayOf(-1)).toBe(3);
    expect(weekdayOf(-8)).toBe(3);
  });
});

describe('month boundaries', () => {
  it('finds the first and last day of the containing month', () => {
    const midFebruary = parseDay('2028-02-14')!;
    expect(formatDay(startOfMonth(midFebruary))).toBe('2028-02-01');
    expect(formatDay(endOfMonth(midFebruary))).toBe('2028-02-29');
  });
});

describe('addDays', () => {
  it('crosses month and year boundaries', () => {
    expect(formatDay(addDays(parseDay('2026-12-31')!, 1))).toBe('2027-01-01');
    expect(formatDay(addDays(parseDay('2027-01-01')!, -1))).toBe('2026-12-31');
  });
});

describe('todayInBusinessTimezone', () => {
  it('uses the Rome civil date, not UTC, just after midnight in summer', () => {
    const justAfterRomeMidnight = new Date('2026-07-14T22:30:00Z');
    expect(formatDay(todayInBusinessTimezone(justAfterRomeMidnight))).toBe('2026-07-15');
  });

  it('uses the Rome civil date, not UTC, just after midnight in winter', () => {
    const justAfterRomeMidnight = new Date('2026-01-14T23:30:00Z');
    expect(formatDay(todayInBusinessTimezone(justAfterRomeMidnight))).toBe('2026-01-15');
  });
});

describe('italian formatting', () => {
  it('renders day/month/year', () => {
    expect(formatDayShortIt(parseDay('2026-08-05')!)).toBe('05/08/2026');
  });
});

describe('isValidCivilDate', () => {
  it('agrees with parseDay', () => {
    expect(isValidCivilDate(2026, 2, 28)).toBe(true);
    expect(isValidCivilDate(2026, 2, 29)).toBe(false);
  });
});

describe('civilFromDay', () => {
  it('inverts dayFromCivil', () => {
    const day = dayFromCivil(2026, 11, 7);
    expect(civilFromDay(day)).toEqual({ year: 2026, month: 11, day: 7 });
  });
});
