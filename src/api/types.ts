export interface IndoorReading {
  id?: number;
  v: number;
  type: 'indoor';
  boot_id: string;
  seq: number;
  temperature_celsius: number;
  relative_humidity_percent: number;
  received_at_unix_ms: number;
}

export interface WeatherReading {
  id?: number;
  v: number;
  type: 'weather';
  boot_id: string;
  seq: number;
  station_id: number;
  temperature_celsius: number | null;
  relative_humidity_percent: number | null;
  wind_direction_degrees: number | null;
  wind_speed_mps: number | null;
  gust_speed_mps: number | null;
  rain_mm: number;
  uv_microwatts_per_cm2: number | null;
  uv_index: number | null;
  light_lux: number | null;
  battery_low: boolean;
  rssi_dbm: number;
  lqi: number;
  received_at_unix_ms: number;
}

export interface StreamHealth {
  last_seq: number | null;
  observed_missing_readings: number;
}

export interface LiveResponse {
  indoor: IndoorReading | null;
  weather: WeatherReading | null;
  gateway: {
    available: boolean;
    boot_id: string | null;
    last_received_at_unix_ms: number | null;
    restart_count: number;
    indoor: StreamHealth;
    weather: StreamHealth;
  };
  storage: {
    database: { available: boolean; last_error: string | null };
    logs: { available: boolean; last_error: string | null };
  };
}

export type Coverage = 'complete' | 'partial' | 'unavailable';

export interface RainSummary {
  total_mm: number | null;
  coverage: Coverage;
  excluded_transitions: number;
  largest_gap_ms: number | null;
}

export interface DashboardResponse {
  generated_at_unix_ms: number;
  station_timezone: string;
  stale_after_ms: number;
  latest_stored: {
    weather: WeatherReading | null;
    indoor: IndoorReading | null;
  };
  history: {
    weather: HistoryExtent | null;
    indoor: HistoryExtent | null;
  };
  rain_last_24_hours: RainSummary;
  night_temperature: {
    from_unix_ms: number;
    to_unix_ms: number;
    state: 'ongoing' | 'completed';
    min_celsius: number | null;
    observations: number;
  };
}

export interface HistoryExtent {
  first_received_at_unix_ms: number;
  last_received_at_unix_ms: number;
}

export interface NullableTriple {
  min: number | null;
  max: number | null;
  average: number | null;
}

export interface HistoryBucket {
  from_unix_ms: number;
  to_unix_ms: number;
  sample_count: number;
  temperature_celsius: NullableTriple;
  relative_humidity_percent: { average: number | null };
  wind_speed_mps: { average: number | null; max: number | null };
  gust_speed_mps: { max: number | null };
  rain: RainSummary;
}

export interface HistorySummary {
  range: {
    mode: 'dates' | 'instants';
    from_date: string;
    through_date: string;
    from_unix_ms: number;
    to_unix_ms: number;
    timezone: string;
  };
  sample_count: number;
  statistics: {
    temperature_celsius: NullableTriple;
    rain: RainSummary;
    wind_speed_mps: { average: number | null; max: number | null };
    gust_speed_mps: { max: number | null };
  };
  buckets: HistoryBucket[];
}

export type HistorySummarySelection =
  | { mode: 'dates'; fromDate: string; throughDate: string }
  | { mode: 'instants'; fromUnixMs: number; toUnixMs: number };

export interface HistoryPage {
  readings: WeatherReading[];
}

export interface ApiErrorBody {
  error?: { code?: string; message?: string } | string;
}
