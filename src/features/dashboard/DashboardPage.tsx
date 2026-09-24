import type { ComponentChildren } from 'preact';
import { useMemo } from 'preact/hooks';
import { Icon } from '../../components/Icons';
import { useI18n, type MessageKey } from '../../i18n';
import { cardinalDirection, dateTime, lux, number, percent, rain, relativeAge, temperature, wind } from '../../format';
import { selectCurrent, type SelectedReading } from '../../model';
import type { DashboardResponse, IndoorReading, LiveResponse, WeatherReading } from '../../api/types';
import { useDashboard } from './useDashboard';

function StatusPill({ source, stale, gateway }: { source: 'live' | 'retained'; stale: boolean; gateway: boolean }) {
  const { t } = useI18n();
  const label = source === 'retained' ? t('retained') : !gateway ? t('offline') : stale ? t('stale') : t('live');
  const tone = source === 'retained' || stale || !gateway ? 'warning' : 'success';
  return <span class={`status-pill ${tone}`}><span class="status-dot" />{label}</span>;
}

function Metric({ icon, label, value, detail }: { icon: Parameters<typeof Icon>[0]['name']; label: string; value: string; detail?: string }) {
  return <div class="metric">
    <span class="metric-icon"><Icon name={icon} /></span>
    <span class="metric-copy"><small>{label}</small><strong>{value}</strong>{detail && <span>{detail}</span>}</span>
  </div>;
}

function EmptyWeather() {
  const { t } = useI18n();
  return <section class="weather-hero empty-state" aria-labelledby="weather-empty-title">
    <span class="empty-illustration"><Icon name="cloud-sun" size={58}/></span>
    <div><h1 id="weather-empty-title">{t('noWeather')}</h1><p>{t('noWeatherDetail')}</p></div>
  </section>;
}

function WeatherHero({ current, live, timezone, now }: {
  current: SelectedReading<WeatherReading>;
  live: LiveResponse | null;
  timezone: string;
  now: number;
}) {
  const { locale, t } = useI18n();
  const weather = current.reading;
  const direction = cardinalDirection(weather.wind_direction_degrees, locale);
  return <section class="weather-hero" aria-labelledby="current-weather-title">
    <div class="hero-heading">
      <div>
        <p class="eyebrow"><Icon name="cloud-sun" />{t('currentWeather')}</p>
        <h1 id="current-weather-title">{weather.temperature_celsius == null ? '–' : <>{number(weather.temperature_celsius, locale)}<span>°C</span></>}</h1>
      </div>
      <StatusPill source={current.source} stale={current.stale} gateway={live?.gateway.available ?? false}/>
    </div>
    <p class="reading-time" title={t('exactTime', { time: dateTime(weather.received_at_unix_ms, locale, timezone) })}>
      <Icon name="clock" size={17}/>{t('updated', { age: relativeAge(weather.received_at_unix_ms, now, locale) })}
      <span>· {dateTime(weather.received_at_unix_ms, locale, timezone)}</span>
    </p>
    <div class="hero-metrics">
      <Metric icon="humidity" label={t('humidity')} value={percent(weather.relative_humidity_percent, locale)} />
      <Metric icon="wind" label={t('wind')} value={wind(weather.wind_speed_mps, locale)} detail={`${t('gust')} ${wind(weather.gust_speed_mps, locale)}`} />
      <Metric icon="compass" label={t('direction')} value={weather.wind_direction_degrees == null ? '–' : `${direction} · ${number(weather.wind_direction_degrees, locale, 0)}°`} />
      <Metric icon="sun" label={t('uvIndex')} value={number(weather.uv_index, locale, 0)} detail={lux(weather.light_lux, locale)} />
    </div>
    {weather.wind_direction_degrees != null && <div class="compass-visual" aria-hidden="true">
      <span>N</span><span>{locale === 'de' ? 'O' : 'E'}</span><span>S</span><span>W</span>
      <i style={{ transform: `rotate(${weather.wind_direction_degrees}deg)` }}><b /></i>
    </div>}
  </section>;
}

function SummaryCard({ className = '', icon, title, value, subtitle, note }: {
  className?: string; icon: Parameters<typeof Icon>[0]['name']; title: string; value: string; subtitle: string; note?: string;
}) {
  return <article class={`summary-card ${className}`}>
    <div class="card-top"><span class="card-icon"><Icon name={icon}/></span><h2>{title}</h2></div>
    <strong class="summary-value">{value}</strong>
    <p>{subtitle}</p>
    {note && <span class="card-note"><Icon name="alert" size={15}/>{note}</span>}
  </article>;
}

function RainCard({ dashboard }: { dashboard: DashboardResponse | null }) {
  const { locale, t } = useI18n();
  const summary = dashboard?.rain_last_24_hours;
  return <SummaryCard
    className="rain-card"
    icon="droplet"
    title={t('rain24h')}
    value={rain(summary?.total_mm, locale)}
    subtitle={summary?.coverage === 'complete' ? t('coverageComplete') : summary?.coverage === 'partial' ? t('coveragePartial') : t('coverageUnavailable')}
    note={summary?.coverage === 'partial' ? t('incompleteRain') : undefined}
  />;
}

function NightCard({ dashboard, timezone }: { dashboard: DashboardResponse | null; timezone: string }) {
  const { locale, t } = useI18n();
  const night = dashboard?.night_temperature;
  const subtitle = night ? `${night.state === 'ongoing' ? t('currentNight') : t('lastNight')} · ${dateTime(night.from_unix_ms, locale, timezone)}` : t('unavailable');
  return <SummaryCard className="night-card" icon="moon" title={t('nightMinimum')} value={temperature(night?.min_celsius, locale)} subtitle={subtitle} />;
}

function IndoorCard({ current, timezone, now }: { current: SelectedReading<IndoorReading> | null; timezone: string; now: number }) {
  const { locale, t } = useI18n();
  return <article class="summary-card indoor-card">
    <div class="card-top"><span class="card-icon"><Icon name="home"/></span><h2>{t('inside')}</h2>
      {current && <span class={`mini-state ${current.stale ? 'warning' : ''}`}>{current.source === 'retained' ? t('retained') : current.stale ? t('stale') : t('live')}</span>}
    </div>
    {current ? <>
      <div class="indoor-values"><strong>{temperature(current.reading.temperature_celsius, locale)}</strong><span><Icon name="humidity" size={18}/>{percent(current.reading.relative_humidity_percent, locale)}</span></div>
      <p title={dateTime(current.reading.received_at_unix_ms, locale, timezone)}>{t('updated', { age: relativeAge(current.reading.received_at_unix_ms, now, locale) })}</p>
    </> : <><strong class="summary-value">–</strong><p>{t('unavailable')}</p></>}
  </article>;
}

function HealthRow({ icon, label, ok, good, bad, detail }: { icon: Parameters<typeof Icon>[0]['name']; label: string; ok: boolean; good: string; bad: string; detail?: string }) {
  return <div class="health-row">
    <span class={`health-icon ${ok ? 'ok' : 'bad'}`}><Icon name={icon}/></span>
    <span><small>{label}</small><strong>{ok ? good : bad}</strong>{detail && <em>{detail}</em>}</span>
    <Icon name={ok ? 'check' : 'alert'} size={18} class={ok ? 'health-check' : 'health-alert'}/>
  </div>;
}

function StationPanel({ live, weather }: { live: LiveResponse | null; weather: WeatherReading | null }) {
  const { locale, t } = useI18n();
  const gateway = live?.gateway;
  return <section class="station-panel" aria-labelledby="station-title">
    <div class="section-heading"><div><p class="eyebrow">{t('details')}</p><h2 id="station-title">{t('stationDetails')}</h2></div></div>
    <div class="health-grid">
      <HealthRow icon="signal" label={t('gateway')} ok={gateway?.available ?? false} good={t('connected')} bad={t('disconnected')} detail={gateway ? `${t('restarts')}: ${gateway.restart_count}` : undefined}/>
      <HealthRow icon="database" label={t('database')} ok={live?.storage.database.available ?? false} good={t('healthy')} bad={t('disrupted')} />
      <HealthRow icon="database" label={t('logs')} ok={live?.storage.logs.available ?? false} good={t('healthy')} bad={t('disrupted')} />
      <HealthRow icon="battery" label={t('battery')} ok={weather ? !weather.battery_low : true} good={weather ? t('batteryGood') : t('unavailable')} bad={t('batteryLow')} />
    </div>
    {weather && <dl class="station-facts">
      <div><dt>{t('signal')}</dt><dd>{number(weather.rssi_dbm, locale, 0)} dBm</dd></div>
      <div><dt>{t('linkQuality')}</dt><dd>{number(weather.lqi, locale, 0)}</dd></div>
      <div><dt>{t('stationId')}</dt><dd>{weather.station_id}</dd></div>
      <div><dt>{t('missingReadings')}</dt><dd>{live?.gateway.weather.observed_missing_readings ?? '–'}</dd></div>
    </dl>}
  </section>;
}

function Alert({ children, tone = 'warning', onDismiss }: { children: ComponentChildren; tone?: 'warning' | 'error'; onDismiss?: () => void }) {
  const { t } = useI18n();
  return <div class={`alert-banner ${tone}`} role="status"><Icon name="alert"/><span>{children}</span>{onDismiss && <button type="button" onClick={onDismiss} aria-label={t('dismiss')}>×</button>}</div>;
}

function LoadingDashboard() {
  const { t } = useI18n();
  return <div class="dashboard-page" aria-busy="true" aria-label={t('loading')}>
    <div class="skeleton hero-skeleton"/><div class="support-grid"><div class="skeleton card-skeleton"/><div class="skeleton card-skeleton"/><div class="skeleton card-skeleton"/></div>
  </div>;
}

export function DashboardPage() {
  const { t } = useI18n();
  const { live, dashboard, liveError, dashboardError, now, retry } = useDashboard();
  const current = useMemo(() => selectCurrent(live, dashboard, now), [live, dashboard, now]);
  const timezone = dashboard?.station_timezone ?? 'Europe/Vienna';

  if (!live && !dashboard && !liveError && !dashboardError) return <LoadingDashboard />;
  const storageBad = live && (!live.storage.database.available || !live.storage.logs.available);
  return <div class="dashboard-page">
    <div class="ambient-orb" aria-hidden="true" />
    <div class="alerts" aria-live="polite">
      {liveError && <Alert tone="error">{t('liveError')} <button class="inline-action" type="button" onClick={() => void retry()}>{t('retry')}</button></Alert>}
      {dashboardError && <Alert>{t('dashboardError')} <button class="inline-action" type="button" onClick={() => void retry()}>{t('retry')}</button></Alert>}
      {storageBad && <Alert>{t('storageWarning')}</Alert>}
    </div>
    {current.weather ? <WeatherHero current={current.weather} live={live} timezone={timezone} now={now}/> : <EmptyWeather />}
    <section class="support-grid" aria-label={t('rangeSummary')}>
      <RainCard dashboard={dashboard}/>
      <NightCard dashboard={dashboard} timezone={timezone}/>
      <IndoorCard current={current.indoor} timezone={timezone} now={now}/>
    </section>
    <StationPanel live={live} weather={current.weather?.reading ?? null}/>
  </div>;
}
