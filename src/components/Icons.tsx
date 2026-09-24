import type { JSX } from 'preact';

type IconName = 'cloud-sun' | 'chart' | 'home' | 'droplet' | 'moon' | 'wind' | 'humidity' |
  'thermometer' | 'signal' | 'database' | 'battery' | 'sun' | 'compass' | 'alert' | 'check' | 'clock';

export function Icon({ name, size = 20, ...props }: { name: IconName; size?: number } & JSX.SVGAttributes<SVGSVGElement>) {
  const paths: Record<IconName, JSX.Element> = {
    'cloud-sun': <><path d="M12 3V1.8M17.1 4.9l.9-.9M6.9 4.9 6 4M19 10h1.2M4 10H2.8"/><path d="M8.7 9.2A3.5 3.5 0 0 1 15.5 10c0 .4-.1.8-.2 1.1"/><path d="M7.5 18.5h9a3.5 3.5 0 0 0 .4-7 5 5 0 0 0-9.4 1.1 3 3 0 0 0 0 5.9Z"/></>,
    chart: <><path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/></>,
    home: <><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10M9 20v-6h6v6"/></>,
    droplet: <path d="M12 2S5 10 5 15a7 7 0 0 0 14 0c0-5-7-13-7-13Z"/>,
    moon: <path d="M20 15.2A8.6 8.6 0 0 1 8.8 4 8.7 8.7 0 1 0 20 15.2Z"/>,
    wind: <><path d="M3 8h10a2.5 2.5 0 1 0-2.2-3.7M3 12h16a2.5 2.5 0 1 1-2.2 3.7M3 16h7"/></>,
    humidity: <><path d="M12 3S6 10 6 15a6 6 0 0 0 12 0c0-5-6-12-6-12Z"/><path d="M9 16c.5 1.4 1.5 2 3 2"/></>,
    thermometer: <><path d="M10 14.8V5a2 2 0 1 1 4 0v9.8a4 4 0 1 1-4 0Z"/><path d="M12 8v8"/></>,
    signal: <><path d="M5 12.5a10 10 0 0 1 14 0M8 15.5a6 6 0 0 1 8 0M11 18.5a2 2 0 0 1 2 0"/><circle cx="12" cy="20" r=".6" fill="currentColor"/></>,
    database: <><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7"/></>,
    battery: <><rect x="3" y="7" width="17" height="10" rx="2"/><path d="M20 10h2v4h-2M6 10v4"/></>,
    sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></>,
    compass: <><circle cx="12" cy="12" r="9"/><path d="m15 7-2 6-6 2 2-6 6-2Z"/></>,
    alert: <><path d="M10.3 3.7 2.2 18a2 2 0 0 0 1.8 3h16a2 2 0 0 0 1.8-3L13.7 3.7a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/></>,
    check: <path d="m4 12 5 5L20 6"/>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" {...props}>{paths[name]}</svg>;
}
