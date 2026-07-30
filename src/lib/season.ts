import { civilFromDay, dayFromCivil } from './dates';
import { highSeason } from '@/config/business';

export function easterSunday(year: number): number {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return dayFromCivil(year, month, day);
}

function withinWrappingWindow(
  month: number,
  day: number,
  fromMonth: number,
  fromDay: number,
  toMonth: number,
  toDay: number,
): boolean {
  const value = month * 100 + day;
  const from = fromMonth * 100 + fromDay;
  const to = toMonth * 100 + toDay;
  return from <= to ? value >= from && value <= to : value >= from || value <= to;
}

export function isHighSeason(dayNumber: number): boolean {
  const { year, month, day } = civilFromDay(dayNumber);

  if (withinWrappingWindow(month, day, highSeason.august.fromMonth, highSeason.august.fromDay, highSeason.august.toMonth, highSeason.august.toDay)) {
    return true;
  }
  if (withinWrappingWindow(month, day, highSeason.christmas.fromMonth, highSeason.christmas.fromDay, highSeason.christmas.toMonth, highSeason.christmas.toDay)) {
    return true;
  }

  for (const candidateYear of [year - 1, year, year + 1]) {
    const easter = easterSunday(candidateYear);
    if (dayNumber >= easter - highSeason.easterDaysBefore && dayNumber <= easter + highSeason.easterDaysAfter) {
      return true;
    }
  }
  return false;
}

export function rangeTouchesHighSeason(fromDay: number, toDayExclusive: number): boolean {
  for (let day = fromDay; day < toDayExclusive; day += 1) {
    if (isHighSeason(day)) return true;
  }
  return false;
}
