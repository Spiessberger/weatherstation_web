import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { api } from '../../api/client';
import type { DashboardResponse, LiveResponse } from '../../api/types';

export function useDashboard() {
  const [live, setLive] = useState<LiveResponse | null>(null);
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [liveError, setLiveError] = useState<Error | null>(null);
  const [dashboardError, setDashboardError] = useState<Error | null>(null);
  const [now, setNow] = useState(Date.now());
  const mounted = useRef(true);

  const refreshLive = useCallback(async (signal?: AbortSignal) => {
    try {
      const result = await api.live(signal);
      if (mounted.current) {
        setLive(result);
        setLiveError(null);
      }
    } catch (error) {
      if (mounted.current && !(error instanceof DOMException && error.name === 'AbortError')) {
        setLiveError(error as Error);
      }
    }
  }, []);

  const refreshDashboard = useCallback(async (signal?: AbortSignal) => {
    try {
      const result = await api.dashboard(signal);
      if (mounted.current) {
        setDashboard(result);
        setDashboardError(null);
      }
    } catch (error) {
      if (mounted.current && !(error instanceof DOMException && error.name === 'AbortError')) {
        setDashboardError(error as Error);
      }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    void refreshDashboard(controller.signal);
    let liveTimer: number | undefined;
    let summaryTimer: number | undefined;
    const poll = async () => {
      if (document.visibilityState === 'visible') await refreshLive(controller.signal);
      if (!controller.signal.aborted) liveTimer = window.setTimeout(poll, document.visibilityState === 'visible' ? 1000 : 15_000);
    };
    void poll();
    const refreshSummary = async () => {
      if (document.visibilityState === 'visible') await refreshDashboard(controller.signal);
      if (!controller.signal.aborted) summaryTimer = window.setTimeout(refreshSummary, 60_000);
    };
    summaryTimer = window.setTimeout(refreshSummary, 60_000);
    const visible = () => {
      if (document.visibilityState === 'visible') {
        void refreshLive(controller.signal);
        void refreshDashboard(controller.signal);
      }
    };
    document.addEventListener('visibilitychange', visible);
    window.addEventListener('focus', visible);
    const clock = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      mounted.current = false;
      controller.abort();
      window.clearTimeout(liveTimer);
      window.clearTimeout(summaryTimer);
      window.clearInterval(clock);
      document.removeEventListener('visibilitychange', visible);
      window.removeEventListener('focus', visible);
    };
  }, [refreshDashboard, refreshLive]);

  return {
    live,
    dashboard,
    liveError,
    dashboardError,
    now,
    retry: () => Promise.all([refreshLive(), refreshDashboard()]),
  };
}
