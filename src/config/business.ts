export const NEEDS_CONFIRMATION = Symbol('needs-confirmation');

export const business = {
  legalName: 'Kinene di Valeria Borda',
  tradeName: 'Kinene',
  tagline: 'Allevamento Cane Corso',
  vatNumber: '',
  reaNumber: '',

  contact: {
    personName: 'Valeria Borda',
    phone: '+393513458298',
    phoneDisplay: '351 345 8298',
    whatsapp: '393513458298',
    email: '',
    instagram: 'kinene_breeder',
    instagramUrl: 'https://instagram.com/kinene_breeder',
  },

  address: {
    street: 'Via Giuseppe Garibaldi 138',
    locality: 'Guiglia',
    province: 'MO',
    region: 'Emilia-Romagna',
    postalCode: '41052',
    country: 'IT',
    latitude: 44.3856,
    longitude: 10.9628,
  },

  capacity: {
    defaultMaxDogs: 8,
    closedWeekdays: [] as number[],
  },
} as const;

export const openingHours = {
  weekdays: {
    label: 'Lunedì — Venerdì',
    slots: [
      { from: '10:00', to: '12:30' },
      { from: '15:30', to: '18:30' },
    ],
    schemaDays: [
      'https://schema.org/Monday',
      'https://schema.org/Tuesday',
      'https://schema.org/Wednesday',
      'https://schema.org/Thursday',
      'https://schema.org/Friday',
    ],
  },
  weekend: {
    label: 'Sabato e Domenica',
    note: 'solo su appuntamento',
    schemaDays: ['https://schema.org/Saturday', 'https://schema.org/Sunday'],
  },
} as const;

export const weekdayHoursText = openingHours.weekdays.slots
  .map((slot) => `${slot.from}—${slot.to}`)
  .join(' · ');

export type ServiceId = 'asilo-diurno' | 'asilo-notturno' | 'pensione';

export interface ServiceDefinition {
  readonly id: ServiceId;
  readonly name: string;
  readonly shortName: string;
  readonly summary: string;
  readonly checkInFrom: string;
  readonly checkInTo: string;
  readonly checkOutFrom: string;
  readonly checkOutTo: string;
  readonly checkOutNextDay: boolean;
  readonly maxNights: number | null;
  readonly priceCents: number;
  readonly priceUnit: 'giorno' | 'notte';
}

export const services: Readonly<Record<ServiceId, ServiceDefinition>> = {
  'asilo-diurno': {
    id: 'asilo-diurno',
    name: 'Asilo diurno',
    shortName: 'Diurno',
    summary:
      'Il tuo cane trascorre la giornata con noi: gioco, socializzazione controllata e riposo, con la sua routine di sempre.',
    checkInFrom: '10:00',
    checkInTo: '12:00',
    checkOutFrom: '18:00',
    checkOutTo: '20:00',
    checkOutNextDay: false,
    maxNights: null,
    priceCents: 2500,
    priceUnit: 'giorno',
  },
  'asilo-notturno': {
    id: 'asilo-notturno',
    name: 'Asilo notturno',
    shortName: 'Notturno',
    summary:
      'Consegna la sera, ritiro la mattina successiva. Per chi ha bisogno di una sola notte in mani sicure.',
    checkInFrom: '18:00',
    checkInTo: '20:00',
    checkOutFrom: '10:00',
    checkOutTo: '12:00',
    checkOutNextDay: true,
    maxNights: 1,
    priceCents: 3000,
    priceUnit: 'notte',
  },
  pensione: {
    id: 'pensione',
    name: 'Pensione',
    shortName: 'Pensione',
    summary:
      'Soggiorni fino a due settimane. Spazi ampi, routine personalizzata e aggiornamenti costanti sul tuo cane.',
    checkInFrom: '08:00',
    checkInTo: '12:00',
    checkOutFrom: '10:00',
    checkOutTo: '12:00',
    checkOutNextDay: true,
    maxNights: 14,
    priceCents: 3000,
    priceUnit: 'notte',
  },
} as const;

export const serviceList: readonly ServiceDefinition[] = [
  services['asilo-diurno'],
  services['asilo-notturno'],
  services.pensione,
];

export const policy = {
  minAgeMonths: 12,
  standardCancellationDays: 7,
  highSeasonCancellationDays: 14,
  lateCancellationFeeRatio: 0.5,
  forcedRemovalPenaltyCents: 5000,
  forcedRemovalCollectionHours: 12,
  scheduleChangeNoticeHours: 24,
  emergencyClinic: 'Clinica Veterinaria Modena Sud',
  requiredCommands: ['vieni', 'siedi', 'resta', 'terra'],
  requiredVaccinations: ['Eptavalente', 'Tosse dei canili (Bordetella)'],
} as const;

export const highSeason = {
  august: { fromMonth: 8, fromDay: 1, toMonth: 8, toDay: 31 },
  christmas: { fromMonth: 12, fromDay: 20, toMonth: 1, toDay: 6 },
  easterDaysBefore: 3,
  easterDaysAfter: 1,
} as const;
