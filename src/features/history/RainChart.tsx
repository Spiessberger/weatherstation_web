import type { ComponentProps } from 'preact';
import { useMemo } from 'preact/hooks';
import { TimeChart, type ChartSeries } from '../../components/TimeChart';
import type { HistorySummary, RainBucket, RainGrouping } from '../../api/types';
import { dateTimeSeconds, rain, type Locale } from '../../format';
import { useI18n, type MessageKey } from '../../i18n';

const groupingLabels: Record<RainGrouping, MessageKey> = {
  auto: 'rainAuto', hour: 'rainHourly', day: 'rainDaily', week: 'rainWeekly', month: 'rainMonthly',
};

export function rainIntervalLabel(bucket: RainBucket, locale: Locale, timezone: string, grouping: RainGrouping = 'hour'): string {
  const localeTag = locale === 'de' ? 'de-AT' : 'en-GB';
  if (!bucket.partial_period && grouping !== 'hour') {
    const dates = new Intl.DateTimeFormat(localeTag, {
      timeZone: timezone, year: 'numeric', month: 'short', ...(grouping !== 'month' ? { day: 'numeric' } as const : {}),
    });
    return grouping === 'week' ? dates.formatRange(bucket.from_unix_ms, bucket.to_unix_ms - 1) : dates.format(bucket.from_unix_ms);
  }
  // Include the UTC offset so the two autumn 02:00 hours are unambiguous.
  const format = new Intl.DateTimeFormat(localeTag, {
    timeZone: timezone, year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZoneName: 'shortOffset',
  });
  return `${format.format(bucket.from_unix_ms)} – ${format.format(bucket.to_unix_ms)}`;
}

const barStatus = (bucket: RainBucket) => bucket.future ? 'future' as const : bucket.rain.coverage;

type Props = Omit<ComponentProps<typeof TimeChart<RainBucket>>, 'chartId' | 'title' | 'buckets' | 'series' | 'kind'> & {
  summary: HistorySummary;
  grouping: RainGrouping;
  loading: boolean;
  error: Error | null;
  onGrouping: (grouping: RainGrouping) => void;
};

export function RainChart({ summary, grouping, loading, error, onGrouping, ...chart }: Props) {
  const { locale, t } = useI18n();
  const series = useMemo<ChartSeries<RainBucket>[]>(() => [
    { label: t('totalRain'), color: '#4daec3', value: (b) => b.rain.total_mm, format: (v) => rain(v, locale) },
  ], [locale, t]);
  const unavailable = grouping !== 'auto' && !summary.available_rain_groupings.includes(grouping);
  return <TimeChart {...chart} chartId="rain" title={t('chartRain')} kind="bars"
    buckets={summary.rain_buckets} series={series} barStatus={barStatus}
    controls={<div class="rain-controls">
      <label>{t('rainGroupBy')}
        <select value={grouping} disabled={loading} onChange={(event) => onGrouping(event.currentTarget.value as RainGrouping)}>
          {(['auto', 'hour', 'day', 'week', 'month'] as const).map((value) => <option key={value} value={value}
            disabled={value !== 'auto' && !summary.available_rain_groupings.includes(value)}>
            {value === 'auto' && grouping === 'auto' ? `${t('rainAuto')} (${t(groupingLabels[summary.rain_grouping])})` : t(groupingLabels[value])}
          </option>)}
        </select>
      </label>
      <span class="rain-resolution" role="status">{loading ? t('loadingMore') : t('rainShownAs', { grouping: t(groupingLabels[summary.rain_grouping]) })}</span>
      {unavailable && <p class="rain-hint">{t('rainGroupingFallback', { grouping: t(groupingLabels[summary.rain_grouping]) })}</p>}
      {!summary.available_rain_groupings.includes('hour') && !unavailable && <p class="rain-hint">{t('rainHourLimit')}</p>}
      {error && <p class="rain-error" role="alert">{t('rainLoadError')} <button type="button" class="inline-action" onClick={() => onGrouping(grouping)}>{t('retry')}</button></p>}
      <div class="rain-coverage-legend"><span><i class="rain-partial"/>{t('coveragePartial')}</span><span><i class="rain-missing"/>{t('unavailable')}</span></div>
    </div>}
    renderInspector={(bucket) => <>
      <strong>{rainIntervalLabel(bucket, locale, chart.timezone, summary.rain_grouping)}</strong>
      <span>{t('totalRain')}: <b>{bucket.future ? t('rainFuture') : rain(bucket.rain.total_mm, locale)}</b></span>
      {bucket.partial_period && <span>{t('rainPartialPeriod')}</span>}
      {bucket.ongoing && <span>{t('rainSoFar', { time: dateTimeSeconds(bucket.observed_through_unix_ms, locale, chart.timezone) })}</span>}
      {!bucket.future && <span class={`coverage ${bucket.rain.coverage}`}>{t(bucket.rain.coverage === 'complete' ? 'coverageComplete' : bucket.rain.coverage === 'partial' ? 'coveragePartial' : 'coverageUnavailable')}</span>}
    </>}
  />;
}
