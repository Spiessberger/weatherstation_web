import type { ComponentChildren } from 'preact';
import { Icon } from './Icons';
import { useI18n } from '../i18n';

export type Route = 'dashboard' | 'history';

export function AppShell({ route, onNavigate, children }: {
  route: Route;
  onNavigate: (route: Route) => void;
  children: ComponentChildren;
}) {
  const { locale, setLocale, t } = useI18n();
  const navigate = (next: Route, event: MouseEvent) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onNavigate(next);
  };
  return <>
    <a class="skip-link" href="#main">{t('skipContent')}</a>
    <header class="site-header">
      <div class="header-inner">
        <a class="brand" href="/" onClick={(event) => navigate('dashboard', event)} aria-label={t('appName')}>
          <span class="brand-mark"><Icon name="cloud-sun" size={27}/></span>
          <span><strong>{t('appName')}</strong><small>{t('appTagline')}</small></span>
        </a>
        <nav class="main-nav" aria-label={t('appName')}>
          <a href="/" class={route === 'dashboard' ? 'active' : ''} aria-current={route === 'dashboard' ? 'page' : undefined} onClick={(event) => navigate('dashboard', event)}><Icon name="home"/>{t('overview')}</a>
          <a href="/history-view" class={route === 'history' ? 'active' : ''} aria-current={route === 'history' ? 'page' : undefined} onClick={(event) => navigate('history', event)}><Icon name="chart"/>{t('history')}</a>
        </nav>
        <div class="locale-switch" role="group" aria-label={t('switchLanguage')}>
          <button type="button" class={locale === 'de' ? 'active' : ''} aria-pressed={locale === 'de'} onClick={() => setLocale('de')}>DE</button>
          <button type="button" class={locale === 'en' ? 'active' : ''} aria-pressed={locale === 'en'} onClick={() => setLocale('en')}>EN</button>
        </div>
      </div>
    </header>
    <main id="main" class="page-shell" tabIndex={-1}>{children}</main>
    <footer class="site-footer"><span>{t('appName')}</span><span>•</span><span>{t('appTagline')}</span></footer>
  </>;
}
