import { civilFromDay } from './dates';
import { billableUnits, departureDayFor } from './availability';
import { isHighSeason, rangeTouchesHighSeason } from './season';
import { policy, services, type ServiceId } from '@/config/business';

export type ViolationCode =
  | 'unknown-service'
  | 'invalid-range'
  | 'start-in-past'
  | 'too-many-units'
  | 'missing-emergency-contacts'
  | 'dog-too-young'
  | 'female-in-heat'
  | 'missing-microchip'
  | 'missing-health-record'
  | 'missing-insurance'
  | 'missing-vaccinations'
  | 'missing-parasite-treatment'
  | 'contagious-or-injured'
  | 'missing-base-commands'
  | 'aggression-declared'
  | 'rules-not-accepted'
  | 'privacy-not-accepted';

export interface Violation {
  readonly code: ViolationCode;
  readonly field: string;
  readonly message: string;
  /* Presente solo per le regole sul singolo cane, cosi' il modulo sa dove segnarle. */
  readonly dogIndex?: number;
}

export interface DogDeclaration {
  readonly birthDay: number | null;
  readonly sex: 'M' | 'F';
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

export interface EmergencyContact {
  readonly firstName: string;
  readonly lastName: string;
  readonly phone: string;
}

export interface BookingRequest {
  readonly service: ServiceId;
  readonly startDay: number;
  readonly endDay: number;
  readonly dogs: readonly DogDeclaration[];
  readonly emergencyContacts: readonly EmergencyContact[];
  readonly acceptedRules: boolean;
  readonly acceptedPrivacy: boolean;
}

const CONTACT_PHONE = /^[+\d][\d\s./()-]{6,24}$/;

export function isCompleteContact(contact: EmergencyContact): boolean {
  return (
    contact.firstName.trim().length > 0 &&
    contact.lastName.trim().length > 0 &&
    CONTACT_PHONE.test(contact.phone.trim())
  );
}

export function completeContacts(contacts: readonly EmergencyContact[]): EmergencyContact[] {
  return contacts.filter(isCompleteContact);
}

export function monthsBetween(fromDay: number, toDay: number): number {
  const from = civilFromDay(fromDay);
  const to = civilFromDay(toDay);
  const months = (to.year - from.year) * 12 + (to.month - from.month);
  return to.day < from.day ? months - 1 : months;
}

export function ageInMonthsAtCheckIn(birthDay: number, startDay: number): number {
  return monthsBetween(birthDay, startDay);
}

export function maxUnitsFor(service: ServiceId): number {
  return services[service].maxUnits;
}

export function cancellationNoticeDays(startDay: number, endDay: number): number {
  return rangeTouchesHighSeason(startDay, endDay + 1)
    ? policy.highSeasonCancellationDays
    : policy.standardCancellationDays;
}

export interface CancellationOutcome {
  readonly feeCents: number;
  readonly refundCents: number;
  readonly requiredNoticeDays: number;
  readonly actualNoticeDays: number;
  readonly withinFreeWindow: boolean;
}

export function cancellationOutcome(
  totalCents: number,
  startDay: number,
  endDay: number,
  cancelledOnDay: number,
): CancellationOutcome {
  const requiredNoticeDays = cancellationNoticeDays(startDay, endDay);
  const actualNoticeDays = startDay - cancelledOnDay;
  const withinFreeWindow = actualNoticeDays >= requiredNoticeDays;
  const feeCents = withinFreeWindow ? 0 : Math.round(totalCents * policy.lateCancellationFeeRatio);
  return {
    feeCents,
    refundCents: totalCents - feeCents,
    requiredNoticeDays,
    actualNoticeDays,
    withinFreeWindow,
  };
}

/* Ogni cane risponde delle proprie regole: uno idoneo non salva l'altro. */
export function validateDog(dog: DogDeclaration, startDay: number, dogIndex: number): Violation[] {
  const violations: Violation[] = [];
  const mark = (code: ViolationCode, field: string, message: string) =>
    violations.push({ code, field, message, dogIndex });

  if (dog.birthDay === null) {
    mark('dog-too-young', 'birthDate', 'Indica la data di nascita del cane.');
  } else if (ageInMonthsAtCheckIn(dog.birthDay, startDay) < policy.minAgeMonths) {
    mark(
      'dog-too-young',
      'birthDate',
      'Non accettiamo cani al di sotto di un anno di età alla data di consegna: il cucciolo non ha ancora i comandi di base ed è troppo piccolo per stare senza il proprietario.',
    );
  }

  if (dog.sex === 'F' && dog.inHeatOrNear) {
    mark(
      'female-in-heat',
      'inHeatOrNear',
      'Non sono ammesse femmine in calore o in prossimità dell’inizio del calore.',
    );
  }

  if (!dog.hasMicrochip) {
    mark(
      'missing-microchip',
      'hasMicrochip',
      'Il microchip è obbligatorio e deve essere registrato all’anagrafe canina.',
    );
  }

  if (!dog.hasHealthRecord) {
    mark(
      'missing-health-record',
      'hasHealthRecord',
      'Il libretto sanitario aggiornato va consegnato all’arrivo.',
    );
  }

  if (!dog.hasInsurance) {
    mark(
      'missing-insurance',
      'hasInsurance',
      'È obbligatoria una polizza di responsabilità civile verso terzi in corso di validità.',
    );
  }

  if (!dog.hasVaccinations) {
    mark(
      'missing-vaccinations',
      'hasVaccinations',
      `Vaccinazioni obbligatorie: ${policy.requiredVaccinations.join(', ')}.`,
    );
  }

  if (!dog.hasParasiteTreatment) {
    mark(
      'missing-parasite-treatment',
      'hasParasiteTreatment',
      'Serve un trattamento antipulci, zecche e filaria attivo e certificato.',
    );
  }

  if (!dog.isHealthy) {
    mark(
      'contagious-or-injured',
      'isHealthy',
      'Non accettiamo cani con malattie contagiose, ferite aperte o punti di sutura.',
    );
  }

  if (!dog.knowsBaseCommands) {
    mark(
      'missing-base-commands',
      'knowsBaseCommands',
      `Il cane deve saper eseguire i comandi di base: ${policy.requiredCommands.join(', ')}.`,
    );
  }

  if (dog.hasAggressionHistory) {
    mark(
      'aggression-declared',
      'hasAggressionHistory',
      'Non accettiamo cani con problemi di aggressività, intolleranza o forte reattività.',
    );
  }

  return violations;
}

export function validateBooking(request: BookingRequest, todayDay: number): Violation[] {
  const violations: Violation[] = [];
  const definition = services[request.service];

  if (!definition) {
    return [{ code: 'unknown-service', field: 'service', message: 'Servizio non riconosciuto.' }];
  }

  const endDay = departureDayFor(request.service, request.startDay, request.endDay);

  if (endDay < request.startDay) {
    violations.push({
      code: 'invalid-range',
      field: 'endDate',
      message: 'La data di ritiro non può precedere quella di consegna.',
    });
  }

  if (request.startDay < todayDay) {
    violations.push({
      code: 'start-in-past',
      field: 'startDate',
      message: 'La data di consegna non può essere nel passato.',
    });
  }

  const maxUnits = definition.maxUnits;
  if (billableUnits(request.service, request.startDay, endDay) > maxUnits) {
    const unit = definition.priceUnit === 'giorno'
      ? maxUnits === 1 ? 'giorno' : 'giorni'
      : maxUnits === 1 ? 'notte' : 'notti';
    violations.push({
      code: 'too-many-units',
      field: 'endDate',
      message: `${definition.name}: la durata massima è di ${maxUnits} ${unit}.`,
    });
  }

  for (const [dogIndex, dog] of request.dogs.entries()) {
    violations.push(...validateDog(dog, request.startDay, dogIndex));
  }

  if (completeContacts(request.emergencyContacts).length < policy.minEmergencyContacts) {
    violations.push({
      code: 'missing-emergency-contacts',
      field: 'emergencyContacts',
      message: `Servono almeno ${policy.minEmergencyContacts} contatti di emergenza, ciascuno con nome, cognome e numero di telefono.`,
    });
  }

  if (!request.acceptedRules) {
    violations.push({
      code: 'rules-not-accepted',
      field: 'acceptedRules',
      message: 'Devi accettare il regolamento interno per procedere.',
    });
  }

  if (!request.acceptedPrivacy) {
    violations.push({
      code: 'privacy-not-accepted',
      field: 'acceptedPrivacy',
      message: 'Devi acconsentire al trattamento dei dati personali per procedere.',
    });
  }

  return violations;
}

export function isBlockingHighSeasonNotice(startDay: number, endDay: number, todayDay: number): boolean {
  return (
    rangeTouchesHighSeason(startDay, endDay + 1) &&
    startDay - todayDay < policy.highSeasonCancellationDays
  );
}

export { isHighSeason };
