import { describe, expect, it } from 'vitest';
import { addCalendarDays, calendarDate, calendarDaysInclusive, cardinalDirection, dateTimeSeconds, number, stationDate, temperature } from './format';

describe('weather formatting', () => {
  it('keeps unavailable values distinct from zero', () => {
    expect(temperature(null, 'de')).toBe('–');
    expect(temperature(0, 'de')).toBe('0,0 °C');
  });

  it('uses the explicitly selected locale', () => {
    expect(number(1234.5, 'de')).toMatch(/^1[.\u00a0]234,5$/);
    expect(number(1234.5, 'en')).toBe('1,234.5');
    expect(calendarDate('2026-09-24', 'de')).toMatch(/24\.09\.2026|24\. Sept\. 2026/);
  });

  it('uses station timezone instead of the browser timezone', () => {
    expect(stationDate(Date.parse('2026-03-28T23:30:00Z'), 'Europe/Vienna')).toBe('2026-03-29');
    expect(stationDate(Date.parse('2026-03-28T23:30:00Z'), 'America/Los_Angeles')).toBe('2026-03-28');
  });

  it('formats table reception times with seconds', () => {
    expect(dateTimeSeconds(Date.parse('2026-09-24T15:04:20Z'), 'en', 'Europe/Vienna')).toContain('17:04:20');
  });

  it('does calendar date arithmetic without DST assumptions', () => {
    expect(addCalendarDays('2026-03-29', 1)).toBe('2026-03-30');
    expect(addCalendarDays('2026-10-25', -1)).toBe('2026-10-24');
    expect(calendarDaysInclusive('2025-09-25', '2026-09-25')).toBe(366);
    expect(calendarDaysInclusive('2025-09-24', '2026-09-25')).toBe(367);
    expect(calendarDaysInclusive('2026-09-24', '2026-09-24')).toBe(1);
  });

  it('localizes east on the compass', () => {
    expect(cardinalDirection(90, 'de')).toBe('O');
    expect(cardinalDirection(90, 'en')).toBe('E');
  });
});
