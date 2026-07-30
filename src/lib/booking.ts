import { departureDayFor, occupancySpanFor, spanIsAvailable } from './availability';
import { parseDay, todayInBusinessTimezone } from './dates';
import { quote } from './pricing';
import { validateBooking, type DogDeclaration, type Violation } from './rules';
import { services, type ServiceId } from '@/config/business';

export interface SubmissionFields {
  readonly service: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly dogName: string;
  readonly breed: string;
  readonly birthDate: string;
  readonly sex: string;
  readonly microchip: string;
  readonly insurancePolicy: string;
  readonly vetName: string;
  readonly vetPhone: string;
  readonly foodNotes: string;
  readonly allergies: string;
  readonly medications: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly phone: string;
  readonly address: string;
  readonly notes: string;
  readonly inHeatOrNear: boolean;
  readonly hasMicrochip: boolean;
  readonly hasHealthRecord: boolean;
  readonly hasInsurance: boolean;
  readonly hasVaccinations: boolean;
  readonly hasParasiteTreatment: boolean;
  readonly isHealthy: boolean;
  readonly knowsBaseCommands: boolean;
  readonly hasAggressionHistory: boolean;
  readonly acceptedRules: boolean;
  readonly acceptedPrivacy: boolean;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^[+\d][\d\s./()-]{6,24}$/;
const MICROCHIP = /^\d{15}$/;

export function readSubmission(form: FormData): SubmissionFields {
  const text = (key: string) => String(form.get(key) ?? '').trim();
  const flag = (key: string) => form.get(key) === 'on' || form.get(key) === 'true';

  return {
    service: text('service'),
    startDate: text('startDate'),
    endDate: text('endDate'),
    dogName: text('dogName'),
    breed: text('breed'),
    birthDate: text('birthDate'),
    sex: text('sex'),
    microchip: text('microchip').replace(/\s/g, ''),
    insurancePolicy: text('insurancePolicy'),
    vetName: text('vetName'),
    vetPhone: text('vetPhone'),
    foodNotes: text('foodNotes'),
    allergies: text('allergies'),
    medications: text('medications'),
    firstName: text('firstName'),
    lastName: text('lastName'),
    email: text('email').toLowerCase(),
    phone: text('phone'),
    address: text('address'),
    notes: text('notes'),
    inHeatOrNear: flag('inHeatOrNear'),
    hasMicrochip: flag('hasMicrochip'),
    hasHealthRecord: flag('hasHealthRecord'),
    hasInsurance: flag('hasInsurance'),
    hasVaccinations: flag('hasVaccinations'),
    hasParasiteTreatment: flag('hasParasiteTreatment'),
    isHealthy: flag('isHealthy'),
    knowsBaseCommands: flag('knowsBaseCommands'),
    hasAggressionHistory: flag('hasAggressionHistory'),
    acceptedRules: flag('acceptedRules'),
    acceptedPrivacy: flag('acceptedPrivacy'),
  };
}

export interface PreparedBooking {
  readonly service: ServiceId;
  readonly startDay: number;
  readonly endDay: number;
  readonly occupies: { from: number; toExclusive: number };
  readonly priceCents: number;
  readonly dog: DogDeclaration;
  readonly birthDay: number;
}

export type PreparationResult =
  | { readonly ok: true; readonly booking: PreparedBooking }
  | { readonly ok: false; readonly violations: readonly Violation[] };

function isServiceId(value: string): value is ServiceId {
  return value in services;
}

export function prepareBooking(fields: SubmissionFields, todayDay = todayInBusinessTimezone()): PreparationResult {
  const violations: Violation[] = [];

  if (!isServiceId(fields.service)) {
    return {
      ok: false,
      violations: [{ code: 'unknown-service', field: 'service', message: 'Seleziona un servizio valido.' }],
    };
  }

  const startDay = parseDay(fields.startDate);
  if (startDay === null) {
    violations.push({ code: 'invalid-range', field: 'startDate', message: 'Seleziona la data di consegna.' });
  }

  const parsedEnd = parseDay(fields.endDate);
  const birthDay = parseDay(fields.birthDate);

  if (!fields.dogName) {
    violations.push({ code: 'invalid-range', field: 'dogName', message: 'Indica il nome del cane.' });
  }
  if (!MICROCHIP.test(fields.microchip)) {
    violations.push({
      code: 'missing-microchip',
      field: 'microchip',
      message: 'Il numero di microchip deve essere di 15 cifre.',
    });
  }
  if (fields.sex !== 'M' && fields.sex !== 'F') {
    violations.push({ code: 'invalid-range', field: 'sex', message: 'Indica il sesso del cane.' });
  }
  if (!fields.firstName || !fields.lastName) {
    violations.push({ code: 'invalid-range', field: 'firstName', message: 'Indica nome e cognome.' });
  }
  if (!EMAIL.test(fields.email)) {
    violations.push({ code: 'invalid-range', field: 'email', message: 'Indica un indirizzo email valido.' });
  }
  if (!PHONE.test(fields.phone)) {
    violations.push({ code: 'invalid-range', field: 'phone', message: 'Indica un numero di telefono valido.' });
  }

  if (startDay === null) return { ok: false, violations };

  const dog: DogDeclaration = {
    birthDay,
    sex: fields.sex === 'F' ? 'F' : 'M',
    inHeatOrNear: fields.inHeatOrNear,
    hasMicrochip: fields.hasMicrochip,
    hasHealthRecord: fields.hasHealthRecord,
    hasInsurance: fields.hasInsurance,
    hasVaccinations: fields.hasVaccinations,
    hasParasiteTreatment: fields.hasParasiteTreatment,
    isHealthy: fields.isHealthy,
    knowsBaseCommands: fields.knowsBaseCommands,
    hasAggressionHistory: fields.hasAggressionHistory,
  };

  const endDay = departureDayFor(fields.service, startDay, parsedEnd ?? startDay);

  violations.push(
    ...validateBooking(
      {
        service: fields.service,
        startDay,
        endDay,
        dog,
        acceptedRules: fields.acceptedRules,
        acceptedPrivacy: fields.acceptedPrivacy,
      },
      todayDay,
    ),
  );

  if (violations.length > 0) return { ok: false, violations };

  return {
    ok: true,
    booking: {
      service: fields.service,
      startDay,
      endDay,
      occupies: occupancySpanFor(fields.service, startDay, endDay),
      priceCents: quote(fields.service, startDay, endDay).totalCents,
      dog,
      birthDay: birthDay!,
    },
  };
}

const REFERENCE_ALPHABET = 'ACDEFGHJKLMNPQRTUVWXY34679';

export function bookingReference(seed: Uint8Array): string {
  let out = 'KIN-';
  for (let index = 0; index < 6; index += 1) {
    out += REFERENCE_ALPHABET[(seed[index] ?? 0) % REFERENCE_ALPHABET.length];
  }
  return out;
}

export { spanIsAvailable };
