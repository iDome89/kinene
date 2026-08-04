import {
  departureDayFor,
  occupancySpanFor,
  spanHasRoom,
  spanIsAvailable,
  type DaySpan,
} from './availability';
import { parseDay, todayInBusinessTimezone } from './dates';
import { quote } from './pricing';
import {
  completeContacts,
  validateBooking,
  type DogDeclaration,
  type EmergencyContact,
  type Violation,
} from './rules';
import { business, services, type ServiceId } from '@/config/business';

export interface DogFields {
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
  readonly inHeatOrNear: boolean;
  readonly hasMicrochip: boolean;
  readonly hasHealthRecord: boolean;
  readonly hasInsurance: boolean;
  readonly hasVaccinations: boolean;
  readonly hasParasiteTreatment: boolean;
  readonly isHealthy: boolean;
  readonly knowsBaseCommands: boolean;
  readonly hasAggressionHistory: boolean;
}

export interface SubmissionFields {
  readonly service: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly dogs: readonly DogFields[];
  readonly sharedSpace: boolean;
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly phone: string;
  readonly address: string;
  readonly notes: string;
  readonly emergencyContacts: readonly EmergencyContact[];
  readonly acceptedRules: boolean;
  readonly acceptedPrivacy: boolean;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^[+\d][\d\s./()-]{6,24}$/;
const MICROCHIP = /^\d{15}$/;

export const EMERGENCY_CONTACT_SLOTS = 3;
export const DOG_SLOTS = business.capacity.maxDogsPerBooking;

export function readSubmission(form: FormData): SubmissionFields {
  const text = (key: string) => String(form.get(key) ?? '').trim();
  const flag = (key: string) => form.get(key) === 'on' || form.get(key) === 'true';

  const emergencyContacts: EmergencyContact[] = [];
  for (let slot = 0; slot < EMERGENCY_CONTACT_SLOTS; slot += 1) {
    const contact = {
      firstName: text(`emergencyFirstName${slot}`),
      lastName: text(`emergencyLastName${slot}`),
      phone: text(`emergencyPhone${slot}`),
    };
    if (contact.firstName || contact.lastName || contact.phone) emergencyContacts.push(contact);
  }

  /* Slot vuoti scartati come per i contatti: il primo cane resta comunque obbligatorio. */
  const dogSlots: DogFields[] = [];
  for (let slot = 0; slot < DOG_SLOTS; slot += 1) {
    const dog: DogFields = {
      dogName: text(`dogName${slot}`),
      breed: text(`breed${slot}`),
      birthDate: text(`birthDate${slot}`),
      sex: text(`sex${slot}`),
      microchip: text(`microchip${slot}`).replace(/\s/g, ''),
      insurancePolicy: text(`insurancePolicy${slot}`),
      vetName: text(`vetName${slot}`),
      vetPhone: text(`vetPhone${slot}`),
      foodNotes: text(`foodNotes${slot}`),
      allergies: text(`allergies${slot}`),
      medications: text(`medications${slot}`),
      inHeatOrNear: flag(`inHeatOrNear${slot}`),
      hasMicrochip: flag(`hasMicrochip${slot}`),
      hasHealthRecord: flag(`hasHealthRecord${slot}`),
      hasInsurance: flag(`hasInsurance${slot}`),
      hasVaccinations: flag(`hasVaccinations${slot}`),
      hasParasiteTreatment: flag(`hasParasiteTreatment${slot}`),
      isHealthy: flag(`isHealthy${slot}`),
      knowsBaseCommands: flag(`knowsBaseCommands${slot}`),
      hasAggressionHistory: flag(`hasAggressionHistory${slot}`),
    };
    if (slot === 0 || dog.dogName || dog.microchip || dog.birthDate) dogSlots.push(dog);
  }

  return {
    service: text('service'),
    startDate: text('startDate'),
    endDate: text('endDate'),
    dogs: dogSlots,
    sharedSpace: flag('sharedSpace'),
    firstName: text('firstName'),
    lastName: text('lastName'),
    email: text('email').toLowerCase(),
    phone: text('phone'),
    address: text('address'),
    notes: text('notes'),
    emergencyContacts,
    acceptedRules: flag('acceptedRules'),
    acceptedPrivacy: flag('acceptedPrivacy'),
  };
}

export interface PreparedDog {
  readonly fields: DogFields;
  readonly declaration: DogDeclaration;
  readonly birthDay: number;
}

export interface PreparedBooking {
  readonly service: ServiceId;
  readonly startDay: number;
  readonly endDay: number;
  readonly occupies: DaySpan;
  readonly priceCents: number;
  readonly dogs: readonly PreparedDog[];
  readonly sharedSpace: boolean;
  readonly emergencyContacts: readonly EmergencyContact[];
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

  fields.dogs.forEach((dog, dogIndex) => {
    if (!dog.dogName) {
      violations.push({ code: 'invalid-range', field: 'dogName', message: 'Indica il nome del cane.', dogIndex });
    }
    if (!MICROCHIP.test(dog.microchip)) {
      violations.push({
        code: 'missing-microchip',
        field: 'microchip',
        message: 'Il numero di microchip deve essere di 15 cifre.',
        dogIndex,
      });
    }
    if (dog.sex !== 'M' && dog.sex !== 'F') {
      violations.push({ code: 'invalid-range', field: 'sex', message: 'Indica il sesso del cane.', dogIndex });
    }
  });

  /* Lo stesso cane due volte occuperebbe due posti per un animale solo. */
  const chips = fields.dogs.map((dog) => dog.microchip).filter((chip) => MICROCHIP.test(chip));
  if (new Set(chips).size < chips.length) {
    violations.push({
      code: 'invalid-range',
      field: 'microchip',
      message: 'Hai indicato lo stesso microchip per due cani.',
      dogIndex: 1,
    });
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

  const prepared: PreparedDog[] = fields.dogs.map((dog) => ({
    fields: dog,
    birthDay: parseDay(dog.birthDate) ?? 0,
    declaration: {
      birthDay: parseDay(dog.birthDate),
      sex: dog.sex === 'F' ? 'F' : 'M',
      inHeatOrNear: dog.inHeatOrNear,
      hasMicrochip: dog.hasMicrochip,
      hasHealthRecord: dog.hasHealthRecord,
      hasInsurance: dog.hasInsurance,
      hasVaccinations: dog.hasVaccinations,
      hasParasiteTreatment: dog.hasParasiteTreatment,
      isHealthy: dog.isHealthy,
      knowsBaseCommands: dog.knowsBaseCommands,
      hasAggressionHistory: dog.hasAggressionHistory,
    },
  }));

  const endDay = departureDayFor(fields.service, startDay, parsedEnd ?? startDay);

  violations.push(
    ...validateBooking(
      {
        service: fields.service,
        startDay,
        endDay,
        dogs: prepared.map((dog) => dog.declaration),
        emergencyContacts: fields.emergencyContacts,
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
      occupies: {
        ...occupancySpanFor(fields.service, startDay, endDay),
        weight: prepared.length,
      },
      priceCents: quote(fields.service, startDay, endDay, prepared.length, fields.sharedSpace).totalCents,
      dogs: prepared,
      sharedSpace: prepared.length > 1 && fields.sharedSpace,
      emergencyContacts: completeContacts(fields.emergencyContacts),
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

export { spanHasRoom, spanIsAvailable };
