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

function getStoredCustomThemeState() {
  if (typeof window === 'undefined') {
    return DEFAULT_CUSTOM_THEME;
  }

  try {
    return (
      parseStoredCustomTheme(window.localStorage.getItem(CUSTOM_THEME_STORAGE_KEY)) ??
      DEFAULT_CUSTOM_THEME
    );
  } catch {
    return DEFAULT_CUSTOM_THEME;
  }
}

function getStoredThemeState() {
  if (typeof document !== 'undefined') {
    const appliedTheme = document.documentElement.dataset.theme;

    if (isThemeId(appliedTheme)) {
      return appliedTheme;
    }
  }

  if (typeof window === 'undefined') {
    return DEFAULT_THEME;
  }

  try {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);

    if (isThemeId(storedTheme)) {
      return storedTheme;
    }
  } catch { }

  return DEFAULT_THEME;
}

export function ThemeProvider({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [theme, setThemeState] = useState<ThemeId>(getStoredThemeState);
  const [customTheme, setCustomThemeState] = useState<CustomThemeConfig>(
    getStoredCustomThemeState,
  );

  useEffect(() => {
    applyThemeToRoot(document.documentElement, theme, customTheme);
  }, [customTheme, theme]);

  function setTheme(nextTheme: ThemeId) {
    setThemeState(nextTheme);

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch { }
  }

  function setCustomTheme(nextTheme: Partial<CustomThemeConfig>) {
    const normalizedTheme = normalizeCustomTheme(nextTheme);

    setCustomThemeState(normalizedTheme);
    setThemeState(CUSTOM_THEME_ID);

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
