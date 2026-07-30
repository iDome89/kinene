import { billableUnits, departureDayFor } from './availability';
import { rangeTouchesHighSeason } from './season';
import { services, type ServiceId } from '@/config/business';

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
  readonly lines: readonly QuoteLine[];
  readonly totalCents: number;
  readonly touchesHighSeason: boolean;
}

export function quote(service: ServiceId, startDay: number, requestedEndDay: number): Quote {
  const definition = services[service];
  const endDay = departureDayFor(service, startDay, requestedEndDay);
  const units = Math.max(0, billableUnits(service, startDay, endDay));
  const totalCents = units * definition.priceCents;
  const plural = definition.priceUnit === 'notte' ? 'notti' : 'giorni';

  return {
    service,
    startDay,
    endDay,
    units,
    unitLabel: definition.priceUnit,
    lines: [
      {
        label: `${definition.name} — ${units} ${units === 1 ? definition.priceUnit : plural}`,
        quantity: units,
        unitCents: definition.priceCents,
        totalCents,
      },
    ],
    totalCents,
    touchesHighSeason: rangeTouchesHighSeason(startDay, endDay + 1),
  };
}

export function formatEuro(cents: number): string {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}
