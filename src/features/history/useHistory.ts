import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { api, ApiError } from '../../api/client';
import type { DashboardResponse, HistorySummary, HistorySummarySelection, WeatherReading } from '../../api/types';
import { addCalendarDays, calendarDaysInclusive, stationDate } from '../../format';

interface RequestToken {
  generation: number;
  controller: AbortController;
}

export function useHistory() {
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [summary, setSummary] = useState<HistorySummary | null>(null);
  const [rows, setRows] = useState<WeatherReading[]>([]);
  const [fromDate, setFromDate] = useState('');
  const [throughDate, setThroughDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const active = useRef<RequestToken | null>(null);
  const generation = useRef(0);
  const mounted = useRef(true);
  const lastRequest = useRef<HistorySummarySelection | null>(null);

  const begin = (): RequestToken => {
    active.current?.controller.abort();
    const token = { generation: ++generation.current, controller: new AbortController() };
    active.current = token;
    return token;
  };
  const current = (token: RequestToken) => mounted.current &&
    !token.controller.signal.aborted && generation.current === token.generation;

  const fetchRange = async (selection: HistorySummarySelection, token: RequestToken) => {
    const nextSummary = await api.historySummary(selection, token.controller.signal);
    const firstPage = await api.weatherHistory(
      { from: nextSummary.range.from_unix_ms, to: nextSummary.range.to_unix_ms },
      undefined,
      token.controller.signal,
    );
    if (!current(token)) return;
    setSummary(nextSummary);
    setRows(firstPage.readings);
    setHasMore(firstPage.readings.length === 100);
    setFromDate(nextSummary.range.from_date);
    setThroughDate(nextSummary.range.through_date);
  };

  const run = useCallback(async (selection: HistorySummarySelection) => {
    const token = begin();
    lastRequest.current = selection;
    setLoading(true);
    setLoadingMore(false);
    setError(null);
    try {
      await fetchRange(selection, token);
    } catch (reason) {
      if (current(token)) setError(reason as Error);
    } finally {
      if (current(token)) setLoading(false);
    }
  }, []);

  const load = useCallback((from: string, through: string) => run({
    mode: 'dates',
    fromDate: from,
    throughDate: through,
  }), [run]);

  const loadExact = useCallback((fromUnixMs: number, toUnixMs: number) => run({
    mode: 'instants',
    fromUnixMs,
    toUnixMs,
  }), [run]);

  const initialize = useCallback(async () => {
    const token = begin();
    setLoading(true);
    setLoadingMore(false);
    setError(null);
    try {
      const support = await api.dashboard(token.controller.signal);
      if (!current(token)) return;
      setDashboard(support);
      const timezone = support.station_timezone;
      const extent = support.history.weather;
      const through = stationDate(extent?.last_received_at_unix_ms ?? Date.now(), timezone);
      const earliest = extent ? stationDate(extent.first_received_at_unix_ms, timezone) : addCalendarDays(through, -6);
      const from = [addCalendarDays(through, -6), earliest].sort().at(-1)!;
      setFromDate(from);
      setThroughDate(through);
      const selection: HistorySummarySelection = { mode: 'dates', fromDate: from, throughDate: through };
      lastRequest.current = selection;
      await fetchRange(selection, token);
    } catch (reason) {
      if (current(token)) setError(reason as Error);
    } finally {
      if (current(token)) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void initialize();
    return () => {
      mounted.current = false;
      active.current?.controller.abort();
      generation.current++;
    };
  }, [initialize]);

  const loadMore = async () => {
    if (!summary || loading || loadingMore || !hasMore) return;
    const last = rows.at(-1);
    if (!last?.id) return;
    const rangeAtStart = summary.range;
    const token = begin();
    setLoadingMore(true);
    setError(null);
    try {
      const page = await api.weatherHistory(
        { from: rangeAtStart.from_unix_ms, to: rangeAtStart.to_unix_ms },
        { receivedAt: last.received_at_unix_ms, id: last.id },
        token.controller.signal,
      );
      if (!current(token)) return;
      setRows((existing) => [...existing, ...page.readings]);
      setHasMore(page.readings.length === 100);
    } catch (reason) {
      if (current(token)) setError(reason as Error);
    } finally {
      if (current(token)) setLoadingMore(false);
    }
  };

  const preset = (days: number | 'all' | 'today') => {
    const timezone = dashboard?.station_timezone ?? 'Europe/Vienna';
    const extent = dashboard?.history.weather;
    const through = days === 'today'
      ? stationDate(Date.now(), timezone)
      : stationDate(extent?.last_received_at_unix_ms ?? Date.now(), timezone);
    const from = days === 'today'
      ? through
      : days === 'all' && extent
        ? stationDate(extent.first_received_at_unix_ms, timezone)
        : addCalendarDays(through, -(typeof days === 'number' ? days - 1 : 6));
    setFromDate(from);
    setThroughDate(through);
    void load(from, through);
  };

  const retry = () => dashboard
    ? run(lastRequest.current ?? { mode: 'dates', fromDate, throughDate })
    : initialize();
  const extent = dashboard?.history.weather;
  const fullHistoryFits = !extent || calendarDaysInclusive(
    stationDate(extent.first_received_at_unix_ms, dashboard.station_timezone),
    stationDate(extent.last_received_at_unix_ms, dashboard.station_timezone),
  ) <= 366;

  return {
    dashboard, summary, rows, fromDate, throughDate, setFromDate, setThroughDate,
    loading, loadingMore, error, busy: error instanceof ApiError && error.status === 503,
    tooLarge: error instanceof ApiError && error.code === 'row_budget_exceeded',
    invalid: error instanceof ApiError && error.status === 422,
    hasMore, fullHistoryFits, load, loadExact, loadMore, preset, retry,
  };
}
