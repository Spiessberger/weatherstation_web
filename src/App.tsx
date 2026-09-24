import { useEffect, useState } from 'preact/hooks';
import { AppShell, type Route } from './components/AppShell';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { HistoryPage } from './features/history/HistoryPage';

function routeFromPath(pathname: string): Route {
  return pathname.startsWith('/history-view') ? 'history' : 'dashboard';
}

export function App() {
  const [route, setRoute] = useState<Route>(() => routeFromPath(window.location.pathname));
  useEffect(() => {
    const onPopState = () => setRoute(routeFromPath(window.location.pathname));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);
  const navigate = (next: Route) => {
    const path = next === 'history' ? '/history-view' : '/';
    if (window.location.pathname !== path) window.history.pushState({}, '', path);
    setRoute(next);
    window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };
  return <AppShell route={route} onNavigate={navigate}>
    {route === 'dashboard' ? <DashboardPage /> : <HistoryPage />}
  </AppShell>;
}
