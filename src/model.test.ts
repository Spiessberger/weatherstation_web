import { describe, expect, it } from 'vitest';
import { selectReading } from './model';
import type { WeatherReading } from './api/types';

const reading = (time: number): WeatherReading => ({
  v: 1, type: 'weather', boot_id: 'a'.repeat(32), seq: 1, station_id: 106,
  temperature_celsius: null, relative_humidity_percent: null, wind_direction_degrees: null,
  wind_speed_mps: null, gust_speed_mps: null, rain_mm: 1, uv_microwatts_per_cm2: null,
  uv_index: null, light_lux: null, battery_low: false, rssi_dbm: -50, lqi: 5,
  received_at_unix_ms: time,
});

describe('current reading selection', () => {
  it('prefers a live reading and ages it independently', () => {
    const chosen = selectReading(reading(900), reading(990), true, 200, 1000);
    expect(chosen).toMatchObject({ source: 'live', stale: false });
    expect(chosen?.reading.received_at_unix_ms).toBe(900);
  });

  it('marks a live reading stale when gateway health is down', () => {
    expect(selectReading(reading(999), null, false, 200, 1000)?.stale).toBe(true);
  });

  it('always identifies a retained fallback as stale', () => {
    expect(selectReading(null, reading(999), true, 200, 1000)).toMatchObject({ source: 'retained', stale: true });
  });
});
