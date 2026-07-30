import { describe, expect, it } from 'vitest';
import {
  availabilityWindow,
  billableUnits,
  buildOccupancy,
  departureDayFor,
  firstUnavailableDay,
  inspectDay,
  occupancySpanFor,
  spanIsAvailable,
  type DaySpan,
} from '@/lib/availability';
import { parseDay } from '@/lib/dates';

const day = (iso: string) => parseDay(iso)!;
const ORIGIN = day('2026-08-01');

function grid(overrides: Partial<Parameters<typeof buildOccupancy>[0]> = {}) {
  return buildOccupancy({
    originDay: ORIGIN,
    dayCount: 31,
    defaultCapacity: 3,
    ...overrides,
  });
}

describe('occupancySpanFor', () => {
  it('gives a single-day service one calendar day', () => {
    const d = day('2026-08-10');
    expect(occupancySpanFor('asilo-diurno', d, d)).toEqual({ from: d, toExclusive: d + 1 });
  });

  it('gives overnight care two calendar days because the dog is present both mornings', () => {
    const d = day('2026-08-10');
    expect(occupancySpanFor('asilo-notturno', d, d + 1)).toEqual({ from: d, toExclusive: d + 2 });
  });

  it('counts the departure day as occupied for boarding', () => {
    const start = day('2026-08-10');
    const end = day('2026-08-13');
    expect(occupancySpanFor('pensione', start, end)).toEqual({ from: start, toExclusive: end + 1 });
  });
});

describe('departureDayFor', () => {
  it('forces overnight care to exactly one night regardless of what was requested', () => {
    const start = day('2026-08-10');
    expect(departureDayFor('asilo-notturno', start, start + 9)).toBe(start + 1);
    expect(departureDayFor('asilo-notturno', start, start)).toBe(start + 1);
  });

  it('clamps day care to at least the start day', () => {
    const start = day('2026-08-10');
    expect(departureDayFor('asilo-diurno', start, start - 4)).toBe(start);
    expect(departureDayFor('asilo-diurno', start, start + 4)).toBe(start + 4);
  });

  it('passes boarding through untouched', () => {
    const start = day('2026-08-10');
    expect(departureDayFor('pensione', start, start + 6)).toBe(start + 6);
  });
});

describe('billableUnits', () => {
  it('bills day care inclusively', () => {
    const start = day('2026-08-10');
    expect(billableUnits('asilo-diurno', start, start)).toBe(1);
    expect(billableUnits('asilo-diurno', start, start + 4)).toBe(5);
  });

  it('bills nights, so the checkout day is free', () => {
    const start = day('2026-08-10');
    expect(billableUnits('pensione', start, start + 3)).toBe(3);
    expect(billableUnits('asilo-notturno', start, start + 1)).toBe(1);
  });
});

describe('buildOccupancy', () => {
  it('starts empty at the configured capacity', () => {
    const status = inspectDay(grid(), day('2026-08-05'));
    expect(status).toMatchObject({ taken: 0, capacity: 3, available: true, reason: null });
  });

  it('counts overlapping stays independently', () => {
    const occupied: DaySpan[] = [
      { from: day('2026-08-05'), toExclusive: day('2026-08-09') },
      { from: day('2026-08-07'), toExclusive: day('2026-08-12') },
    ];
    const g = grid({ occupied });
    expect(inspectDay(g, day('2026-08-06')).taken).toBe(1);
    expect(inspectDay(g, day('2026-08-08')).taken).toBe(2);
    expect(inspectDay(g, day('2026-08-10')).taken).toBe(1);
  });

  it('frees the exclusive end day so back-to-back stays fit', () => {
    const g = grid({
      defaultCapacity: 1,
      occupied: [{ from: day('2026-08-05'), toExclusive: day('2026-08-09') }],
    });
    expect(inspectDay(g, day('2026-08-08')).available).toBe(false);
    expect(inspectDay(g, day('2026-08-09')).available).toBe(true);
  });

  it('marks a day full once capacity is reached', () => {
    const span = { from: day('2026-08-05'), toExclusive: day('2026-08-06') };
    const g = grid({ defaultCapacity: 2, occupied: [span, span] });
    expect(inspectDay(g, day('2026-08-05'))).toMatchObject({ available: false, reason: 'full' });
  });

  it('closes configured weekdays', () => {
    const g = grid({ closedWeekdays: [0] });
    expect(inspectDay(g, day('2026-08-02'))).toMatchObject({ available: false, reason: 'closed' });
    expect(inspectDay(g, day('2026-08-03')).available).toBe(true);
  });

  it('applies blackouts over the default capacity', () => {
    const g = grid({ blackouts: [{ from: day('2026-08-14'), toExclusive: day('2026-08-17') }] });
    expect(inspectDay(g, day('2026-08-13')).available).toBe(true);
    expect(inspectDay(g, day('2026-08-14')).reason).toBe('closed');
    expect(inspectDay(g, day('2026-08-16')).reason).toBe('closed');
    expect(inspectDay(g, day('2026-08-17')).available).toBe(true);
  });

  it('lets a blackout override a raised capacity', () => {
    const g = grid({
      capacityOverrides: [{ day: day('2026-08-14'), maxDogs: 10 }],
      blackouts: [{ from: day('2026-08-14'), toExclusive: day('2026-08-15') }],
    });
    expect(inspectDay(g, day('2026-08-14')).reason).toBe('closed');
  });

  it('lets a capacity override reopen a day closed by weekday', () => {
    const g = grid({
      closedWeekdays: [0],
      capacityOverrides: [{ day: day('2026-08-02'), maxDogs: 2 }],
    });
    expect(inspectDay(g, day('2026-08-02')).available).toBe(true);
  });

  it('clips spans that start before or end after the window', () => {
    const g = grid({
      occupied: [{ from: day('2026-07-20'), toExclusive: day('2026-09-15') }],
    });
    expect(inspectDay(g, ORIGIN).taken).toBe(1);
    expect(inspectDay(g, day('2026-08-31')).taken).toBe(1);
    expect(g.counts.length).toBe(31);
  });

  it('reports days outside the window as out-of-range rather than available', () => {
    const g = grid();
    expect(inspectDay(g, day('2026-07-31'))).toMatchObject({ available: false, reason: 'out-of-range' });
    expect(inspectDay(g, day('2026-09-01'))).toMatchObject({ available: false, reason: 'out-of-range' });
  });
});

describe('firstUnavailableDay', () => {
  it('returns null when the whole span is free', () => {
    expect(firstUnavailableDay(grid(), day('2026-08-05'), day('2026-08-09'))).toBeNull();
  });

  it('reports the earliest blocking day and why', () => {
    const g = grid({ blackouts: [{ from: day('2026-08-07'), toExclusive: day('2026-08-08') }] });
    const conflict = firstUnavailableDay(g, day('2026-08-05'), day('2026-08-10'));
    expect(conflict).toMatchObject({ day: day('2026-08-07'), reason: 'closed' });
  });

  it('ignores a block that falls on the exclusive end', () => {
    const g = grid({ blackouts: [{ from: day('2026-08-10'), toExclusive: day('2026-08-11') }] });
    expect(firstUnavailableDay(g, day('2026-08-05'), day('2026-08-10'))).toBeNull();
  });
});

describe('spanIsAvailable', () => {
  it('refuses a boarding span whose departure day is full', () => {
    const full = { from: day('2026-08-12'), toExclusive: day('2026-08-13') };
    const g = grid({ defaultCapacity: 1, occupied: [full] });
    const span = occupancySpanFor('pensione', day('2026-08-09'), day('2026-08-12'));
    expect(spanIsAvailable(g, span)).toBe(false);
  });

  it('accepts a boarding span that ends the day before a full day', () => {
    const full = { from: day('2026-08-13'), toExclusive: day('2026-08-14') };
    const g = grid({ defaultCapacity: 1, occupied: [full] });
    const span = occupancySpanFor('pensione', day('2026-08-09'), day('2026-08-12'));
    expect(spanIsAvailable(g, span)).toBe(true);
  });
});

describe('availabilityWindow', () => {
  it('returns one entry per day in grid order', () => {
    const window = availabilityWindow(grid());
    expect(window).toHaveLength(31);
    expect(window[0]!.day).toBe(ORIGIN);
    expect(window[30]!.day).toBe(day('2026-08-31'));
  });
});

describe('grid storage', () => {
  it('keeps occupancy in typed arrays sized to the window', () => {
    const g = grid();
    expect(g.counts).toBeInstanceOf(Int16Array);
    expect(g.capacity).toBeInstanceOf(Int16Array);
    expect(g.counts.length).toBe(g.dayCount);
  });
});
