import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { api, ApiError } from '../../api/client';
import type { DashboardResponse, HistorySummary, HistorySummarySelection, RainGrouping, WeatherReading } from '../../api/types';
import { stationDate } from '../../format';
import { periodRange, type HistoryPeriod } from './period';

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
  const [period, setPeriod] = useState<HistoryPeriod | null>('week');
  const [rainGrouping, setRainGrouping] = useState<RainGrouping>('auto');
  const [rainLoading, setRainLoading] = useState(false);
  const [rainError, setRainError] = useState<Error | null>(null);
  const preferredRainGrouping = useRef<RainGrouping>('auto');
  const rainRequest = useRef<AbortController | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const active = useRef<RequestToken | null>(null);
  const generation = useRef(0);
  const mounted = useRef(true);
  const lastRequest = useRef<HistorySummarySelection | null>(null);

  const begin = (changingRange = true): RequestToken => {
    if (changingRange) {
      rainRequest.current?.abort();
      setRainLoading(false);
      setRainError(null);
    }
    active.current?.controller.abort();
    const token = { generation: ++generation.current, controller: new AbortController() };
    active.current = token;
    return token;
  };
  const current = (token: RequestToken) => mounted.current &&
    !token.controller.signal.aborted && generation.current === token.generation;

  const fetchRange = async (selection: HistorySummarySelection, token: RequestToken) => {
    const nextSummary = await api.historySummary(selection, token.controller.signal, preferredRainGrouping.current);
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
      if (current(token)) {
        setSummary(null);
        setRows([]);
        setHasMore(false);
        setError(reason as Error);
      }
    } finally {
      if (current(token)) setLoading(false);
    }
  }, []);

  const load = useCallback((from: string, through: string) => {
    setPeriod(null);
    return run({
      mode: 'dates',
      fromDate: from,
      throughDate: through,
    });
  }, [run]);

  const loadExact = useCallback((fromUnixMs: number, toUnixMs: number) => {
    setPeriod(null);
    return run({
      mode: 'instants',
      fromUnixMs,
      toUnixMs,
    });
  }, [run]);

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
      const range = periodRange(stationDate(Date.now(), timezone), 'week');
      setPeriod('week');
      setFromDate(range.fromDate);
      setThroughDate(range.throughDate);
      const selection: HistorySummarySelection = { mode: 'dates', ...range };
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
      rainRequest.current?.abort();
      generation.current++;
    };
  }, [initialize]);

  const loadMore = async () => {
    if (!summary || loading || loadingMore || !hasMore) return;
    const last = rows.at(-1);
    if (!last?.id) return;
    const rangeAtStart = summary.range;
    const token = begin(false);
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

  const changeRainGrouping = async (grouping: RainGrouping) => {
    if (!summary || loading) return;
    preferredRainGrouping.current = grouping;
    setRainGrouping(grouping);
    rainRequest.current?.abort();
    const controller = new AbortController();
    rainRequest.current = controller;
    const range = summary.range;
    setRainLoading(true);
    setRainError(null);
    try {
      const next = await api.historySummary({
        mode: 'instants', fromUnixMs: range.from_unix_ms, toUnixMs: range.to_unix_ms,
      }, controller.signal, grouping);
      if (!mounted.current || controller.signal.aborted) return;
      setSummary((current) => current && ({
        ...current, rain_grouping: next.rain_grouping,
        available_rain_groupings: next.available_rain_groupings, rain_buckets: next.rain_buckets,
      }));
    } catch (reason) {
      if (mounted.current && !controller.signal.aborted) setRainError(reason as Error);
    } finally {
      if (mounted.current && !controller.signal.aborted) setRainLoading(false);
    }
  };

  const selectPeriod = (nextPeriod: HistoryPeriod, anchor: string, offset = 0) => {
    const range = periodRange(anchor, nextPeriod, offset);
    setPeriod(nextPeriod);
    setFromDate(range.fromDate);
    setThroughDate(range.throughDate);
    void run({ mode: 'dates', ...range });
  };

  const preset = (nextPeriod: HistoryPeriod) => {
    const timezone = dashboard?.station_timezone ?? 'Europe/Vienna';
    selectPeriod(nextPeriod, stationDate(Date.now(), timezone));
  };

  const navigatePeriod = (direction: -1 | 1) => {
    if (period && fromDate && !loading) selectPeriod(period, fromDate, direction);
  };

  const retry = () => dashboard
    ? run(lastRequest.current ?? { mode: 'dates', fromDate, throughDate })
    : initialize();
  return {
    dashboard, summary, rows, fromDate, throughDate, period,
    rainGrouping, rainLoading, rainError, changeRainGrouping,
    setFromDate: (value: string) => { setPeriod(null); setFromDate(value); },
    setThroughDate: (value: string) => { setPeriod(null); setThroughDate(value); },
    loading, loadingMore, error, busy: error instanceof ApiError && error.status === 503,
    tooLarge: error instanceof ApiError && error.code === 'row_budget_exceeded',
    invalid: error instanceof ApiError && error.status === 422,
    hasMore, load, loadExact, loadMore, preset, navigatePeriod, retry,
  };
}
