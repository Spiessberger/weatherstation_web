export type Locale = 'de' | 'en';
export type WindUnit = 'mps' | 'kmh';

const localeTag = (locale: Locale) => (locale === 'de' ? 'de-AT' : 'en-GB');

export function number(value: number | null | undefined, locale: Locale, digits = 1): string {
  if (value == null || !Number.isFinite(value)) return '–';
  return new Intl.NumberFormat(localeTag(locale), {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export const temperature = (value: number | null | undefined, locale: Locale) =>
  value == null ? '–' : `${number(value, locale)} °C`;
export const percent = (value: number | null | undefined, locale: Locale) =>
  value == null ? '–' : `${number(value, locale, 0)} %`;
export const windUnitLabel = (unit: WindUnit) => (unit === 'kmh' ? 'km/h' : 'm/s');
export const windSpeed = (mps: number | null | undefined, unit: WindUnit) =>
  mps == null ? null : unit === 'kmh' ? mps * 3.6 : mps;
/** Formats a speed already expressed in `unit`. */
export const windInUnit = (value: number | null | undefined, locale: Locale, unit: WindUnit) =>
  value == null ? '–' : `${number(value, locale)} ${windUnitLabel(unit)}`;
/** Formats a station speed reported in m/s, converted to `unit`. */
export const wind = (mps: number | null | undefined, locale: Locale, unit: WindUnit) =>
  windInUnit(windSpeed(mps, unit), locale, unit);
export const rain = (value: number | null | undefined, locale: Locale) =>
  value == null ? '–' : `${number(value, locale)} mm`;
export const lux = (value: number | null | undefined, locale: Locale) =>
  value == null ? '–' : `${new Intl.NumberFormat(localeTag(locale), { maximumFractionDigits: 0 }).format(value)} lx`;

export function dateTime(timestamp: number | null | undefined, locale: Locale, timezone: string): string {
  if (timestamp == null) return '–';
  return new Intl.DateTimeFormat(localeTag(locale), {
    timeZone: timezone,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(timestamp);
}

export function dateTimeSeconds(timestamp: number, locale: Locale, timezone: string): string {
  return new Intl.DateTimeFormat(localeTag(locale), {
    timeZone: timezone,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(timestamp);
}

export function calendarDate(date: string, locale: Locale): string {
  return new Intl.DateTimeFormat(localeTag(locale), { dateStyle: 'medium', timeZone: 'UTC' })
    .format(new Date(`${date}T12:00:00Z`));
}

export function time(timestamp: number, locale: Locale, timezone: string): string {
  return new Intl.DateTimeFormat(localeTag(locale), {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp);
}

export function stationDate(timestamp: number, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(timestamp);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function addCalendarDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return shifted.toISOString().slice(0, 10);
}

export function relativeAge(timestamp: number, now: number, locale: Locale): string {
  const seconds = Math.max(0, Math.round((now - timestamp) / 1000));
  const formatter = new Intl.RelativeTimeFormat(localeTag(locale), { numeric: 'auto' });
  if (seconds < 60) return formatter.format(-seconds, 'second');
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return formatter.format(-minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (hours < 48) return formatter.format(-hours, 'hour');
  return formatter.format(-Math.round(hours / 24), 'day');
}

export function cardinalDirection(degrees: number | null | undefined, locale: Locale): string {
  if (degrees == null) return '–';
  const de = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'];
  const en = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return (locale === 'de' ? de : en)[Math.round(((degrees % 360) + 360) % 360 / 45) % 8];
}
