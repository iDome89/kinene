import { weekdayOf } from './dates';
import type { ServiceId } from '@/config/business';

export interface DaySpan {
  readonly from: number;
  readonly toExclusive: number;
}

export interface CapacityOverride {
  readonly day: number;
  readonly maxDogs: number;
}

export interface OccupancyInput {
  readonly originDay: number;
  readonly dayCount: number;
  readonly defaultCapacity: number;
  readonly closedWeekdays?: readonly number[];
  readonly occupied?: readonly DaySpan[];
  readonly blackouts?: readonly DaySpan[];
  readonly capacityOverrides?: readonly CapacityOverride[];
}

export interface OccupancyGrid {
  readonly originDay: number;
  readonly dayCount: number;
  readonly counts: Int16Array;
  readonly capacity: Int16Array;
}

export type UnavailableReason = 'out-of-range' | 'closed' | 'full';

export interface DayAvailability {
  readonly day: number;
  readonly taken: number;
  readonly capacity: number;
  readonly available: boolean;
  readonly reason: UnavailableReason | null;
}

export function occupancySpanFor(service: ServiceId, startDay: number, endDay: number): DaySpan {
  if (service === 'asilo-notturno') return { from: startDay, toExclusive: startDay + 2 };
  return { from: startDay, toExclusive: endDay + 1 };
}

export function departureDayFor(service: ServiceId, startDay: number, requestedEndDay: number): number {
  if (service === 'asilo-notturno') return startDay + 1;
  if (service === 'asilo-diurno') return Math.max(startDay, requestedEndDay);
  return requestedEndDay;
}

export function billableUnits(service: ServiceId, startDay: number, endDay: number): number {
  if (service === 'asilo-diurno') return endDay - startDay + 1;
  return endDay - startDay;
}

export function buildOccupancy(input: OccupancyInput): OccupancyGrid {
  const { originDay, dayCount, defaultCapacity } = input;
  const counts = new Int16Array(dayCount);
  const capacity = new Int16Array(dayCount);
  capacity.fill(defaultCapacity);

  const closedWeekdays = input.closedWeekdays;
  if (closedWeekdays && closedWeekdays.length > 0) {
    for (let index = 0; index < dayCount; index += 1) {
      if (closedWeekdays.includes(weekdayOf(originDay + index))) capacity[index] = 0;
    }
  }

  for (const override of input.capacityOverrides ?? []) {
    const index = override.day - originDay;
    if (index >= 0 && index < dayCount) capacity[index] = override.maxDogs;
  }

  for (const blackout of input.blackouts ?? []) {
    const from = Math.max(0, blackout.from - originDay);
    const to = Math.min(dayCount, blackout.toExclusive - originDay);
    for (let index = from; index < to; index += 1) capacity[index] = 0;
  }

  for (const span of input.occupied ?? []) {
    const from = Math.max(0, span.from - originDay);
    const to = Math.min(dayCount, span.toExclusive - originDay);
    for (let index = from; index < to; index += 1) counts[index] = (counts[index] ?? 0) + 1;
  }

  return { originDay, dayCount, counts, capacity };
}

export function inspectDay(grid: OccupancyGrid, day: number): DayAvailability {
  const index = day - grid.originDay;
  if (index < 0 || index >= grid.dayCount) {
    return { day, taken: 0, capacity: 0, available: false, reason: 'out-of-range' };
  }
  const capacity = grid.capacity[index] ?? 0;
  const taken = grid.counts[index] ?? 0;
  if (capacity <= 0) return { day, taken, capacity, available: false, reason: 'closed' };
  if (taken >= capacity) return { day, taken, capacity, available: false, reason: 'full' };
  return { day, taken, capacity, available: true, reason: null };
}

export function firstUnavailableDay(grid: OccupancyGrid, from: number, toExclusive: number): DayAvailability | null {
  for (let day = from; day < toExclusive; day += 1) {
    const status = inspectDay(grid, day);
    if (!status.available) return status;
  }
  return null;
}

export function spanIsAvailable(grid: OccupancyGrid, span: DaySpan): boolean {
  return firstUnavailableDay(grid, span.from, span.toExclusive) === null;
}

export function availabilityWindow(grid: OccupancyGrid): DayAvailability[] {
  const window: DayAvailability[] = new Array(grid.dayCount);
  for (let index = 0; index < grid.dayCount; index += 1) {
    window[index] = inspectDay(grid, grid.originDay + index);
  }
  return window;
}
