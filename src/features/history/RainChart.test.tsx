// @vitest-environment jsdom
import type { ComponentProps } from 'preact';
import { fireEvent, render, cleanup } from '@testing-library/preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RainBucket } from '../../api/types';
import { TimeChart } from '../../components/TimeChart';
import { I18nProvider } from '../../i18n';
import { RainChart, rainIntervalLabel } from './RainChart';

vi.mock('../../components/TimeChart', () => ({
  TimeChart: ({ controls, buckets, renderInspector }: ComponentProps<typeof TimeChart<RainBucket>>) =>
    <div>{controls}{buckets.map((bucket) => <div>{renderInspector?.(bucket)}</div>)}</div>,
}));

afterEach(() => { cleanup(); localStorage.clear(); });

const bucket: RainBucket = {
  from_unix_ms: Date.parse('2026-10-25T00:00:00+02:00'),
  to_unix_ms: Date.parse('2026-10-26T00:00:00+01:00'),
  observed_through_unix_ms: Date.parse('2026-10-26T00:00:00+01:00'),
  partial_period: false, ongoing: false, future: false,
  rain: { total_mm: 0, coverage: 'complete', excluded_transitions: 0, largest_gap_ms: 60_000 },
};
const props = (): ComponentProps<typeof RainChart> => ({
  summary: {
    range: { mode: 'dates', from_date: '2026-10-25', through_date: '2026-10-25', ...bucket, timezone: 'Europe/Vienna' },
    sample_count: 1,
    statistics: { rain: bucket.rain, temperature_celsius: { min: null, max: null, average: null }, wind_speed_mps: { average: null, max: null }, gust_speed_mps: { max: null } },
    buckets: [], rain_grouping: 'day', available_rain_groupings: ['hour', 'day', 'week', 'month'], rain_buckets: [bucket],
  },
  grouping: 'auto', loading: false, error: null, onGrouping: vi.fn(),
  timezone: 'Europe/Vienna', locale: 'en', appliedRange: { fromUnixMs: bucket.from_unix_ms, toUnixMs: bucket.to_unix_ms },
  proposal: null, resetVersion: 0, applying: false, onZoom: vi.fn(), onApplyZoom: vi.fn(), onResetZoom: vi.fn(),
});

function show(options: ComponentProps<typeof RainChart>) {
  localStorage.setItem('weatherstation.locale', 'en');
  return render(<I18nProvider><RainChart {...options}/></I18nProvider>);
}

describe('rain grouping controls and interval labels', () => {
  it('shows the resolved Auto choice and allows a manual choice', () => {
    const options = props();
    const page = show(options);
    expect(page.getByRole('option', { name: 'Auto (Daily)' })).toBeTruthy();
    fireEvent.change(page.getByRole('combobox', { name: 'Group by' }), { target: { value: 'week' } });
    expect(options.onGrouping).toHaveBeenCalledWith('week');
    expect(page.getByText('0.0 mm')).toBeTruthy();
  });

  it('disables oversized hourly grouping and explains the remembered fallback', () => {
    const options = props();
    options.grouping = 'hour';
    options.summary.available_rain_groupings = ['day', 'week', 'month'];
    options.summary.rain_grouping = 'month';
    const page = show(options);
    expect((page.getByRole('option', { name: 'Hourly' }) as HTMLOptionElement).disabled).toBe(true);
    expect(page.getByText(/Your choice will return for shorter ranges/)).toBeTruthy();
    expect(page.getByRole('status').textContent).toContain('Monthly');
  });

  it('identifies missing rainfall, partial periods, and an ongoing period', () => {
    const options = props();
    options.summary.rain_buckets = [{ ...bucket, partial_period: true, ongoing: true, rain: { ...bucket.rain, total_mm: null, coverage: 'unavailable' } }];
    const page = show(options);
    expect(page.getByText('No comparable rain readings')).toBeTruthy();
    expect(page.getByText('Partial period')).toBeTruthy();
    expect(page.getByText(/So far/)).toBeTruthy();
    expect(page.queryByText('0.0 mm')).toBeNull();
  });

  it('labels a DST day with its date and distinguishes the repeated autumn hour', () => {
    expect(rainIntervalLabel(bucket, 'en', 'Europe/Vienna', 'day')).toBe('25 Oct 2026');
    const hour = { ...bucket, from_unix_ms: Date.parse('2026-10-25T02:00:00+02:00'), to_unix_ms: Date.parse('2026-10-25T02:00:00+01:00') };
    const label = rainIntervalLabel(hour, 'en', 'Europe/Vienna', 'hour');
    expect(label).toContain('02:00 GMT+2');
    expect(label).toContain('02:00 GMT+1');
  });
});
