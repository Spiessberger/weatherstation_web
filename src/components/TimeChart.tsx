import uPlot, { type AlignedData, type Options, type Series } from 'uplot';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { HistoryBucket } from '../api/types';
import type { Locale } from '../format';
import { dateTime, dateTimeSeconds } from '../format';
import { useI18n } from '../i18n';

export interface ChartSeries {
  label: string;
  color: string;
  value: (bucket: HistoryBucket) => number | null;
  format: (value: number | null) => string;
  fill?: string;
  width?: number;
}

export interface ExactRange {
  fromUnixMs: number;
  toUnixMs: number;
}

export function scaleToExactRange(
  minSeconds: number | undefined,
  maxSeconds: number | undefined,
  applied: ExactRange,
): ExactRange | null {
  if (!Number.isFinite(minSeconds) || !Number.isFinite(maxSeconds)) return null;
  const fromUnixMs = Math.max(applied.fromUnixMs, Math.ceil(minSeconds! * 1000));
  const toUnixMs = Math.min(applied.toUnixMs, Math.ceil(maxSeconds! * 1000));
  if (!Number.isSafeInteger(fromUnixMs) || !Number.isSafeInteger(toUnixMs) || fromUnixMs >= toUnixMs) return null;
  if (fromUnixMs === applied.fromUnixMs && toUnixMs === applied.toUnixMs) return null;
  return { fromUnixMs, toUnixMs };
}

export function TimeChart({ chartId, title, buckets, series, timezone, locale, appliedRange, proposal,
  resetVersion, applying, onZoom, onApplyZoom, onResetZoom, kind = 'line' }: {
  chartId: string;
  title: string;
  buckets: HistoryBucket[];
  series: ChartSeries[];
  timezone: string;
  locale: Locale;
  appliedRange: ExactRange;
  proposal: ExactRange | null;
  resetVersion: number;
  applying: boolean;
  onZoom: (chartId: string, range: ExactRange | null) => void;
  onApplyZoom: () => void;
  onResetZoom: () => void;
  kind?: 'line' | 'bars';
}) {
  const { t } = useI18n();
  const host = useRef<HTMLDivElement>(null);
  const plot = useRef<uPlot | null>(null);
  const suppressScale = useRef(false);
  const previousReset = useRef(resetVersion);
  const [selected, setSelected] = useState<number | null>(null);
  const aligned = useMemo<AlignedData>(() => [
    buckets.map((bucket) => (bucket.from_unix_ms + bucket.to_unix_ms) / 2000),
    ...series.map((item) => buckets.map(item.value)),
  ] as AlignedData, [buckets, series]);

  useEffect(() => {
    if (!host.current || buckets.length === 0) return;
    const element = host.current;
    let userDragging = false;
    const lineSeries: Series[] = series.map((item) => ({
      label: item.label,
      stroke: item.color,
      fill: item.fill,
      width: item.width ?? 2,
      spanGaps: false,
      points: { show: false },
      ...(kind === 'bars' ? { paths: uPlot.paths.bars?.({ size: [0.6, 100] }) } : {}),
    }));
    const localeTag = locale === 'de' ? 'de-AT' : 'en-GB';
    const duration = buckets.at(-1)!.to_unix_ms - buckets[0].from_unix_ms;
    const axisDate = new Intl.DateTimeFormat(localeTag, {
      timeZone: timezone,
      ...(duration <= 2 * 86_400_000
        ? { hour: '2-digit', minute: '2-digit' }
        : duration <= 120 * 86_400_000
          ? { day: '2-digit', month: 'short' }
          : { month: 'short', year: '2-digit' }),
    });
    const axisNumber = new Intl.NumberFormat(localeTag, { maximumFractionDigits: 1 });
    let ready = false;
    const fullFromSeconds = appliedRange.fromUnixMs / 1000;
    const fullToSeconds = appliedRange.toUnixMs / 1000;
    const initialView = proposal ?? appliedRange;
    let initialXRange = true;
    const options: Options = {
      width: Math.max(280, element.clientWidth),
      height: 250,
      tzDate: (timestamp) => uPlot.tzDate(new Date(timestamp * 1000), timezone),
      padding: [16, 8, 0, 0],
      legend: { show: false },
      cursor: { sync: { key: 'weather-history' }, drag: { x: true, y: false } },
      scales: { x: { time: true, range: (_plot, min, max) => {
        if (initialXRange) {
          initialXRange = false;
          return [initialView.fromUnixMs / 1000, initialView.toUnixMs / 1000];
        }
        return [min, max];
      } }, y: { auto: true } },
      axes: [
        { stroke: '#8097a1', grid: { stroke: 'rgba(145, 171, 180, .13)', width: 1 }, ticks: { stroke: 'rgba(145, 171, 180, .22)' }, font: '11px Inter, system-ui', values: (_plot, splits) => splits.map((value) => axisDate.format(value * 1000)) },
        { stroke: '#8097a1', grid: { stroke: 'rgba(145, 171, 180, .13)', width: 1 }, ticks: { stroke: 'rgba(145, 171, 180, .22)' }, font: '11px Inter, system-ui', size: 50, values: (_plot, splits) => splits.map((value) => axisNumber.format(value)) },
      ],
      series: [{ label: t('receivedAt') }, ...lineSeries],
      hooks: {
        ready: [() => { ready = true; }],
        setScale: [(instance, scaleKey) => {
          if (!ready || !userDragging || suppressScale.current || scaleKey !== 'x') return;
          const scale = instance.scales.x;
          onZoom(chartId, scaleToExactRange(scale.min, scale.max, appliedRange));
        }],
        setCursor: [(instance) => {
          if (instance.cursor.idx != null) setSelected(instance.cursor.idx);
        }],
      },
    };
    const instance = new uPlot(options, aligned, element);
    plot.current = instance;
    const startDrag = () => { userDragging = true; };
    const finishDrag = () => { userDragging = false; };
    const resetNativeZoom = () => { onResetZoom(); };
    instance.over.addEventListener('mousedown', startDrag);
    instance.over.addEventListener('dblclick', resetNativeZoom);
    window.addEventListener('mouseup', finishDrag);
    const resize = new ResizeObserver(([entry]) => {
      instance.setSize({ width: Math.max(280, Math.floor(entry.contentRect.width)), height: 250 });
    });
    resize.observe(element);
    return () => {
      resize.disconnect();
      instance.over.removeEventListener('mousedown', startDrag);
      instance.over.removeEventListener('dblclick', resetNativeZoom);
      window.removeEventListener('mouseup', finishDrag);
      instance.destroy();
      plot.current = null;
    };
  }, [aligned, appliedRange, buckets, chartId, kind, locale, onResetZoom, onZoom, series, t, timezone]);

  useEffect(() => {
    setSelected(null);
  }, [buckets]);

  useEffect(() => {
    if (previousReset.current === resetVersion) return;
    previousReset.current = resetVersion;
    const instance = plot.current;
    if (!instance) return;
    suppressScale.current = true;
    instance.setScale('x', { min: appliedRange.fromUnixMs / 1000, max: appliedRange.toUnixMs / 1000 });
    suppressScale.current = false;
    setSelected(null);
  }, [appliedRange, resetVersion]);

  const select = (index: number) => {
    const bounded = Math.max(0, Math.min(buckets.length - 1, index));
    setSelected(bounded);
    const timestamp = (buckets[bounded].from_unix_ms + buckets[bounded].to_unix_ms) / 2000;
    const left = plot.current?.valToPos(timestamp, 'x') ?? 0;
    plot.current?.setCursor({ left, top: 50 });
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      select((selected ?? (event.key === 'ArrowLeft' ? buckets.length : -1)) + (event.key === 'ArrowLeft' ? -1 : 1));
    }
  };
  const bucket = selected == null ? null : buckets[selected];

  return <article class="chart-card">
    <div class="chart-title"><h3>{title}</h3><span>{t('chartZoomHelp')}</span></div>
    <div class="chart-legend" aria-hidden="true">{series.map((item) => <span key={item.label}><i style={{ background: item.color }}/>{item.label}</span>)}</div>
    <div class="plot-focus" tabIndex={0} onKeyDown={onKeyDown} aria-label={`${title}. ${t('chartKeyboardHelp')}`}>
      <div ref={host} class="plot-host" aria-hidden="true" />
    </div>
    {proposal && <div class="zoom-action" role="status">
      <div><small>{t('visiblePeriod')}</small><strong>{dateTimeSeconds(proposal.fromUnixMs, locale, timezone)} – {dateTimeSeconds(proposal.toUnixMs, locale, timezone)}</strong></div>
      <span><button type="button" onClick={onResetZoom} disabled={applying} aria-label={t('resetChartView')}>{t('resetZoomShort')}</button><button class="apply" type="button" onClick={onApplyZoom} disabled={applying} aria-label={t('applyVisiblePeriod')}>{applying ? t('loadingMore') : t('applyZoomShort')}</button></span>
    </div>}
    <div class="chart-inspector" aria-live="polite">
      {bucket ? <>
        <strong>{dateTime((bucket.from_unix_ms + bucket.to_unix_ms) / 2, locale, timezone)}</strong>
        {series.map((item) => <span key={item.label}><i style={{ background: item.color }}/>{item.label}: <b>{item.format(item.value(bucket))}</b></span>)}
      </> : <span>{t('chartKeyboardHelp')}</span>}
    </div>
  </article>;
}
