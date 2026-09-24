import type { DashboardResponse, IndoorReading, LiveResponse, WeatherReading } from './api/types';

export interface SelectedReading<T> {
  reading: T;
  source: 'live' | 'retained';
  stale: boolean;
}

export function selectReading<T extends WeatherReading | IndoorReading>(
  live: T | null | undefined,
  retained: T | null | undefined,
  gatewayAvailable: boolean,
  staleAfterMs: number,
  now: number,
): SelectedReading<T> | null {
  if (live) {
    return {
      reading: live,
      source: 'live',
      stale: !gatewayAvailable || now - live.received_at_unix_ms > staleAfterMs,
    };
  }
  if (retained) return { reading: retained, source: 'retained', stale: true };
  return null;
}

export function selectCurrent(
  live: LiveResponse | null,
  dashboard: DashboardResponse | null,
  now: number,
) {
  const gatewayAvailable = live?.gateway.available ?? false;
  const staleAfter = dashboard?.stale_after_ms ?? 300_000;
  return {
    weather: selectReading(
      live?.weather,
      dashboard?.latest_stored.weather,
      gatewayAvailable,
      staleAfter,
      now,
    ),
    indoor: selectReading(
      live?.indoor,
      dashboard?.latest_stored.indoor,
      gatewayAvailable,
      staleAfter,
      now,
    ),
  };
}
