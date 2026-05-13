import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface ThemeCtx { dark: boolean; toggle: () => void; }

const Ctx = createContext<ThemeCtx>({ dark: false, toggle: () => {} });

function getStored(): boolean {
  try {
    const s = localStorage.getItem('theme');
    if (s === 'dark') return true;
    if (s === 'light') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

function applyTheme(dark: boolean) {
  if (dark) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
  try { localStorage.setItem('theme', dark ? 'dark' : 'light'); } catch {}
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [dark, setDark] = useState(getStored);

  useEffect(() => {
    applyTheme(dark);
  }, [dark]);

  return (
    <Ctx.Provider value={{ dark, toggle: () => setDark((d) => !d) }}>
      {children}
    </Ctx.Provider>
  );
}

export const useTheme = () => useContext(Ctx);
