// @vitest-environment jsdom
import { act, fireEvent, render, renderHook, waitFor } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../api/client';
import type { DashboardResponse, HistorySummary, WeatherReading } from '../../api/types';
import { useHistory } from './useHistory';
import { HistoryPage } from './HistoryPage';
import { I18nProvider } from '../../i18n';
import { UnitsProvider } from '../../units';

vi.mock('../../components/TimeChart', () => ({ TimeChart: () => null }));

const weather = (id: number, timestamp = id * 1000): WeatherReading => ({
  id, v: 1, type: 'weather', boot_id: 'a'.repeat(32), seq: id, station_id: 106,
  temperature_celsius: 12, relative_humidity_percent: 80, wind_direction_degrees: 90,
  wind_speed_mps: 2, gust_speed_mps: 3, rain_mm: 10, uv_microwatts_per_cm2: 1,
  uv_index: 0, light_lux: 100, battery_low: false, rssi_dbm: -55, lqi: 5,
  received_at_unix_ms: timestamp,
});

const dashboard: DashboardResponse = {
  generated_at_unix_ms: Date.parse('2026-09-24T12:00:00Z'),
  station_timezone: 'Europe/Vienna', stale_after_ms: 300_000,
  latest_stored: { weather: null, indoor: null },
  history: { weather: { first_received_at_unix_ms: Date.parse('2026-09-13T12:00:00Z'), last_received_at_unix_ms: Date.parse('2026-09-24T12:00:00Z') }, indoor: null },
  rain_last_24_hours: { total_mm: 0, coverage: 'complete', excluded_transitions: 0, largest_gap_ms: 1000 },
  night_temperature: { from_unix_ms: 1, to_unix_ms: 2, state: 'completed', min_celsius: 10, observations: 1 },
};

const summary = (from: string, through: string, marker: number): HistorySummary => ({
  range: { mode: 'dates', from_date: from, through_date: through, from_unix_ms: marker, to_unix_ms: marker + 1000, timezone: 'Europe/Vienna' },
  sample_count: 1,
  statistics: {
    temperature_celsius: { min: 1, max: 2, average: 1.5 },
    rain: { total_mm: 0, coverage: 'complete', excluded_transitions: 0, largest_gap_ms: 1000 },
    wind_speed_mps: { average: 1, max: 2 }, gust_speed_mps: { max: 3 },
  },
  buckets: [], rain_grouping: 'hour', available_rain_groupings: ['hour', 'day', 'week', 'month'], rain_buckets: [],
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

beforeEach(() => { vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-09-24T12:00:00Z')); });
afterEach(() => vi.restoreAllMocks());

describe('history request ownership', () => {
  it.each(['historySummary', 'weatherHistory'] as const)('hides previous range data when %s fails and restores results on retry', async (failedRequest) => {
    localStorage.setItem('weatherstation.locale', 'en');
    vi.spyOn(api, 'dashboard').mockResolvedValue(dashboard);
    const summarySpy = vi.spyOn(api, 'historySummary').mockImplementation(async (selection) => {
      if (selection.mode !== 'dates') throw new Error('Expected calendar dates');
      return summary(selection.fromDate, selection.throughDate, 10_000);
    });
    const readingsSpy = vi.spyOn(api, 'weatherHistory').mockResolvedValue({ readings: [weather(1, 10_100)] });
    const page = render(<I18nProvider><UnitsProvider><HistoryPage/></UnitsProvider></I18nProvider>);
    await page.findByRole('table');
    expect(page.getByRole('region', { name: 'Summary' })).toBeTruthy();
    expect(page.container.querySelector('.applied-summary')).not.toBeNull();

    const failedSpy = failedRequest === 'historySummary' ? summarySpy : readingsSpy;
    failedSpy.mockRejectedValueOnce(new Error('offline'));
    fireEvent.click(page.getByRole('button', { name: 'Next week' }));
    await page.findByRole('alert');
    expect(page.queryByRole('table')).toBeNull();
    expect(page.queryByRole('region', { name: 'Summary' })).toBeNull();
    expect(page.container.querySelector('.charts-grid')).toBeNull();
    expect(page.container.querySelector('.applied-summary')).toBeNull();
    expect(page.queryByText('No readings in this range')).toBeNull();

    fireEvent.click(page.getByRole('button', { name: 'Try again' }));
    await page.findByRole('table');
    expect(page.queryByRole('alert')).toBeNull();
    expect(summarySpy).toHaveBeenLastCalledWith(
      { mode: 'dates', fromDate: '2026-09-28', throughDate: '2026-10-04' },
      expect.any(AbortSignal), 'auto',
    );
    page.unmount();
    localStorage.removeItem('weatherstation.locale');
  });

  it.each([
    ['week', '2026-12-28', '2027-01-03'],
    ['month', '2027-01-01', '2027-01-31'],
    ['year', '2027-01-01', '2027-12-31'],
  ] as const)('selects the current station-local %s even with older retained readings', async (period, fromDate, throughDate) => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-12-31T23:30:00Z'));
    vi.spyOn(api, 'dashboard').mockResolvedValue(dashboard);
    const summarySpy = vi.spyOn(api, 'historySummary').mockImplementation(async (selection) => {
      if (selection.mode !== 'dates') throw new Error('Expected calendar dates');
      return summary(selection.fromDate, selection.throughDate, 10_000);
    });
    vi.spyOn(api, 'weatherHistory').mockResolvedValue({ readings: [] });
    const hook = renderHook(() => useHistory());
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    expect(hook.result.current.fromDate).toBe('2026-12-28');
    expect(hook.result.current.throughDate).toBe('2027-01-03');
    act(() => { hook.result.current.preset(period); });
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    expect(summarySpy).toHaveBeenLastCalledWith({ mode: 'dates', fromDate, throughDate }, expect.any(AbortSignal), 'auto');
    expect(hook.result.current.period).toBe(period);
    hook.unmount();
  });

  it('navigates calendar periods through the page controls and disables stepping for custom dates', async () => {
    localStorage.setItem('weatherstation.locale', 'en');
    vi.spyOn(api, 'dashboard').mockResolvedValue(dashboard);
    const summarySpy = vi.spyOn(api, 'historySummary').mockImplementation(async (selection) => {
      if (selection.mode !== 'dates') throw new Error('Expected calendar dates');
      return { ...summary(selection.fromDate, selection.throughDate, 10_000), sample_count: 0 };
    });
    vi.spyOn(api, 'weatherHistory').mockResolvedValue({ readings: [] });
    const page = render(<I18nProvider><UnitsProvider><HistoryPage/></UnitsProvider></I18nProvider>);
    const previousWeek = await page.findByRole('button', { name: 'Previous week' });
    await waitFor(() => expect((previousWeek as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(previousWeek);
    await waitFor(() => expect((previousWeek as HTMLButtonElement).disabled).toBe(false));
    expect(summarySpy).toHaveBeenLastCalledWith({ mode: 'dates', fromDate: '2026-09-14', throughDate: '2026-09-20' }, expect.any(AbortSignal), 'auto');
    fireEvent.click(page.getByRole('button', { name: 'Next week' }));
    await waitFor(() => expect((previousWeek as HTMLButtonElement).disabled).toBe(false));
    expect(summarySpy).toHaveBeenLastCalledWith({ mode: 'dates', fromDate: '2026-09-21', throughDate: '2026-09-27' }, expect.any(AbortSignal), 'auto');

    fireEvent.click(page.getByRole('button', { name: 'This month' }));
    const previousMonth = await page.findByRole('button', { name: 'Previous month' });
    await waitFor(() => expect((previousMonth as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(previousMonth);
    await waitFor(() => expect((previousMonth as HTMLButtonElement).disabled).toBe(false));
    expect(summarySpy).toHaveBeenLastCalledWith({ mode: 'dates', fromDate: '2026-08-01', throughDate: '2026-08-31' }, expect.any(AbortSignal), 'auto');
    expect((page.getByLabelText('From') as HTMLInputElement).value).toBe('2026-08-01');

    fireEvent.input(page.getByLabelText('From'), { target: { value: '2026-08-02' } });
    expect((page.getByRole('button', { name: 'Previous period' }) as HTMLButtonElement).disabled).toBe(true);
    expect((page.getByRole('button', { name: 'Next period' }) as HTMLButtonElement).disabled).toBe(true);
    page.unmount();
    localStorage.removeItem('weatherstation.locale');
  });

  it('uses the current Vienna date for today instead of the latest retained date', async () => {
    vi.spyOn(api, 'dashboard').mockResolvedValue(dashboard);
    const summarySpy = vi.spyOn(api, 'historySummary').mockImplementation(async (selection) =>
      selection.mode === 'dates' ? summary(selection.fromDate, selection.throughDate, 10_000) : summary('2026-10-25', '2026-10-25', selection.fromUnixMs));
    vi.spyOn(api, 'weatherHistory').mockResolvedValue({ readings: [weather(1, 10_100)] });

    const hook = renderHook(() => useHistory());
    await waitFor(() => expect(hook.result.current.rows).toHaveLength(1));
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-24T22:30:00Z'));
    act(() => { hook.result.current.preset('day'); });
    await waitFor(() => expect(summarySpy).toHaveBeenLastCalledWith(
      { mode: 'dates', fromDate: '2026-10-25', throughDate: '2026-10-25' },
      expect.any(AbortSignal), 'auto',
    ));
    expect(hook.result.current.fromDate).toBe('2026-10-25');
    expect(hook.result.current.throughDate).toBe('2026-10-25');
    hook.unmount();
  });

  it('does not append a late old-range page after switching ranges', async () => {
    vi.spyOn(api, 'dashboard').mockResolvedValue(dashboard);
    vi.spyOn(api, 'historySummary').mockImplementation(async (selection) => {
      if (selection.mode === 'instants') return summary('2026-09-20', '2026-09-20', selection.fromUnixMs);
      return selection.fromDate === '2026-09-20'
        ? summary(selection.fromDate, selection.throughDate, 20_000)
        : summary(selection.fromDate, selection.throughDate, 10_000);
    });
    const latePage = deferred<{ readings: WeatherReading[] }>();
    const historySpy = vi.spyOn(api, 'weatherHistory').mockImplementation(async (range, cursor) => {
      if (cursor) return latePage.promise;
      if (range.from === 20_000) return { readings: [weather(200, 20_100)] };
      return { readings: Array.from({ length: 100 }, (_, index) => weather(index + 1, 10_000 + index)) };
    });

    const hook = renderHook(() => useHistory());
    await waitFor(() => expect(hook.result.current.rows).toHaveLength(100));
    act(() => { void hook.result.current.loadMore(); });
    await waitFor(() => expect(historySpy.mock.calls.some(([, cursor]) => Boolean(cursor))).toBe(true));
    await act(async () => { await hook.result.current.load('2026-09-20', '2026-09-21'); });
    expect(hook.result.current.rows.map((row) => row.id)).toEqual([200]);

    await act(async () => {
      latePage.resolve({ readings: [weather(101, 10_101)] });
      await latePage.promise;
    });
    expect(hook.result.current.rows.map((row) => row.id)).toEqual([200]);
    hook.unmount();
  });

  it('retries dashboard discovery after initial startup failure', async () => {
    vi.spyOn(api, 'dashboard').mockRejectedValueOnce(new Error('offline')).mockResolvedValue(dashboard);
    vi.spyOn(api, 'historySummary').mockResolvedValue(summary('2026-09-18', '2026-09-24', 10_000));
    vi.spyOn(api, 'weatherHistory').mockResolvedValue({ readings: [weather(1, 10_100)] });

    const hook = renderHook(() => useHistory());
    await waitFor(() => expect(hook.result.current.error?.message).toBe('offline'));
    expect(hook.result.current.dashboard).toBeNull();
    await act(async () => { await hook.result.current.retry(); });
    await waitFor(() => expect(hook.result.current.dashboard?.station_timezone).toBe('Europe/Vienna'));
    expect(hook.result.current.rows).toHaveLength(1);
    expect(hook.result.current.error).toBeNull();
    hook.unmount();
  });

  it('retries the derived initial dates after an initial summary failure', async () => {
    vi.spyOn(api, 'dashboard').mockResolvedValue(dashboard);
    const summarySpy = vi.spyOn(api, 'historySummary')
      .mockRejectedValueOnce(new Error('summary unavailable'))
      .mockResolvedValue(summary('2026-09-18', '2026-09-24', 10_000));
    vi.spyOn(api, 'weatherHistory').mockResolvedValue({ readings: [weather(1, 10_100)] });

    const hook = renderHook(() => useHistory());
    await waitFor(() => expect(hook.result.current.error?.message).toBe('summary unavailable'));
    expect(hook.result.current.fromDate).toBe('2026-09-21');
    expect(hook.result.current.throughDate).toBe('2026-09-27');
    await act(async () => { await hook.result.current.retry(); });
    expect(summarySpy).toHaveBeenLastCalledWith(
      { mode: 'dates', fromDate: '2026-09-21', throughDate: '2026-09-27' },
      expect.any(AbortSignal), 'auto',
    );
    expect(hook.result.current.rows).toHaveLength(1);
    hook.unmount();
  });

  it('retries a failed exact range without expanding it to date inputs', async () => {
    vi.spyOn(api, 'dashboard').mockResolvedValue(dashboard);
    const exact = summary('2026-09-24', '2026-09-24', 10_250);
    exact.range = { ...exact.range, mode: 'instants', from_unix_ms: 10_250, to_unix_ms: 10_750 };
    const summarySpy = vi.spyOn(api, 'historySummary')
      .mockResolvedValueOnce(summary('2026-09-18', '2026-09-24', 10_000))
      .mockRejectedValueOnce(new Error('exact unavailable'))
      .mockResolvedValueOnce(exact);
    vi.spyOn(api, 'weatherHistory').mockResolvedValue({ readings: [weather(1, 10_300)] });

    const hook = renderHook(() => useHistory());
    await waitFor(() => expect(hook.result.current.rows).toHaveLength(1));
    await act(async () => { await hook.result.current.loadExact(10_250, 10_750); });
    expect(hook.result.current.error?.message).toBe('exact unavailable');
    expect(hook.result.current.summary).toBeNull();
    expect(hook.result.current.rows).toEqual([]);
    expect(hook.result.current.hasMore).toBe(false);
    await act(async () => { await hook.result.current.retry(); });
    expect(summarySpy).toHaveBeenLastCalledWith(
      { mode: 'instants', fromUnixMs: 10_250, toUnixMs: 10_750 },
      expect.any(AbortSignal), 'auto',
    );
    expect(hook.result.current.summary?.range.mode).toBe('instants');
    hook.unmount();
  });

  it('does not let old-table pagination cancel a pending exact range', async () => {
    vi.spyOn(api, 'dashboard').mockResolvedValue(dashboard);
    const pendingExact = deferred<HistorySummary>();
    vi.spyOn(api, 'historySummary')
      .mockResolvedValueOnce(summary('2026-09-18', '2026-09-24', 10_000))
      .mockImplementationOnce(() => pendingExact.promise);
    const historySpy = vi.spyOn(api, 'weatherHistory').mockResolvedValue({
      readings: Array.from({ length: 100 }, (_, index) => weather(index + 1, 10_000 + index)),
    });

    const hook = renderHook(() => useHistory());
    await waitFor(() => expect(hook.result.current.rows).toHaveLength(100));
    act(() => { void hook.result.current.loadExact(10_250, 10_750); });
    await waitFor(() => expect(hook.result.current.loading).toBe(true));
    const historyCalls = historySpy.mock.calls.length;
    act(() => { void hook.result.current.loadMore(); });
    expect(historySpy).toHaveBeenCalledTimes(historyCalls);

    const exact = summary('2026-09-24', '2026-09-24', 10_250);
    exact.range = { ...exact.range, mode: 'instants', from_unix_ms: 10_250, to_unix_ms: 10_750 };
    await act(async () => { pendingExact.resolve(exact); });
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    expect(hook.result.current.summary?.range).toMatchObject({
      mode: 'instants',
      from_unix_ms: 10_250,
      to_unix_ms: 10_750,
    });
    hook.unmount();
  });
  it('changes only rainfall, preserving the period, table, and detailed chart buckets', async () => {
    vi.spyOn(api, 'dashboard').mockResolvedValue(dashboard);
    const initial = summary('2026-09-21', '2026-09-27', 10_000);
    const changed = { ...initial, rain_grouping: 'week' as const };
    const summarySpy = vi.spyOn(api, 'historySummary').mockResolvedValueOnce(initial).mockResolvedValue(changed);
    const rowsSpy = vi.spyOn(api, 'weatherHistory').mockResolvedValue({ readings: [weather(1)] });
    const hook = renderHook(() => useHistory());
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    const rows = hook.result.current.rows;
    await act(async () => { await hook.result.current.changeRainGrouping('week'); });
    expect(summarySpy).toHaveBeenLastCalledWith(
      { mode: 'instants', fromUnixMs: 10_000, toUnixMs: 11_000 }, expect.any(AbortSignal), 'week',
    );
    expect(rowsSpy).toHaveBeenCalledTimes(1);
    expect(hook.result.current.rows).toBe(rows);
    expect(hook.result.current.summary?.buckets).toBe(initial.buckets);
    expect(hook.result.current.summary?.rain_grouping).toBe('week');
    expect(hook.result.current.period).toBe('week');
    act(() => { hook.result.current.navigatePeriod(-1); });
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    expect(summarySpy).toHaveBeenLastCalledWith(
      { mode: 'dates', fromDate: '2026-09-14', throughDate: '2026-09-20' }, expect.any(AbortSignal), 'week',
    );
    expect(hook.result.current.rainGrouping).toBe('week');
    hook.unmount();
  });

  it('discards a late grouping response after the selected date range changes', async () => {
    vi.spyOn(api, 'dashboard').mockResolvedValue(dashboard);
    const pending = deferred<HistorySummary>();
    const summarySpy = vi.spyOn(api, 'historySummary')
      .mockResolvedValueOnce(summary('2026-09-21', '2026-09-27', 10_000))
      .mockImplementationOnce(() => pending.promise)
      .mockResolvedValueOnce({ ...summary('2026-09-28', '2026-10-04', 20_000), rain_grouping: 'month' });
    vi.spyOn(api, 'weatherHistory').mockResolvedValue({ readings: [weather(1)] });
    const hook = renderHook(() => useHistory());
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    act(() => { void hook.result.current.changeRainGrouping('month'); });
    const signal = summarySpy.mock.calls[1][1];
    await act(async () => { await hook.result.current.load('2026-09-28', '2026-10-04'); });
    expect(signal?.aborted).toBe(true);
    await act(async () => { pending.resolve(summary('2026-09-21', '2026-09-27', 10_000)); });
    expect(hook.result.current.summary?.range.from_unix_ms).toBe(20_000);
    expect(hook.result.current.summary?.rain_grouping).toBe('month');
    expect(hook.result.current.rainLoading).toBe(false);
    hook.unmount();
  });

  it('retains the visible graph on a grouping failure and retries the selected grouping', async () => {
    vi.spyOn(api, 'dashboard').mockResolvedValue(dashboard);
    const initial = summary('2026-09-21', '2026-09-27', 10_000);
    vi.spyOn(api, 'historySummary').mockResolvedValueOnce(initial)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ ...initial, rain_grouping: 'day' });
    vi.spyOn(api, 'weatherHistory').mockResolvedValue({ readings: [weather(1)] });
    const hook = renderHook(() => useHistory());
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    await act(async () => { await hook.result.current.changeRainGrouping('day'); });
    expect(hook.result.current.summary).toBe(initial);
    expect(hook.result.current.error).toBeNull();
    expect(hook.result.current.rainError?.message).toBe('offline');
    await act(async () => { await hook.result.current.changeRainGrouping(hook.result.current.rainGrouping); });
    expect(hook.result.current.summary?.rain_grouping).toBe('day');
    expect(hook.result.current.rainError).toBeNull();
    hook.unmount();
  });

  it('remembers hourly grouping through a range that requires an automatic fallback', async () => {
    vi.spyOn(api, 'dashboard').mockResolvedValue(dashboard);
    const initial = summary('2026-09-21', '2026-09-27', 10_000);
    const summarySpy = vi.spyOn(api, 'historySummary').mockResolvedValueOnce(initial).mockResolvedValueOnce(initial)
      .mockResolvedValueOnce({ ...summary('2026-01-01', '2026-12-31', 20_000), rain_grouping: 'month', available_rain_groupings: ['day', 'week', 'month'] })
      .mockResolvedValueOnce(initial);
    vi.spyOn(api, 'weatherHistory').mockResolvedValue({ readings: [] });
    const hook = renderHook(() => useHistory());
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    await act(async () => { await hook.result.current.changeRainGrouping('hour'); });
    act(() => { hook.result.current.preset('year'); });
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    expect(hook.result.current.rainGrouping).toBe('hour');
    expect(hook.result.current.summary?.rain_grouping).toBe('month');
    act(() => { hook.result.current.preset('week'); });
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    expect(summarySpy.mock.calls.at(-1)?.[2]).toBe('hour');
    expect(hook.result.current.summary?.rain_grouping).toBe('hour');
    hook.unmount();
  });

});
