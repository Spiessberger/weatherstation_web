import { addCalendarDays } from '../../format';

export type HistoryPeriod = 'day' | 'week' | 'month' | 'year';

// Arithmetic uses UTC only as a calendar; the API resolves station-local midnights.
export function periodRange(anchor: string, period: HistoryPeriod, offset = 0) {
  const date = new Date(`${anchor}T00:00:00Z`);
  if (period === 'day') {
    const fromDate = addCalendarDays(anchor, offset);
    return { fromDate, throughDate: fromDate };
  }
  if (period === 'week') {
    const fromDate = addCalendarDays(anchor, -((date.getUTCDay() + 6) % 7) + offset * 7);
    return { fromDate, throughDate: addCalendarDays(fromDate, 6) };
  }
  date.setUTCDate(1);
  if (period === 'month') date.setUTCMonth(date.getUTCMonth() + offset);
  else {
    date.setUTCMonth(0);
    date.setUTCFullYear(date.getUTCFullYear() + offset);
  }
  const fromDate = date.toISOString().slice(0, 10);
  if (period === 'month') date.setUTCMonth(date.getUTCMonth() + 1);
  else date.setUTCFullYear(date.getUTCFullYear() + 1);
  return { fromDate, throughDate: addCalendarDays(date.toISOString().slice(0, 10), -1) };
}
