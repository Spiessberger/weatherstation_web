import { createContext } from 'preact';
import type { ComponentChildren } from 'preact';
import { useContext, useEffect, useMemo, useState } from 'preact/hooks';
import type { Locale } from './format';

const de = {
  appName: 'Wetterstation',
  appTagline: 'Wetter bei uns zuhause',
  overview: 'Übersicht',
  history: 'Verlauf',
  switchLanguage: 'Sprache wechseln',
  german: 'Deutsch',
  english: 'English',
  skipContent: 'Zum Inhalt springen',
  live: 'Live',
  stale: 'Veraltet',
  retained: 'Gespeicherter Wert',
  offline: 'Gateway offline',
  updated: 'Aktualisiert {age}',
  exactTime: 'Empfangen: {time}',
  currentWeather: 'Wetter draußen',
  noWeather: 'Noch keine Wetterdaten',
  noWeatherDetail: 'Sobald die Station eine Messung sendet, erscheint sie hier.',
  temperature: 'Temperatur',
  feelsNow: 'Aktuelle Außenbedingungen',
  humidity: 'Luftfeuchte',
  wind: 'Wind',
  windAverage: 'Wind Ø',
  windMaximum: 'Wind max.',
  gust: 'Böen',
  direction: 'Richtung',
  rain24h: 'Regen · 24 Stunden',
  rainCounter: 'Stationszähler',
  nightMinimum: 'Tiefstwert der Nacht',
  currentNight: 'Laufende Nacht · 18–06 Uhr',
  lastNight: 'Letzte Nacht · 18–06 Uhr',
  incompleteRain: 'Unvollständige Abdeckung',
  unavailable: 'Nicht verfügbar',
  inside: 'Innenraum',
  indoorClimate: 'Raumklima',
  stationDetails: 'Station & Empfang',
  gateway: 'Gateway',
  connected: 'Verbunden',
  disconnected: 'Nicht verbunden',
  database: 'Datenbank',
  logs: 'Protokolle',
  healthy: 'Bereit',
  disrupted: 'Störung',
  signal: 'Signal',
  linkQuality: 'Verbindungsqualität',
  battery: 'Batterie',
  batteryGood: 'In Ordnung',
  batteryLow: 'Batterie schwach',
  uvIndex: 'UV-Index',
  brightness: 'Helligkeit',
  stationId: 'Stations-ID',
  missingReadings: 'Erkannte Datenlücken',
  restarts: 'Gateway-Neustarts',
  loading: 'Wetterdaten werden geladen …',
  retry: 'Erneut versuchen',
  liveError: 'Live-Verbindung unterbrochen. Der letzte Wert bleibt sichtbar.',
  dashboardError: 'Zusammenfassung konnte nicht aktualisiert werden.',
  storageWarning: 'Ein Teil der Daten kann derzeit nicht gespeichert werden.',
  dismiss: 'Hinweis schließen',
  historyTitle: 'Wetterverlauf',
  historyIntro: 'Zeitraum wählen und das Wetter im Detail erkunden.',
  fromDate: 'Von',
  throughDate: 'Bis einschließlich',
  showRange: 'Zeitraum anzeigen',
  today: 'Heute',
  last7Days: '7 Tage',
  last14Days: '14 Tage',
  allData: 'Alle Daten',
  recent366Days: 'Letzte 366 Tage',
  rangeError: 'Das Anfangsdatum darf nicht nach dem Enddatum liegen.',
  rangeLimitError: 'Der Zeitraum darf höchstens 366 Tage umfassen. Bitte wähle einen kürzeren Zeitraum.',
  historyError: 'Der Verlauf konnte nicht geladen werden.',
  historyBusy: 'Die Auswertung ist gerade ausgelastet. Bitte gleich noch einmal versuchen.',
  historyTooLarge: 'Für diesen Zeitraum gibt es zu viele Messungen. Bitte wähle einen kürzeren Zeitraum.',
  historyInvalid: 'Dieser Zeitraum kann nicht ausgewertet werden. Bitte prüfe die Datumsangaben.',
  noHistory: 'Keine Messungen in diesem Zeitraum',
  noHistoryDetail: 'Wähle einen anderen Zeitraum oder prüfe, ob die Station Daten empfangen hat.',
  observations: '{count} Messungen',
  appliedRange: '{from} – {through}',
  rangeSummary: 'Zusammenfassung',
  minTemperature: 'Temperatur min.',
  maxTemperature: 'Temperatur max.',
  totalRain: 'Regen gesamt',
  maxGust: 'Stärkste Böe',
  partialCoverage: 'Schätzwert · Datenlücken im Zeitraum',
  chartTemperature: 'Temperaturverlauf',
  chartHumidity: 'Luftfeuchte',
  chartWind: 'Wind und Böen',
  chartRain: 'Regen je Zeitabschnitt',
  minimum: 'Minimum',
  maximum: 'Maximum',
  average: 'Mittelwert',
  selectPrevious: 'Vorherigen Zeitpunkt wählen',
  selectNext: 'Nächsten Zeitpunkt wählen',
  chartKeyboardHelp: 'Mit linker und rechter Pfeiltaste Werte erkunden.',
  chartZoomHelp: 'Horizontal ziehen, um einen Zeitraum zu vergrößern.',
  visiblePeriod: 'Sichtbarer Zeitraum',
  applyVisiblePeriod: 'Sichtbaren Zeitraum übernehmen',
  resetChartView: 'Diagramm zurücksetzen',
  applyZoomShort: 'Übernehmen',
  resetZoomShort: 'Zurücksetzen',
  rawReadings: 'Einzelmessungen',
  rawReadingsIntro: 'Empfangene Rohwerte in zeitlicher Reihenfolge.',
  receivedAt: 'Empfangen',
  loadMore: 'Weitere laden',
  loadingMore: 'Wird geladen …',
  allLoaded: 'Alle Messungen geladen',
  rowsShown: '{count} Messungen angezeigt',
  tableScrollHint: 'Tabelle horizontal scrollbar',
  coverageComplete: 'Vollständige Abdeckung',
  coveragePartial: 'Teilweise Abdeckung',
  coverageUnavailable: 'Keine vergleichbaren Regenwerte',
  details: 'Details',
  light: 'Licht',
  uv: 'UV',
  rowId: 'Nr.',
} as const;

const en: Record<keyof typeof de, string> = {
  appName: 'Weather station', appTagline: 'Weather at home', overview: 'Overview', history: 'History',
  switchLanguage: 'Change language', german: 'Deutsch', english: 'English', skipContent: 'Skip to content',
  live: 'Live', stale: 'Stale', retained: 'Stored reading', offline: 'Gateway offline', updated: 'Updated {age}',
  exactTime: 'Received: {time}', currentWeather: 'Weather outside', noWeather: 'No weather data yet',
  noWeatherDetail: 'It will appear here as soon as the station sends a reading.', temperature: 'Temperature',
  feelsNow: 'Current outdoor conditions', humidity: 'Humidity', wind: 'Wind', windAverage: 'Average wind',
  windMaximum: 'Maximum wind', gust: 'Gusts', direction: 'Direction', rain24h: 'Rain · 24 hours',
  rainCounter: 'Station counter', nightMinimum: 'Night minimum', currentNight: 'Current night · 18:00–06:00',
  lastNight: 'Last night · 18:00–06:00', incompleteRain: 'Incomplete coverage', unavailable: 'Unavailable',
  inside: 'Indoors', indoorClimate: 'Indoor climate', stationDetails: 'Station & reception', gateway: 'Gateway',
  connected: 'Connected', disconnected: 'Disconnected', database: 'Database', logs: 'Logs', healthy: 'Ready',
  disrupted: 'Problem', signal: 'Signal', linkQuality: 'Link quality', battery: 'Battery', batteryGood: 'Good',
  batteryLow: 'Low battery', uvIndex: 'UV index', brightness: 'Brightness', stationId: 'Station ID',
  missingReadings: 'Detected reading gaps', restarts: 'Gateway restarts', loading: 'Loading weather data …',
  retry: 'Try again', liveError: 'Live connection interrupted. The last reading remains visible.',
  dashboardError: 'The summary could not be refreshed.', storageWarning: 'Some data cannot currently be stored.',
  dismiss: 'Dismiss message', historyTitle: 'Weather history',
  historyIntro: 'Choose a date range and explore the weather in detail.', fromDate: 'From',
  throughDate: 'Through', showRange: 'Show range', today: 'Today', last7Days: '7 days', last14Days: '14 days',
  allData: 'All data', recent366Days: 'Latest 366 days', rangeError: 'The start date cannot be after the end date.',
  rangeLimitError: 'The range may cover at most 366 days. Please choose a shorter range.',
  historyError: 'History could not be loaded.', historyBusy: 'The analysis is busy. Please try again shortly.',
  historyTooLarge: 'There are too many readings in this range. Please choose a shorter range.',
  historyInvalid: 'This range cannot be analysed. Please check the dates.',
  noHistory: 'No readings in this range',
  noHistoryDetail: 'Choose a different range or check whether the station has received data.',
  observations: '{count} readings', appliedRange: '{from} – {through}', rangeSummary: 'Summary', minTemperature: 'Minimum temperature',
  maxTemperature: 'Maximum temperature', totalRain: 'Total rain', maxGust: 'Strongest gust',
  partialCoverage: 'Estimate · gaps in this range', chartTemperature: 'Temperature history',
  chartHumidity: 'Humidity', chartWind: 'Wind and gusts', chartRain: 'Rain per time period',
  minimum: 'Minimum', maximum: 'Maximum', average: 'Average',
  selectPrevious: 'Select previous point', selectNext: 'Select next point',
  chartKeyboardHelp: 'Use the left and right arrow keys to explore values.', rawReadings: 'Individual readings',
  chartZoomHelp: 'Drag horizontally to zoom into a period.', visiblePeriod: 'Visible period',
  applyVisiblePeriod: 'Use visible period', resetChartView: 'Reset chart view',
  applyZoomShort: 'Apply', resetZoomShort: 'Reset',
  rawReadingsIntro: 'Received raw values in chronological order.', receivedAt: 'Received', loadMore: 'Load more',
  loadingMore: 'Loading …', allLoaded: 'All readings loaded', rowsShown: '{count} readings shown',
  tableScrollHint: 'Table scrolls horizontally', coverageComplete: 'Complete coverage',
  coveragePartial: 'Partial coverage', coverageUnavailable: 'No comparable rain readings', details: 'Details',
  light: 'Light', uv: 'UV', rowId: 'No.',
};

export type MessageKey = keyof typeof de;

interface I18nValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey, values?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nValue | null>(null);
const STORAGE_KEY = 'weatherstation.locale';

export function getInitialLocale(storage: Pick<Storage, 'getItem'> | null = typeof localStorage === 'undefined' ? null : localStorage): Locale {
  return storage?.getItem(STORAGE_KEY) === 'en' ? 'en' : 'de';
}

export function I18nProvider({ children }: { children: ComponentChildren }) {
  const [locale, updateLocale] = useState<Locale>(getInitialLocale);
  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = locale === 'de' ? 'Wetterstation' : 'Weather station';
  }, [locale]);

  const value = useMemo<I18nValue>(() => ({
    locale,
    setLocale: (next) => {
      localStorage.setItem(STORAGE_KEY, next);
      updateLocale(next);
    },
    t: (key, values) => {
      let message: string = (locale === 'de' ? de : en)[key];
      for (const [name, replacement] of Object.entries(values ?? {})) {
        message = message.replace(`{${name}}`, String(replacement));
      }
      return message;
    },
  }), [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used within I18nProvider');
  return context;
}
