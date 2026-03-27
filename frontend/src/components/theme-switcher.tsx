'use client';

import { useEffect, useRef, useState } from 'react';
import {
  CUSTOM_THEME_ID,
  getThemeSwatches,
  THEMES,
  type CustomThemeConfig,
  type ThemeId,
} from '@/lib/theme';
import { useTheme } from '@/components/theme-provider';

const PRESET_THEMES = THEMES.filter((option) => option.id !== CUSTOM_THEME_ID);

const CUSTOM_COLOR_FIELDS: Array<{
  key: keyof CustomThemeConfig;
  ariaLabel: string;
}> = [
  {
    key: 'accent',
    ariaLabel: 'Pick accent color',
  },
  {
    key: 'background',
    ariaLabel: 'Pick background color',
  },
  {
    key: 'foreground',
    ariaLabel: 'Pick text color',
  },
];

export function ThemeSwitcher() {
  const { theme, customTheme, setTheme, setCustomTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const activeTheme = THEMES.find((option) => option.id === theme) ?? THEMES[0];
  const activeSwatches = getThemeSwatches(theme, customTheme);
  const customSwatches = getThemeSwatches(CUSTOM_THEME_ID, customTheme);
  const isCustomActive = theme === CUSTOM_THEME_ID;

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  function selectTheme(nextTheme: ThemeId) {
    setTheme(nextTheme);
    setIsOpen(false);
  }

  function updateCustomTheme(key: keyof CustomThemeConfig, value: string) {
    setCustomTheme({
      ...customTheme,
      [key]: value,
    });
  }

  return (
    <div
      ref={rootRef}
      className="theme-switcher glass-panel rounded-[24px] px-3 py-2"
    >
      <span className="theme-switcher__label">Theme</span>
      <div className="theme-switcher__control">
        <button
          type="button"
          className="theme-switcher__trigger"
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          onClick={() => setIsOpen((value) => !value)}
        >
          <span className="theme-switcher__swatches" aria-hidden="true">
            {activeSwatches.map((swatch) => (
              <span
                key={swatch}
                className="theme-switcher__swatch"
                style={{ backgroundColor: swatch }}
              />
            ))}
          </span>
          <span className="theme-switcher__trigger-copy">{activeTheme.label}</span>
          <span
            className={`theme-switcher__icon ${isOpen ? 'theme-switcher__icon--open' : ''}`}
            aria-hidden="true"
          >
            ▾
          </span>
        </button>

        {isOpen ? (
          <div className="theme-switcher__menu" aria-label="Choose theme">
            {PRESET_THEMES.map((option) => {
              const isActive = option.id === theme;

              return (
                <button
                  key={option.id}
                  type="button"
                  className={`theme-switcher__option ${isActive ? 'theme-switcher__option--active' : ''}`}
                  onClick={() => selectTheme(option.id)}
                >
                  <span className="theme-switcher__option-copy">
                    <span className="theme-switcher__swatches" aria-hidden="true">
                      {option.swatches.map((swatch) => (
                        <span
                          key={swatch}
                          className="theme-switcher__swatch"
                          style={{ backgroundColor: swatch }}
                        />
                      ))}
                    </span>
                    <span>{option.label}</span>
                  </span>
                  <span className="theme-switcher__option-state" aria-hidden="true">
                    {isActive ? 'Active' : 'Apply'}
                  </span>
                </button>
              );
            })}

            <div className="theme-switcher__separator" />

            <div className="theme-switcher__custom-block">
              <button
                type="button"
                className={`theme-switcher__option ${isCustomActive ? 'theme-switcher__option--active' : ''}`}
                onClick={() => setTheme(CUSTOM_THEME_ID)}
              >
                <span className="theme-switcher__option-copy">
                  <span className="theme-switcher__swatches" aria-hidden="true">
                    {customSwatches.map((swatch) => (
                      <span
                        key={swatch}
                        className="theme-switcher__swatch"
                        style={{ backgroundColor: swatch }}
                      />
                    ))}
                  </span>
                  <span>Custom</span>
                </span>
                <span className="theme-switcher__option-state" aria-hidden="true">
                  {isCustomActive ? 'Active' : 'Use saved'}
                </span>
              </button>

              <div className="theme-switcher__custom-panel">
                <div className="theme-switcher__custom-palette">
                  {CUSTOM_COLOR_FIELDS.map((field) => (
                    <label
                      key={field.key}
                      className="theme-switcher__custom-color-frame"
                    >
                      <input
                        type="color"
                        className="theme-switcher__custom-color"
                        aria-label={field.ariaLabel}
                        title={field.ariaLabel}
                        value={customTheme[field.key]}
                        onChange={(event) =>
                          updateCustomTheme(field.key, event.target.value)
                        }
                      />
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
