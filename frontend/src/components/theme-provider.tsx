'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import {
  applyThemeToRoot,
  CUSTOM_THEME_ID,
  CUSTOM_THEME_STORAGE_KEY,
  DEFAULT_CUSTOM_THEME,
  DEFAULT_THEME,
  isThemeId,
  normalizeCustomTheme,
  parseStoredCustomTheme,
  THEME_STORAGE_KEY,
  type CustomThemeConfig,
  type ThemeId,
} from '@/lib/theme';

type ThemeContextValue = {
  theme: ThemeId;
  customTheme: CustomThemeConfig;
  setTheme: (theme: ThemeId) => void;
  setCustomTheme: (theme: Partial<CustomThemeConfig>) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [theme, setThemeState] = useState<ThemeId>(DEFAULT_THEME);
  const [customTheme, setCustomThemeState] = useState<CustomThemeConfig>(
    DEFAULT_CUSTOM_THEME,
  );

  useEffect(() => {
    const root = document.documentElement;

    let storedCustomTheme = DEFAULT_CUSTOM_THEME;

    try {
      storedCustomTheme =
        parseStoredCustomTheme(window.localStorage.getItem(CUSTOM_THEME_STORAGE_KEY)) ??
        DEFAULT_CUSTOM_THEME;
    } catch { }

    setCustomThemeState(storedCustomTheme);

    const appliedTheme = root.dataset.theme;

    if (isThemeId(appliedTheme)) {
      setThemeState(appliedTheme);
      applyThemeToRoot(root, appliedTheme, storedCustomTheme);
      return;
    }

    try {
      const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);

      if (isThemeId(storedTheme)) {
        setThemeState(storedTheme);
        applyThemeToRoot(root, storedTheme, storedCustomTheme);
        return;
      }
    } catch { }

    applyThemeToRoot(root, DEFAULT_THEME, storedCustomTheme);
  }, []);

  function setTheme(nextTheme: ThemeId) {
    setThemeState(nextTheme);
    applyThemeToRoot(document.documentElement, nextTheme, customTheme);

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch { }
  }

  function setCustomTheme(nextTheme: Partial<CustomThemeConfig>) {
    const normalizedTheme = normalizeCustomTheme(nextTheme);

    setCustomThemeState(normalizedTheme);
    setThemeState(CUSTOM_THEME_ID);
    applyThemeToRoot(document.documentElement, CUSTOM_THEME_ID, normalizedTheme);

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, CUSTOM_THEME_ID);
      window.localStorage.setItem(
        CUSTOM_THEME_STORAGE_KEY,
        JSON.stringify(normalizedTheme),
      );
    } catch { }
  }

  return (
    <ThemeContext.Provider value={{ theme, customTheme, setTheme, setCustomTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider.');
  }

  return context;
}
