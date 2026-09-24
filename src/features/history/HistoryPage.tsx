import { useCallback, useEffect, useMemo, useState } from 'preact/hooks';
import { TimeChart, type ChartSeries, type ExactRange } from '../../components/TimeChart';
import { Icon } from '../../components/Icons';
import { useI18n } from '../../i18n';
import { calendarDate, calendarDaysInclusive, dateTimeSeconds, number, percent, rain, temperature, wind } from '../../format';
import type { Coverage, HistorySummary, WeatherReading } from '../../api/types';
import { useHistory } from './useHistory';

function CoverageLabel({ coverage }: { coverage: Coverage }) {
  const { t } = useI18n();
  return <span class={`coverage ${coverage}`}>{coverage === 'complete' ? t('coverageComplete') : coverage === 'partial' ? t('coveragePartial') : t('coverageUnavailable')}</span>;
}

function StatCard({ label, value, icon, detail }: { label: string; value: string; icon: Parameters<typeof Icon>[0]['name']; detail?: preact.ComponentChildren }) {
  return <article class="history-stat"><span><Icon name={icon}/></span><div><small>{label}</small><strong>{value}</strong>{detail}</div></article>;
}

function SummaryCards({ summary }: { summary: HistorySummary }) {
  const { locale, t } = useI18n();
  const stats = summary.statistics;
  return <section class="history-stats" aria-label={t('rangeSummary')}>
    <StatCard icon="thermometer" label={t('minTemperature')} value={temperature(stats.temperature_celsius.min, locale)}/>
    <StatCard icon="thermometer" label={t('maxTemperature')} value={temperature(stats.temperature_celsius.max, locale)}/>
    <StatCard icon="droplet" label={t('totalRain')} value={rain(stats.rain.total_mm, locale)} detail={<CoverageLabel coverage={stats.rain.coverage}/>}/>
    <StatCard icon="wind" label={t('windAverage')} value={wind(stats.wind_speed_mps.average, locale)}/>
    <StatCard icon="wind" label={t('windMaximum')} value={wind(stats.wind_speed_mps.max, locale)}/>
    <StatCard icon="wind" label={t('maxGust')} value={wind(stats.gust_speed_mps.max, locale)}/>
  </section>;
}

interface ZoomProposal extends ExactRange {
  chartId: string;
}

function Charts({ summary, proposal, resetVersion, applying, onZoom, onApplyZoom, onResetZoom }: {
  summary: HistorySummary;
  proposal: ZoomProposal | null;
  resetVersion: number;
  applying: boolean;
  onZoom: (chartId: string, range: ExactRange | null) => void;
  onApplyZoom: () => void;
  onResetZoom: () => void;
}) {
  const { locale, t } = useI18n();
  const timezone = summary.range.timezone;
  const tempSeries = useMemo<ChartSeries[]>(() => [
    { label: t('average'), color: '#f4bf6a', value: (b) => b.temperature_celsius.average, format: (v) => temperature(v, locale), width: 2.5 },
    { label: t('minimum'), color: '#63bed1', value: (b) => b.temperature_celsius.min, format: (v) => temperature(v, locale), width: 1 },
    { label: t('maximum'), color: '#ed8069', value: (b) => b.temperature_celsius.max, format: (v) => temperature(v, locale), width: 1 },
  ], [locale, t]);
  const humiditySeries = useMemo<ChartSeries[]>(() => [
    { label: t('average'), color: '#66c8bc', value: (b) => b.relative_humidity_percent.average, format: (v) => percent(v, locale), fill: 'rgba(102,200,188,.08)' },
  ], [locale, t]);
  const windSeries = useMemo<ChartSeries[]>(() => [
    { label: t('average'), color: '#73b9e6', value: (b) => b.wind_speed_mps.average, format: (v) => wind(v, locale), width: 2.5 },
    { label: t('maximum'), color: '#ae88e8', value: (b) => b.wind_speed_mps.max, format: (v) => wind(v, locale), width: 1.5 },
    { label: t('gust'), color: '#ed8069', value: (b) => b.gust_speed_mps.max, format: (v) => wind(v, locale), width: 1.5 },
  ], [locale, t]);
  const rainSeries = useMemo<ChartSeries[]>(() => [
    { label: t('totalRain'), color: '#4daec3', fill: 'rgba(77,174,195,.35)', value: (b) => b.rain.total_mm, format: (v) => rain(v, locale) },
  ], [locale, t]);
  const appliedRange = useMemo<ExactRange>(() => ({
    fromUnixMs: summary.range.from_unix_ms,
    toUnixMs: summary.range.to_unix_ms,
  }), [summary.range.from_unix_ms, summary.range.to_unix_ms]);
  const shared = { buckets: summary.buckets, timezone, locale, appliedRange, resetVersion, applying, onZoom, onApplyZoom, onResetZoom };
  return <section class="charts-grid">
    <TimeChart {...shared} chartId="temperature" title={t('chartTemperature')} series={tempSeries} proposal={proposal?.chartId === 'temperature' ? proposal : null}/>
    <TimeChart {...shared} chartId="humidity" title={t('chartHumidity')} series={humiditySeries} proposal={proposal?.chartId === 'humidity' ? proposal : null}/>
    <TimeChart {...shared} chartId="wind" title={t('chartWind')} series={windSeries} proposal={proposal?.chartId === 'wind' ? proposal : null}/>
    <TimeChart {...shared} chartId="rain" title={t('chartRain')} series={rainSeries} proposal={proposal?.chartId === 'rain' ? proposal : null} kind="bars"/>
  </section>;
}

function ReadingsTable({ rows, timezone, hasMore, loadingMore, onLoadMore }: {
  rows: WeatherReading[]; timezone: string; hasMore: boolean; loadingMore: boolean; onLoadMore: () => void;
}) {
  const { locale, t } = useI18n();
  return <section class="readings-section" aria-labelledby="raw-title">
    <div class="section-heading"><div><p class="eyebrow">{t('details')}</p><h2 id="raw-title">{t('rawReadings')}</h2><p>{t('rawReadingsIntro')}</p></div><span>{t('rowsShown', { count: rows.length })}</span></div>
    <p class="sr-only" id="table-scroll-hint">{t('tableScrollHint')}</p>
    <div class="table-wrap" tabIndex={0} aria-describedby="table-scroll-hint">
      <table>
        <thead><tr><th>{t('receivedAt')}</th><th>{t('temperature')}</th><th>{t('humidity')}</th><th>{t('wind')}</th><th>{t('gust')}</th><th>{t('direction')}</th><th>{t('rainCounter')}</th><th>{t('uv')}</th><th>{t('light')}</th><th>{t('signal')}</th><th>{t('rowId')}</th></tr></thead>
        <tbody>{rows.map((row) => <tr key={row.id}>
          <td><time dateTime={new Date(row.received_at_unix_ms).toISOString()}>{dateTimeSeconds(row.received_at_unix_ms, locale, timezone)}</time></td>
          <td>{temperature(row.temperature_celsius, locale)}</td><td>{percent(row.relative_humidity_percent, locale)}</td>
          <td>{wind(row.wind_speed_mps, locale)}</td><td>{wind(row.gust_speed_mps, locale)}</td>
          <td>{row.wind_direction_degrees == null ? '–' : `${number(row.wind_direction_degrees, locale, 0)}°`}</td>
          <td>{rain(row.rain_mm, locale)}</td><td>{number(row.uv_index, locale, 0)}</td>
          <td>{row.light_lux == null ? '–' : `${number(row.light_lux, locale, 0)} lx`}</td><td>{number(row.rssi_dbm, locale, 0)} dBm</td><td>{row.id}</td>
        </tr>)}</tbody>
      </table>
    </div>
    <div class="table-actions">{hasMore ? <button class="secondary-button" type="button" onClick={onLoadMore} disabled={loadingMore}>{loadingMore ? t('loadingMore') : t('loadMore')}</button> : <span><Icon name="check" size={17}/>{t('allLoaded')}</span>}</div>
  </section>;
}

function HistoryLoading() {
  return <><div class="skeleton stats-skeleton"/><div class="charts-grid"><div class="skeleton chart-skeleton"/><div class="skeleton chart-skeleton"/></div></>;
}

export function HistoryPage() {
  const { locale, t } = useI18n();
  const history = useHistory();
  const [validation, setValidation] = useState<'order' | 'limit' | null>(null);
  const [zoomProposal, setZoomProposal] = useState<ZoomProposal | null>(null);
  const [zoomResetVersion, setZoomResetVersion] = useState(0);
  const clearZoom = useCallback(() => {
    setZoomProposal(null);
    setZoomResetVersion((version) => version + 1);
  }, []);
  const handleZoom = useCallback((chartId: string, range: ExactRange | null) => {
    setZoomProposal((current) => range ? { chartId, ...range } : current?.chartId === chartId ? null : current);
  }, []);
  const applyZoom = useCallback(() => {
    if (zoomProposal) void history.loadExact(zoomProposal.fromUnixMs, zoomProposal.toUnixMs);
  }, [history.loadExact, zoomProposal]);
  useEffect(() => {
    const range = history.summary?.range;
    if (zoomProposal && range?.mode === 'instants' &&
      range.from_unix_ms === zoomProposal.fromUnixMs && range.to_unix_ms === zoomProposal.toUnixMs) {
      clearZoom();
    }
  }, [clearZoom, history.summary, zoomProposal]);
  const submit = (event: SubmitEvent) => {
    event.preventDefault();
    if (!history.fromDate || !history.throughDate || history.fromDate > history.throughDate) {
      setValidation('order');
      return;
    }
    if (calendarDaysInclusive(history.fromDate, history.throughDate) > 366) {
      setValidation('limit');
      return;
    }
    setValidation(null);
    clearZoom();
    void history.load(history.fromDate, history.throughDate);
  };
  const choosePreset = (days: number | 'all' | 'today') => {
    setValidation(null);
    clearZoom();
    history.preset(days);
  };
  return <div class="history-page">
    <header class="history-header">
      <div><p class="eyebrow"><Icon name="chart"/>{t('history')}</p><h1>{t('historyTitle')}</h1><p>{t('historyIntro')}</p></div>
      {history.summary && <div class="applied-summary"><span>{t('appliedRange', {
        from: history.summary.range.mode === 'instants' ? dateTimeSeconds(history.summary.range.from_unix_ms, locale, history.summary.range.timezone) : calendarDate(history.summary.range.from_date, locale),
        through: history.summary.range.mode === 'instants' ? dateTimeSeconds(history.summary.range.to_unix_ms, locale, history.summary.range.timezone) : calendarDate(history.summary.range.through_date, locale),
      })}</span><span class="observation-count">{t('observations', { count: number(history.summary.sample_count, locale, 0) })}</span></div>}
    </header>
    <form class="range-form" onSubmit={submit}>
      <label>{t('fromDate')}<input type="date" value={history.fromDate} max={history.throughDate || undefined} onInput={(event) => { setValidation(null); history.setFromDate(event.currentTarget.value); }}/></label>
      <label>{t('throughDate')}<input type="date" value={history.throughDate} min={history.fromDate || undefined} onInput={(event) => { setValidation(null); history.setThroughDate(event.currentTarget.value); }}/></label>
      <button class="primary-button" type="submit" disabled={history.loading}>{t('showRange')}</button>
      <div class="presets" aria-label={t('historyTitle')}><button type="button" onClick={() => choosePreset('today')}>{t('today')}</button><button type="button" onClick={() => choosePreset(7)}>{t('last7Days')}</button><button type="button" onClick={() => choosePreset(14)}>{t('last14Days')}</button><button type="button" onClick={() => choosePreset(history.fullHistoryFits ? 'all' : 366)}>{t(history.fullHistoryFits ? 'allData' : 'recent366Days')}</button></div>
      {validation && <p class="form-error" role="alert">{t(validation === 'limit' ? 'rangeLimitError' : 'rangeError')}</p>}
    </form>
    {history.error && <div class="alert-banner error" role="alert"><Icon name="alert"/><span>{history.busy ? t('historyBusy') : history.tooLarge ? t('historyTooLarge') : history.invalid ? t('historyInvalid') : t('historyError')}</span>{!history.invalid && <button class="inline-action" type="button" onClick={() => void history.retry()}>{t('retry')}</button>}</div>}
    {history.loading && !history.summary ? <HistoryLoading/> : history.summary && history.summary.sample_count > 0 ? <>
      <SummaryCards summary={history.summary}/>
      <Charts summary={history.summary} proposal={zoomProposal} resetVersion={zoomResetVersion} applying={history.loading} onZoom={handleZoom} onApplyZoom={applyZoom} onResetZoom={clearZoom}/>
      <ReadingsTable rows={history.rows} timezone={history.summary.range.timezone} hasMore={history.hasMore} loadingMore={history.loading || history.loadingMore} onLoadMore={() => void history.loadMore()}/>
    </> : <section class="empty-history"><Icon name="chart" size={48}/><h2>{t('noHistory')}</h2><p>{t('noHistoryDetail')}</p></section>}
  </div>;
}
