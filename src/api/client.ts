import type {
  ApiErrorBody,
  DashboardResponse,
  HistoryPage,
  HistorySummary,
  HistorySummarySelection,
  LiveResponse,
} from './types';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    signal,
  });
  if (!response.ok) {
    let body: ApiErrorBody | undefined;
    try {
      body = (await response.json()) as ApiErrorBody;
    } catch {
      // Preserve the HTTP status when an intermediary returns a non-JSON body.
    }
    const structured = typeof body?.error === 'object' ? body.error : undefined;
    const message = structured?.message ?? (typeof body?.error === 'string' ? body.error : response.statusText);
    throw new ApiError(message || `HTTP ${response.status}`, response.status, structured?.code);
  }
  return (await response.json()) as T;
}

export const api = {
  live: (signal?: AbortSignal) => getJson<LiveResponse>('/live', signal),
  dashboard: (signal?: AbortSignal) => getJson<DashboardResponse>('/api/v1/dashboard', signal),
  historySummary: (selection: HistorySummarySelection, signal?: AbortSignal) => {
    const query = new URLSearchParams({ max_points: '360' });
    if (selection.mode === 'dates') {
      query.set('from_date', selection.fromDate);
      query.set('through_date', selection.throughDate);
    } else {
      query.set('from_unix_ms', String(selection.fromUnixMs));
      query.set('to_unix_ms', String(selection.toUnixMs));
    }
    return getJson<HistorySummary>(`/api/v1/history/weather/summary?${query}`, signal);
  },
  weatherHistory: (
    range: { from: number; to: number },
    cursor?: { receivedAt: number; id: number },
    signal?: AbortSignal,
  ) => {
    const query = new URLSearchParams({
      from_unix_ms: String(range.from),
      to_unix_ms: String(range.to),
      limit: '100',
    });
    if (cursor) {
      query.set('after_received_at_unix_ms', String(cursor.receivedAt));
      query.set('after_id', String(cursor.id));
    }
    return getJson<HistoryPage>(`/history/weather?${query}`, signal);
  },
};
