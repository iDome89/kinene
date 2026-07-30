export const MS_PER_DAY = 86_400_000;
export const BUSINESS_TIMEZONE = 'Europe/Rome';

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  return month === 2 && isLeapYear(year) ? 29 : (DAYS_IN_MONTH[month - 1] ?? 0);
}

export interface CivilDate {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

export function dayFromCivil(year: number, month: number, day: number): number {
  return Date.UTC(year, month - 1, day) / MS_PER_DAY;
}

export function civilFromDay(dayNumber: number): CivilDate {
  const d = new Date(dayNumber * MS_PER_DAY);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

export function isValidCivilDate(year: number, month: number, day: number): boolean {
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}

export function parseDay(iso: string): number | null {
  const parts = ISO_DATE.exec(iso);
  if (!parts) return null;
  const year = Number(parts[1]);
  const month = Number(parts[2]);
  const day = Number(parts[3]);
  if (!isValidCivilDate(year, month, day)) return null;
  return dayFromCivil(year, month, day);
}

export function formatDay(dayNumber: number): string {
  const { year, month, day } = civilFromDay(dayNumber);
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function weekdayOf(dayNumber: number): number {
  return (((dayNumber + 4) % 7) + 7) % 7;
}

export function addDays(dayNumber: number, delta: number): number {
  return dayNumber + delta;
}

export function startOfMonth(dayNumber: number): number {
  const { year, month } = civilFromDay(dayNumber);
  return dayFromCivil(year, month, 1);
}

export function endOfMonth(dayNumber: number): number {
  const { year, month } = civilFromDay(dayNumber);
  return dayFromCivil(year, month, daysInMonth(year, month));
}

export function todayInBusinessTimezone(now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  return parseDay(parts) ?? Math.floor(now.getTime() / MS_PER_DAY);
}

const MONTHS_IT = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
];

const WEEKDAYS_IT = [
  'domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato',
];

export function monthNameIt(month: number): string {
  return MONTHS_IT[month - 1] ?? '';
}

export function weekdayNameIt(dayNumber: number): string {
  return WEEKDAYS_IT[weekdayOf(dayNumber)] ?? '';
}

export function formatDayIt(dayNumber: number): string {
  const { year, month, day } = civilFromDay(dayNumber);
  return `${day} ${monthNameIt(month)} ${year}`;
}

export function formatDayShortIt(dayNumber: number): string {
  const { year, month, day } = civilFromDay(dayNumber);
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
}
