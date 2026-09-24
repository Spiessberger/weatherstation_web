// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../api/client';
import type { DashboardResponse, HistorySummary, WeatherReading } from '../../api/types';
import { useHistory } from './useHistory';

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
  buckets: [],
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

afterEach(() => vi.restoreAllMocks());

describe('history request ownership', () => {
  it('uses the current Vienna date for today instead of the latest retained date', async () => {
    vi.spyOn(api, 'dashboard').mockResolvedValue(dashboard);
    const summarySpy = vi.spyOn(api, 'historySummary').mockImplementation(async (selection) =>
      selection.mode === 'dates' ? summary(selection.fromDate, selection.throughDate, 10_000) : summary('2026-10-25', '2026-10-25', selection.fromUnixMs));
    vi.spyOn(api, 'weatherHistory').mockResolvedValue({ readings: [weather(1, 10_100)] });

    const hook = renderHook(() => useHistory());
    await waitFor(() => expect(hook.result.current.rows).toHaveLength(1));
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-24T22:30:00Z'));
    act(() => { hook.result.current.preset('today'); });
    await waitFor(() => expect(summarySpy).toHaveBeenLastCalledWith(
      { mode: 'dates', fromDate: '2026-10-25', throughDate: '2026-10-25' },
      expect.any(AbortSignal),
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
    expect(hook.result.current.fromDate).toBe('2026-09-18');
    expect(hook.result.current.throughDate).toBe('2026-09-24');
    await act(async () => { await hook.result.current.retry(); });
    expect(summarySpy).toHaveBeenLastCalledWith(
      { mode: 'dates', fromDate: '2026-09-18', throughDate: '2026-09-24' },
      expect.any(AbortSignal),
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
    await act(async () => { await hook.result.current.retry(); });
    expect(summarySpy).toHaveBeenLastCalledWith(
      { mode: 'instants', fromUnixMs: 10_250, toUnixMs: 10_750 },
      expect.any(AbortSignal),
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
});
