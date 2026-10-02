import { describe, expect, it } from 'vitest';
import { periodRange } from './period';

describe('calendar history periods', () => {
  it('keeps Monday–Sunday weeks across DST and year boundaries', () => {
    expect(periodRange('2026-10-25', 'week')).toEqual({ fromDate: '2026-10-19', throughDate: '2026-10-25' });
    expect(periodRange('2026-10-19', 'week', 1)).toEqual({ fromDate: '2026-10-26', throughDate: '2026-11-01' });
    expect(periodRange('2026-01-01', 'week')).toEqual({ fromDate: '2025-12-29', throughDate: '2026-01-04' });
    expect(periodRange('2026-03-23', 'week', -1)).toEqual({ fromDate: '2026-03-16', throughDate: '2026-03-22' });
  });

  it('uses complete months without overflowing shorter or leap months', () => {
    expect(periodRange('2026-03-31', 'month', -1)).toEqual({ fromDate: '2026-02-01', throughDate: '2026-02-28' });
    expect(periodRange('2024-03-31', 'month', -1)).toEqual({ fromDate: '2024-02-01', throughDate: '2024-02-29' });
    expect(periodRange('2026-12-31', 'month', 1)).toEqual({ fromDate: '2027-01-01', throughDate: '2027-01-31' });
  });

  it('steps whole years including leap years', () => {
    expect(periodRange('2024-02-29', 'year')).toEqual({ fromDate: '2024-01-01', throughDate: '2024-12-31' });
    expect(periodRange('2024-02-29', 'year', 1)).toEqual({ fromDate: '2025-01-01', throughDate: '2025-12-31' });
    expect(periodRange('2025-01-01', 'year', -1)).toEqual({ fromDate: '2024-01-01', throughDate: '2024-12-31' });
  });

  it('moves single days across month boundaries', () => {
    expect(periodRange('2024-03-01', 'day', -1)).toEqual({ fromDate: '2024-02-29', throughDate: '2024-02-29' });
    expect(periodRange('2026-12-31', 'day', 1)).toEqual({ fromDate: '2027-01-01', throughDate: '2027-01-01' });
  });
});
