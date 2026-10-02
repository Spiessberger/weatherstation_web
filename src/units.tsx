import { createContext } from 'preact';
import type { ComponentChildren } from 'preact';
import { useContext, useMemo, useState } from 'preact/hooks';
import type { WindUnit } from './format';

interface UnitsValue {
  windUnit: WindUnit;
  setWindUnit: (unit: WindUnit) => void;
}

const UnitsContext = createContext<UnitsValue | null>(null);
const WIND_STORAGE_KEY = 'weatherstation.windUnit';

export function getInitialWindUnit(storage: Pick<Storage, 'getItem'> | null = typeof localStorage === 'undefined' ? null : localStorage): WindUnit {
  return storage?.getItem(WIND_STORAGE_KEY) === 'kmh' ? 'kmh' : 'mps';
}

export function UnitsProvider({ children }: { children: ComponentChildren }) {
  const [windUnit, updateWindUnit] = useState<WindUnit>(getInitialWindUnit);
  const value = useMemo<UnitsValue>(() => ({
    windUnit,
    setWindUnit: (next) => {
      localStorage.setItem(WIND_STORAGE_KEY, next);
      updateWindUnit(next);
    },
  }), [windUnit]);
  return <UnitsContext.Provider value={value}>{children}</UnitsContext.Provider>;
}

export function useUnits(): UnitsValue {
  const context = useContext(UnitsContext);
  if (!context) throw new Error('useUnits must be used within UnitsProvider');
  return context;
}
