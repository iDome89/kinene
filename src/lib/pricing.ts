import { billableUnits, departureDayFor } from './availability';
import { rangeTouchesHighSeason } from './season';
import { business, services, type ServiceId } from '@/config/business';
import { plural } from './plural';

export interface QuoteLine {
  readonly label: string;
  readonly quantity: number;
  readonly unitCents: number;
  readonly totalCents: number;
}

export interface Quote {
  readonly service: ServiceId;
  readonly startDay: number;
  readonly endDay: number;
  readonly units: number;
  readonly unitLabel: 'giorno' | 'notte';
  readonly dogCount: number;
  readonly sharedSpace: boolean;
  readonly lines: readonly QuoteLine[];
  readonly totalCents: number;
  readonly touchesHighSeason: boolean;
}

/*
  Il primo cane paga pieno. Dal secondo in poi lo sconto vale solo se
  condividono lo spazio: cani separati occupano due strutture e costano due.
*/
export function quote(
  service: ServiceId,
  startDay: number,
  requestedEndDay: number,
  dogCount = 1,
  sharedSpace = false,
): Quote {
  const definition = services[service];
  const endDay = departureDayFor(service, startDay, requestedEndDay);
  const units = Math.max(0, billableUnits(service, startDay, endDay));
  const dogs = Math.max(1, Math.trunc(dogCount));
  const many = definition.priceUnit === 'notte' ? 'notti' : 'giorni';
  const duration = plural(units, definition.priceUnit, many);

  const lines: QuoteLine[] = [
    {
      label: `${definition.name} — ${duration}`,
      quantity: units,
      unitCents: definition.priceCents,
      totalCents: units * definition.priceCents,
    },
  ];

  if (dogs > 1) {
    const ratio = sharedSpace ? business.capacity.additionalDogSharedRatio : 1;
    const unitCents = Math.round(definition.priceCents * ratio);
    const extra = dogs - 1;
    const who = extra === 1 ? 'Secondo cane' : `Altri ${extra} cani`;
    lines.push({
      label: `${who} ${sharedSpace ? 'nello stesso spazio' : 'in spazio separato'} — ${duration}`,
      quantity: units * extra,
      unitCents,
      totalCents: units * extra * unitCents,
    });
  }

  return {
    service,
    startDay,
    endDay,
    units,
    unitLabel: definition.priceUnit,
    dogCount: dogs,
    sharedSpace: dogs > 1 && sharedSpace,
    lines,
    totalCents: lines.reduce((sum, line) => sum + line.totalCents, 0),
    touchesHighSeason: rangeTouchesHighSeason(startDay, endDay + 1),
  };
}

export function formatEuro(cents: number): string {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}
