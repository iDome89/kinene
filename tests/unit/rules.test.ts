import { describe, expect, it } from 'vitest';
import {
  ageInMonthsAtCheckIn,
  cancellationNoticeDays,
  cancellationOutcome,
  isBlockingHighSeasonNotice,
  completeContacts,
  isCompleteContact,
  maxUnitsFor,
  monthsBetween,
  validateBooking,
  type BookingRequest,
  type DogDeclaration,
  type EmergencyContact,
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

const twoContacts: EmergencyContact[] = [
  { firstName: 'Anna', lastName: 'Bianchi', phone: '+39 333 1112223' },
  { firstName: 'Luca', lastName: 'Verdi', phone: '059 111222' },
];

function request(overrides: Partial<BookingRequest> = {}, dog: Partial<DogDeclaration> = {}): BookingRequest {
  return {
    service: 'pensione',
    startDay: day('2026-10-01'),
    endDay: day('2026-10-05'),
    dog: { ...compliantDog, ...dog },
    emergencyContacts: twoContacts,
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
    expect(codes(r)).not.toContain('too-many-units');
  });

  it('rejects boarding of fifteen nights', () => {
    const r = request({ startDay: day('2026-10-01'), endDay: day('2026-10-16') });
    expect(codes(r)).toContain('too-many-units');
  });

  it('allows day care of exactly one day', () => {
    const r = request({ service: 'asilo-diurno', startDay: day('2026-10-01'), endDay: day('2026-10-01') });
    expect(codes(r)).not.toContain('too-many-units');
  });

  it('rejects day care spanning two days, because the cap is one', () => {
    const r = request({ service: 'asilo-diurno', startDay: day('2026-10-01'), endDay: day('2026-10-02') });
    expect(codes(r)).toContain('too-many-units');
  });

  it('cannot exceed the cap on overnight care because the end date is forced', () => {
    const r = request({ service: 'asilo-notturno', startDay: day('2026-10-01'), endDay: day('2026-10-20') });
    expect(codes(r)).not.toContain('too-many-units');
  });

  it('names the cap in the message', () => {
    const violation = validateBooking(
      request({ service: 'asilo-diurno', startDay: day('2026-10-01'), endDay: day('2026-10-04') }),
      TODAY,
    ).find((v) => v.code === 'too-many-units');
    expect(violation?.message).toContain('1 giorno');
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
    expect(violation?.message).toMatch(/comandi di base/i);
    expect(violation?.field).toBe('birthDate');
  });
});

describe('maxUnitsFor', () => {
  it('reflects the configured caps', () => {
    expect(maxUnitsFor('pensione')).toBe(14);
    expect(maxUnitsFor('asilo-notturno')).toBe(1);
    expect(maxUnitsFor('asilo-diurno')).toBe(1);
  });
});

describe('emergency contacts', () => {
  it('accepts a contact with a name, a surname and a phone', () => {
    expect(isCompleteContact({ firstName: 'Anna', lastName: 'Bianchi', phone: '+39 333 1112223' })).toBe(true);
  });

  it('rejects a contact missing any of the three fields', () => {
    expect(isCompleteContact({ firstName: '', lastName: 'Bianchi', phone: '+39 333 1112223' })).toBe(false);
    expect(isCompleteContact({ firstName: 'Anna', lastName: '', phone: '+39 333 1112223' })).toBe(false);
    expect(isCompleteContact({ firstName: 'Anna', lastName: 'Bianchi', phone: '' })).toBe(false);
  });

  it('rejects an implausible phone number', () => {
    expect(isCompleteContact({ firstName: 'Anna', lastName: 'Bianchi', phone: '123' })).toBe(false);
    expect(isCompleteContact({ firstName: 'Anna', lastName: 'Bianchi', phone: 'chiamami' })).toBe(false);
  });

  it('ignores surrounding whitespace', () => {
    expect(isCompleteContact({ firstName: ' Anna ', lastName: ' Bianchi ', phone: ' 059 111222 ' })).toBe(true);
  });

  it('counts only the complete ones', () => {
    const contacts: EmergencyContact[] = [
      { firstName: 'Anna', lastName: 'Bianchi', phone: '+39 333 1112223' },
      { firstName: 'Luca', lastName: '', phone: '059 111222' },
    ];
    expect(completeContacts(contacts)).toHaveLength(1);
  });

  it('accepts a booking with two complete contacts', () => {
    expect(codes(request())).not.toContain('missing-emergency-contacts');
  });

  it('rejects a booking with only one contact', () => {
    expect(codes(request({ emergencyContacts: [twoContacts[0]!] }))).toContain('missing-emergency-contacts');
  });

  it('rejects a booking with none', () => {
    expect(codes(request({ emergencyContacts: [] }))).toContain('missing-emergency-contacts');
  });

  it('rejects two contacts when one of them is incomplete', () => {
    const contacts: EmergencyContact[] = [
      twoContacts[0]!,
      { firstName: 'Luca', lastName: 'Verdi', phone: '' },
    ];
    expect(codes(request({ emergencyContacts: contacts }))).toContain('missing-emergency-contacts');
  });

  it('accepts a third contact without complaint', () => {
    const contacts = [...twoContacts, { firstName: 'Sara', lastName: 'Neri', phone: '+39 340 5556667' }];
    expect(codes(request({ emergencyContacts: contacts }))).not.toContain('missing-emergency-contacts');
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
