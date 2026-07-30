import { describe, expect, it } from 'vitest';
import {
  ageInMonthsAtCheckIn,
  cancellationNoticeDays,
  cancellationOutcome,
  isBlockingHighSeasonNotice,
  maxNightsFor,
  monthsBetween,
  validateBooking,
  type BookingRequest,
  type DogDeclaration,
  type ViolationCode,
} from '@/lib/rules';
import { parseDay } from '@/lib/dates';
import { policy } from '@/config/business';

const day = (iso: string) => parseDay(iso)!;
const TODAY = day('2026-09-01');

const compliantDog: DogDeclaration = {
  birthDay: day('2020-01-01'),
  sex: 'M',
  inHeatOrNear: false,
  hasMicrochip: true,
  hasHealthRecord: true,
  hasInsurance: true,
  hasVaccinations: true,
  hasParasiteTreatment: true,
  isHealthy: true,
  knowsBaseCommands: true,
  hasAggressionHistory: false,
};

function request(overrides: Partial<BookingRequest> = {}, dog: Partial<DogDeclaration> = {}): BookingRequest {
  return {
    service: 'pensione',
    startDay: day('2026-10-01'),
    endDay: day('2026-10-05'),
    dog: { ...compliantDog, ...dog },
    acceptedRules: true,
    acceptedPrivacy: true,
    ...overrides,
  };
}

const codes = (request: BookingRequest, today = TODAY): ViolationCode[] =>
  validateBooking(request, today).map((violation) => violation.code);

describe('monthsBetween', () => {
  it('counts only whole months', () => {
    expect(monthsBetween(day('2026-01-15'), day('2026-02-14'))).toBe(0);
    expect(monthsBetween(day('2026-01-15'), day('2026-02-15'))).toBe(1);
    expect(monthsBetween(day('2026-01-15'), day('2027-01-15'))).toBe(12);
    expect(monthsBetween(day('2026-01-15'), day('2027-01-14'))).toBe(11);
  });

  it('handles a birthday on the 31st of a short month', () => {
    expect(monthsBetween(day('2026-01-31'), day('2026-02-28'))).toBe(0);
    expect(monthsBetween(day('2026-01-31'), day('2026-03-31'))).toBe(2);
  });
});

describe('ageInMonthsAtCheckIn', () => {
  it('measures against the check-in date, not today', () => {
    expect(ageInMonthsAtCheckIn(day('2026-01-10'), day('2027-01-10'))).toBe(12);
    expect(ageInMonthsAtCheckIn(day('2026-01-10'), day('2027-01-09'))).toBe(11);
  });
});

describe('validateBooking — a compliant request', () => {
  it('passes clean', () => {
    expect(validateBooking(request(), TODAY)).toEqual([]);
  });
});

describe('validateBooking — the one year minimum', () => {
  it('rejects a puppy under twelve months at check-in', () => {
    expect(codes(request({}, { birthDay: day('2026-04-01') }))).toContain('dog-too-young');
  });

  it('accepts a dog that turns one exactly on the check-in day', () => {
    expect(codes(request({}, { birthDay: day('2025-10-01') }))).not.toContain('dog-too-young');
  });

  it('rejects a dog that turns one the day after check-in', () => {
    expect(codes(request({}, { birthDay: day('2025-10-02') }))).toContain('dog-too-young');
  });

  it('rejects a missing birth date rather than assuming the dog qualifies', () => {
    expect(codes(request({}, { birthDay: null }))).toContain('dog-too-young');
  });
});

describe('validateBooking — stay length', () => {
  it('allows boarding of exactly fourteen nights', () => {
    const r = request({ startDay: day('2026-10-01'), endDay: day('2026-10-15') });
    expect(codes(r)).not.toContain('too-many-nights');
  });

  it('rejects boarding of fifteen nights', () => {
    const r = request({ startDay: day('2026-10-01'), endDay: day('2026-10-16') });
    expect(codes(r)).toContain('too-many-nights');
  });

  it('never rejects day care on length because it has no cap', () => {
    const r = request({ service: 'asilo-diurno', startDay: day('2026-10-01'), endDay: day('2026-11-30') });
    expect(codes(r)).not.toContain('too-many-nights');
  });

  it('cannot exceed the cap on overnight care because the end date is forced', () => {
    const r = request({ service: 'asilo-notturno', startDay: day('2026-10-01'), endDay: day('2026-10-20') });
    expect(codes(r)).not.toContain('too-many-nights');
  });
});

describe('validateBooking — dates', () => {
  it('rejects a start date in the past', () => {
    expect(codes(request({ startDay: day('2026-08-30'), endDay: day('2026-09-02') }))).toContain('start-in-past');
  });

  it('accepts a same-day start', () => {
    expect(codes(request({ startDay: TODAY, endDay: day('2026-09-03') }))).not.toContain('start-in-past');
  });

  it('rejects a departure before the arrival', () => {
    expect(codes(request({ startDay: day('2026-10-10'), endDay: day('2026-10-05') }))).toContain('invalid-range');
  });
});

describe('validateBooking — health and documents', () => {
  const cases: ReadonlyArray<readonly [Partial<DogDeclaration>, ViolationCode]> = [
    [{ hasMicrochip: false }, 'missing-microchip'],
    [{ hasHealthRecord: false }, 'missing-health-record'],
    [{ hasInsurance: false }, 'missing-insurance'],
    [{ hasVaccinations: false }, 'missing-vaccinations'],
    [{ hasParasiteTreatment: false }, 'missing-parasite-treatment'],
    [{ isHealthy: false }, 'contagious-or-injured'],
    [{ knowsBaseCommands: false }, 'missing-base-commands'],
    [{ hasAggressionHistory: true }, 'aggression-declared'],
  ];

  for (const [dog, code] of cases) {
    it(`rejects on ${code}`, () => {
      expect(codes(request({}, dog))).toContain(code);
    });
  }

  it('reports every failure at once instead of stopping at the first', () => {
    const found = codes(request({}, { hasMicrochip: false, hasInsurance: false, isHealthy: false }));
    expect(found).toEqual(expect.arrayContaining(['missing-microchip', 'missing-insurance', 'contagious-or-injured']));
  });
});

describe('validateBooking — females in heat', () => {
  it('rejects a female in or near heat', () => {
    expect(codes(request({}, { sex: 'F', inHeatOrNear: true }))).toContain('female-in-heat');
  });

  it('accepts a female not in heat', () => {
    expect(codes(request({}, { sex: 'F', inHeatOrNear: false }))).not.toContain('female-in-heat');
  });

  it('ignores the flag on a male', () => {
    expect(codes(request({}, { sex: 'M', inHeatOrNear: true }))).not.toContain('female-in-heat');
  });
});

describe('validateBooking — consent', () => {
  it('requires the regolamento and the privacy notice separately', () => {
    expect(codes(request({ acceptedRules: false }))).toContain('rules-not-accepted');
    expect(codes(request({ acceptedPrivacy: false }))).toContain('privacy-not-accepted');
    expect(codes(request({ acceptedRules: false, acceptedPrivacy: false }))).toEqual(
      expect.arrayContaining(['rules-not-accepted', 'privacy-not-accepted']),
    );
  });
});

describe('validateBooking — messages', () => {
  it('names the rule so the customer knows what to fix', () => {
    const violation = validateBooking(request({}, { birthDay: day('2026-04-01') }), TODAY).find(
      (v) => v.code === 'dog-too-young',
    );
    expect(violation?.message).toMatch(/un anno di età/i);
    expect(violation?.field).toBe('birthDate');
  });
});

describe('maxNightsFor', () => {
  it('reflects the configured caps', () => {
    expect(maxNightsFor('pensione')).toBe(14);
    expect(maxNightsFor('asilo-notturno')).toBe(1);
    expect(maxNightsFor('asilo-diurno')).toBeNull();
  });
});

describe('cancellationNoticeDays', () => {
  it('requires seven days in low season', () => {
    expect(cancellationNoticeDays(day('2026-09-10'), day('2026-09-14'))).toBe(policy.standardCancellationDays);
  });

  it('requires fourteen days when the stay touches high season', () => {
    expect(cancellationNoticeDays(day('2026-07-30'), day('2026-08-02'))).toBe(policy.highSeasonCancellationDays);
    expect(cancellationNoticeDays(day('2026-12-22'), day('2026-12-27'))).toBe(policy.highSeasonCancellationDays);
  });
});

describe('cancellationOutcome', () => {
  it('is free at exactly seven days notice in low season', () => {
    const outcome = cancellationOutcome(12000, day('2026-09-10'), day('2026-09-14'), day('2026-09-03'));
    expect(outcome).toMatchObject({ feeCents: 0, refundCents: 12000, withinFreeWindow: true });
  });

  it('charges half at six days notice in low season', () => {
    const outcome = cancellationOutcome(12000, day('2026-09-10'), day('2026-09-14'), day('2026-09-04'));
    expect(outcome).toMatchObject({ feeCents: 6000, refundCents: 6000, withinFreeWindow: false });
  });

  it('charges half at ten days notice in August because high season needs fourteen', () => {
    const outcome = cancellationOutcome(12000, day('2026-08-10'), day('2026-08-14'), day('2026-07-31'));
    expect(outcome).toMatchObject({ feeCents: 6000, requiredNoticeDays: 14, actualNoticeDays: 10 });
  });

  it('is free at fourteen days notice in August', () => {
    const outcome = cancellationOutcome(12000, day('2026-08-15'), day('2026-08-19'), day('2026-08-01'));
    expect(outcome.withinFreeWindow).toBe(true);
  });

  it('rounds the fee to whole cents', () => {
    const outcome = cancellationOutcome(3333, day('2026-09-10'), day('2026-09-11'), day('2026-09-09'));
    expect(Number.isInteger(outcome.feeCents)).toBe(true);
    expect(outcome.feeCents + outcome.refundCents).toBe(3333);
  });

  it('treats a cancellation after the stay started as a late cancellation', () => {
    const outcome = cancellationOutcome(12000, day('2026-09-10'), day('2026-09-14'), day('2026-09-11'));
    expect(outcome.actualNoticeDays).toBe(-1);
    expect(outcome.withinFreeWindow).toBe(false);
  });
});

describe('isBlockingHighSeasonNotice', () => {
  it('flags a high season stay booked inside the notice window', () => {
    expect(isBlockingHighSeasonNotice(day('2026-08-10'), day('2026-08-14'), day('2026-08-05'))).toBe(true);
  });

  it('does not flag a high season stay booked well ahead', () => {
    expect(isBlockingHighSeasonNotice(day('2026-08-20'), day('2026-08-24'), day('2026-07-01'))).toBe(false);
  });

  it('does not flag a low season stay booked tomorrow', () => {
    expect(isBlockingHighSeasonNotice(day('2026-09-10'), day('2026-09-14'), day('2026-09-09'))).toBe(false);
  });
});
