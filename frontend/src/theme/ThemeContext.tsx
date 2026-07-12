import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { ThemeName, themeTokens } from './themeTokens';

interface ThemeContextValue {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const STORAGE_KEY = 'theme';

const getPreferredTheme = (): ThemeName => {
  if (typeof window === 'undefined') return 'light';
  const stored = window.localStorage.getItem(STORAGE_KEY) as ThemeName | null;
  if (stored === 'light' || stored === 'dark') {
    return stored;
  }
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  return prefersDark ? 'dark' : 'light';
};

const applyTheme = (theme: ThemeName) => {
  const tokens = themeTokens[theme];
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  root.style.setProperty('--color-bg', tokens.colorBg);
  root.style.setProperty('--color-bg-rgb', tokens.colorBgRgb);
  root.style.setProperty('--color-panel-bg', tokens.colorPanelBg);
  root.style.setProperty('--color-panel-bg-rgb', tokens.colorPanelBgRgb);
  root.style.setProperty('--color-border', tokens.colorBorder);
  root.style.setProperty('--color-accent', tokens.colorAccent);
  root.style.setProperty('--color-accent-hover', tokens.colorAccentHover);
  root.style.setProperty('--color-text-primary', tokens.colorTextPrimary);
  root.style.setProperty('--color-text-secondary', tokens.colorTextSecondary);
  root.style.setProperty('--color-text-tertiary', tokens.colorTextTertiary);
  root.style.setProperty('--color-text-placeholder', tokens.colorTextPlaceholder);
  root.style.setProperty('--color-bubble-sent', tokens.colorBubbleSent);
  root.style.setProperty('--color-bubble-received', tokens.colorBubbleReceived);
  root.style.setProperty('--color-surface', tokens.colorSurface);
  root.style.setProperty('--color-surface-soft', tokens.colorSurfaceSoft);
  root.style.setProperty('--color-surface-soft-rgb', tokens.colorSurfaceSoftRgb);
  root.style.setProperty('--color-surface-elevated', tokens.colorSurfaceElevated);
  root.style.setProperty('--color-surface-rgb', tokens.colorSurfaceRgb);
  root.style.setProperty('--color-surface-overlay', tokens.colorSurfaceOverlay);
  root.style.setProperty('--color-surface-muted', tokens.colorSurfaceMuted);
  root.style.setProperty('--color-surface-muted-strong', tokens.colorSurfaceMutedStrong);
  root.style.setProperty('--color-overlay', tokens.colorOverlay);
  root.style.setProperty('--color-on-accent', tokens.colorOnAccent);
  root.style.setProperty('--color-accent-muted', tokens.colorAccentMuted);
  root.style.setProperty('--color-accent-soft', tokens.colorAccentSoft);
  root.style.setProperty('--color-info', tokens.colorInfo);
  root.style.setProperty('--color-info-rgb', tokens.colorInfoRgb);
  root.style.setProperty('--color-google-blue', tokens.colorGoogleBlue);
  root.style.setProperty('--color-google-green', tokens.colorGoogleGreen);
  root.style.setProperty('--color-google-yellow', tokens.colorGoogleYellow);
  root.style.setProperty('--color-google-red', tokens.colorGoogleRed);
  root.style.setProperty('--color-overlay-rgb', tokens.colorOverlayRgb);
  root.style.setProperty('--color-accent-rgb', tokens.accentRgb);
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeName>(() => getPreferredTheme());

  useEffect(() => {
    applyTheme(theme);
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const setTheme = useCallback((value: ThemeName) => {
    setThemeState(value);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  const value = useMemo(() => ({ theme, setTheme, toggleTheme }), [theme, setTheme, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export default ThemeContext;
