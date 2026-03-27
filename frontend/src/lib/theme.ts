export const THEME_STORAGE_KEY = 'ghoomo.theme';
export const CUSTOM_THEME_STORAGE_KEY = 'ghoomo.custom-theme';
export const DEFAULT_THEME = 'sunrise' as const;
export const CUSTOM_THEME_ID = 'custom' as const;

export type CustomThemeConfig = {
  background: string;
  foreground: string;
  accent: string;
};

export const DEFAULT_CUSTOM_THEME: CustomThemeConfig = {
  background: '#f6efe1',
  foreground: '#182230',
  accent: '#dc5a2f',
};

export const THEMES = [
  {
    id: 'sunrise',
    label: 'Sunrise',
    swatches: ['#d95f1f', '#fbefe0', '#0f5448'],
  },
  {
    id: 'lagoon',
    label: 'Lagoon',
    swatches: ['#0299b0', '#e6fbfb', '#154d7a'],
  },
  {
    id: 'midnight',
    label: 'Midnight',
    swatches: ['#ffb14a', '#07101e', '#72e7ff'],
  },
  {
    id: 'saffron',
    label: 'Saffron',
    swatches: ['#d89a1b', '#fff4cc', '#6d7f2a'],
  },
  {
    id: 'rosewater',
    label: 'Rosewater',
    swatches: ['#d54977', '#fff0f5', '#6a2848'],
  },
  {
    id: 'pine',
    label: 'Pine',
    swatches: ['#42c88a', '#06110d', '#d8fff0'],
  },
  {
    id: CUSTOM_THEME_ID,
    label: 'Custom',
    swatches: [
      DEFAULT_CUSTOM_THEME.accent,
      DEFAULT_CUSTOM_THEME.background,
      DEFAULT_CUSTOM_THEME.foreground,
    ],
  },
] as const;

export type ThemeId = (typeof THEMES)[number]['id'];

type AppliedCustomThemeState = {
  colorScheme: 'light' | 'dark';
  variables: Record<string, string>;
};

const THEME_IDS = THEMES.map((theme) => theme.id);

export function isThemeId(value: string | null | undefined): value is ThemeId {
  return Boolean(value && THEME_IDS.includes(value as ThemeId));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function toHex(channel: number) {
  return clamp(Math.round(channel), 0, 255).toString(16).padStart(2, '0');
}

export function normalizeHexColor(value: string | null | undefined, fallback: string) {
  if (!value) {
    return fallback;
  }

  const raw = value.trim();
  const hex = raw.startsWith('#') ? raw.slice(1) : raw;

  if (/^[0-9a-fA-F]{3}$/.test(hex)) {
    return `#${hex
      .split('')
      .map((channel) => channel.repeat(2))
      .join('')
      .toLowerCase()}`;
  }

  if (/^[0-9a-fA-F]{6}$/.test(hex)) {
    return `#${hex.toLowerCase()}`;
  }

  return fallback;
}

function hexToRgb(value: string) {
  const normalized = normalizeHexColor(value, '#000000').slice(1);

  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function rgbToHex(red: number, green: number, blue: number) {
  return `#${toHex(red)}${toHex(green)}${toHex(blue)}`;
}

function mixColors(baseColor: string, targetColor: string, targetWeight: number) {
  const weight = clamp(targetWeight, 0, 1);
  const base = hexToRgb(baseColor);
  const target = hexToRgb(targetColor);

  return rgbToHex(
    base.r * (1 - weight) + target.r * weight,
    base.g * (1 - weight) + target.g * weight,
    base.b * (1 - weight) + target.b * weight,
  );
}

function tint(color: string, amount: number) {
  return mixColors(color, '#ffffff', amount);
}

function shade(color: string, amount: number) {
  return mixColors(color, '#000000', amount);
}

function withAlpha(color: string, opacity: number) {
  const { r, g, b } = hexToRgb(color);
  return `rgba(${r}, ${g}, ${b}, ${clamp(opacity, 0, 1)})`;
}

function getLuminance(color: string) {
  const { r, g, b } = hexToRgb(color);
  const toLinear = (channel: number) => {
    const normalized = channel / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  };

  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function pickReadableColor(backgroundColor: string) {
  return getLuminance(backgroundColor) > 0.58 ? '#0f1720' : '#f8fbff';
}

function normalizeCustomThemeWithFallback(
  value: Partial<CustomThemeConfig> | null | undefined,
  fallbackTheme: CustomThemeConfig,
): CustomThemeConfig {
  return {
    background: normalizeHexColor(value?.background, fallbackTheme.background),
    foreground: normalizeHexColor(value?.foreground, fallbackTheme.foreground),
    accent: normalizeHexColor(value?.accent, fallbackTheme.accent),
  };
}

export function normalizeCustomTheme(
  value?: Partial<CustomThemeConfig> | null,
): CustomThemeConfig {
  return normalizeCustomThemeWithFallback(value, DEFAULT_CUSTOM_THEME);
}

export function parseStoredCustomTheme(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Partial<CustomThemeConfig>;
    return normalizeCustomTheme(parsed);
  } catch {
    return null;
  }
}

export function getThemeSwatches(
  theme: ThemeId,
  customTheme?: Partial<CustomThemeConfig> | null,
) {
  if (theme === CUSTOM_THEME_ID) {
    const normalized = normalizeCustomTheme(customTheme);
    return [normalized.accent, normalized.background, normalized.foreground];
  }

  return THEMES.find((option) => option.id === theme)?.swatches ?? THEMES[0].swatches;
}

function buildCustomThemeStateWithFallback(
  value: Partial<CustomThemeConfig> | null | undefined,
  fallbackTheme: CustomThemeConfig,
): AppliedCustomThemeState {
  const theme = normalizeCustomThemeWithFallback(value, fallbackTheme);
  const { background, foreground, accent } = theme;
  const isDark = getLuminance(background) < 0.32;
  const muted = mixColors(foreground, background, isDark ? 0.46 : 0.58);
  const surfaceBase = mixColors(background, foreground, isDark ? 0.08 : 0.11);
  const surfaceStrongBase = mixColors(background, foreground, isDark ? 0.12 : 0.16);
  const surfaceSoftBase = mixColors(background, foreground, isDark ? 0.18 : 0.06);
  const accentStrong = isDark ? shade(accent, 0.18) : shade(accent, 0.24);
  const contrastBase = isDark
    ? shade(mixColors(background, accent, 0.08), 0.42)
    : shade(mixColors(background, accent, 0.18), 0.82);
  const contrastForeground = pickReadableColor(contrastBase);
  const cityCardTop = isDark
    ? shade(mixColors(background, accent, 0.12), 0.16)
    : shade(mixColors(background, accent, 0.24), 0.78);
  const cityCardBottom = isDark ? shade(background, 0.08) : shade(background, 0.88);
  const cityCardText = pickReadableColor(cityCardBottom);
  const heroWordmarkStart = mixColors(foreground, accent, isDark ? 0.08 : 0.18);
  const heroWordmarkMid = mixColors(accent, foreground, isDark ? 0.32 : 0.18);
  const heroWordmarkEnd = isDark ? tint(accent, 0.22) : mixColors(accent, foreground, 0.28);

  return {
    colorScheme: isDark ? 'dark' : 'light',
    variables: {
      '--background': background,
      '--foreground': foreground,
      '--surface': withAlpha(surfaceBase, 0.84),
      '--surface-strong': withAlpha(surfaceStrongBase, isDark ? 0.88 : 0.8),
      '--surface-soft': withAlpha(surfaceSoftBase, isDark ? 0.74 : 0.62),
      '--surface-solid': withAlpha(surfaceStrongBase, 0.94),
      '--surface-pill': withAlpha(
        mixColors(background, foreground, isDark ? 0.26 : 0.04),
        isDark ? 0.14 : 0.76,
      ),
      '--surface-pill-strong': withAlpha(
        mixColors(background, foreground, isDark ? 0.32 : 0.08),
        isDark ? 0.2 : 0.88,
      ),
      '--field-bg': withAlpha(
        mixColors(background, foreground, isDark ? 0.08 : 0.03),
        isDark ? 0.92 : 0.86,
      ),
      '--field-solid': withAlpha(
        mixColors(background, foreground, isDark ? 0.1 : 0.04),
        0.96,
      ),
      '--muted': muted,
      '--placeholder': withAlpha(muted, 0.72),
      '--line': withAlpha(foreground, 0.12),
      '--line-strong': withAlpha(foreground, isDark ? 0.18 : 0.2),
      '--accent': accent,
      '--accent-strong': accentStrong,
      '--accent-soft': withAlpha(accent, isDark ? 0.22 : 0.18),
      '--on-accent': pickReadableColor(accent),
      '--page-background': `radial-gradient(circle at top left, ${withAlpha(accent, isDark ? 0.22 : 0.28)}, transparent 30%), radial-gradient(circle at top right, ${withAlpha(mixColors(accent, foreground, 0.42), isDark ? 0.18 : 0.2)}, transparent 24%), linear-gradient(180deg, ${tint(background, isDark ? 0.04 : 0.03)} 0%, ${background} 48%, ${shade(background, isDark ? 0.1 : 0.08)} 100%)`,
      '--page-overlay': `linear-gradient(118deg, ${withAlpha('#ffffff', isDark ? 0.08 : 0.3)}, transparent 38%), linear-gradient(180deg, ${withAlpha('#ffffff', isDark ? 0.04 : 0.16)}, transparent 56%)`,
      '--page-orb': `radial-gradient(circle, ${withAlpha(mixColors(accent, foreground, 0.55), isDark ? 0.18 : 0.16)}, transparent 72%)`,
      '--selection': withAlpha(accent, isDark ? 0.24 : 0.22),
      '--glass-background': `linear-gradient(180deg, ${withAlpha(surfaceStrongBase, 0.94)}, ${withAlpha(surfaceBase, isDark ? 0.8 : 0.78)})`,
      '--glass-shadow': `0 28px 90px ${withAlpha('#000000', isDark ? 0.38 : 0.16)}`,
      '--hero-background': `radial-gradient(circle at 18% 18%, ${withAlpha('#ffffff', isDark ? 0.08 : 0.78)}, transparent 22%), radial-gradient(circle at 82% 18%, ${withAlpha(accent, isDark ? 0.18 : 0.24)}, transparent 24%), linear-gradient(135deg, ${withAlpha(tint(background, isDark ? 0.06 : 0.08), isDark ? 0.98 : 0.9)}, ${withAlpha(mixColors(background, accent, isDark ? 0.14 : 0.24), isDark ? 0.94 : 0.82)} 44%, ${withAlpha(mixColors(background, foreground, isDark ? 0.2 : 0.08), isDark ? 0.96 : 0.78)})`,
      '--hero-border': withAlpha('#ffffff', isDark ? 0.12 : 0.64),
      '--hero-shadow': `0 40px 130px ${withAlpha('#000000', isDark ? 0.44 : 0.16)}`,
      '--hero-orb-left': `radial-gradient(circle, ${withAlpha(accent, isDark ? 0.2 : 0.22)}, transparent 70%)`,
      '--hero-orb-right': `radial-gradient(circle, ${withAlpha(mixColors(accent, foreground, 0.55), isDark ? 0.2 : 0.18)}, transparent 70%)`,
      '--hero-wordmark-gradient': `linear-gradient(135deg, ${heroWordmarkStart} 0%, ${heroWordmarkMid} 34%, ${accent} 72%, ${heroWordmarkEnd} 100%)`,
      '--hero-wordmark-shadow': `drop-shadow(0 8px 22px ${withAlpha('#000000', isDark ? 0.3 : 0.12)})`,
      '--contrast-surface': withAlpha(contrastBase, 0.92),
      '--contrast-border': withAlpha('#ffffff', isDark ? 0.1 : 0.12),
      '--contrast-foreground': contrastForeground,
      '--contrast-muted': withAlpha(contrastForeground, isDark ? 0.66 : 0.68),
      '--panel-tint': withAlpha(
        mixColors(background, foreground, isDark ? 0.18 : 0.05),
        isDark ? 0.76 : 0.58,
      ),
      '--panel-tint-strong': withAlpha(
        mixColors(background, foreground, isDark ? 0.14 : 0.08),
        isDark ? 0.86 : 0.76,
      ),
      '--city-card-background': `linear-gradient(180deg, ${cityCardTop} 0%, ${cityCardBottom} 100%)`,
      '--city-card-shadow': `0 30px 78px ${withAlpha('#000000', isDark ? 0.3 : 0.22)}`,
      '--city-card-hover-border': withAlpha(accent, isDark ? 0.34 : 0.38),
      '--city-card-overlay': `linear-gradient(to top, ${withAlpha('#05070b', isDark ? 0.96 : 0.94)}, ${withAlpha(mixColors(background, '#000000', 0.78), 0.5)}, ${withAlpha(mixColors(background, '#000000', 0.66), 0.14)})`,
      '--city-card-chip-bg': withAlpha(mixColors(cityCardBottom, '#000000', 0.12), 0.82),
      '--city-card-chip-border': withAlpha('#ffffff', isDark ? 0.16 : 0.22),
      '--city-card-chip-text': cityCardText,
      '--city-card-panel-bg': withAlpha('#000000', isDark ? 0.44 : 0.28),
      '--city-card-panel-border': withAlpha('#ffffff', 0.12),
      '--city-card-panel-muted': withAlpha(cityCardText, 0.72),
      '--city-card-panel-copy': withAlpha(cityCardText, 0.84),
      '--city-card-body-eyebrow': tint(accent, isDark ? 0.22 : 0.34),
      '--city-card-body-text': withAlpha(cityCardText, 0.92),
      '--city-card-body-muted': withAlpha(cityCardText, 0.74),
      '--city-card-meta-bg': withAlpha('#ffffff', 0.06),
      '--city-card-meta-border': withAlpha('#ffffff', isDark ? 0.1 : 0.12),
      '--city-card-link-bg': withAlpha('#ffffff', 0.08),
      '--city-card-link-border': withAlpha('#ffffff', 0.18),
      '--city-card-link-text': withAlpha(cityCardText, 0.92),
      '--success-soft': withAlpha('#2fbf90', isDark ? 0.18 : 0.14),
      '--success-border': withAlpha('#2fbf90', isDark ? 0.26 : 0.24),
      '--success-text': isDark ? '#93e6c5' : '#2f6f4a',
      '--success': '#2fbf90',
      '--success-strong': '#1f946c',
      '--error-soft': withAlpha('#df5c52', isDark ? 0.18 : 0.14),
      '--error-border': withAlpha('#df5c52', 0.24),
      '--error-text': isDark ? '#ffb4ac' : '#a24639',
      '--warning-soft': withAlpha('#f2a445', isDark ? 0.2 : 0.18),
      '--warning-border': withAlpha('#f2a445', 0.26),
      '--warning-text': isDark ? '#ffd497' : '#8a5d10',
    },
  };
}

export function buildCustomThemeState(
  value?: Partial<CustomThemeConfig> | null,
): AppliedCustomThemeState {
  return buildCustomThemeStateWithFallback(value, DEFAULT_CUSTOM_THEME);
}

export const CUSTOM_THEME_VARIABLE_NAMES = Object.keys(
  buildCustomThemeState(DEFAULT_CUSTOM_THEME).variables,
);

export function applyThemeToRoot(
  root: HTMLElement,
  theme: ThemeId,
  customTheme?: Partial<CustomThemeConfig> | null,
) {
  root.dataset.theme = theme;
  root.style.colorScheme = '';

  for (const variableName of CUSTOM_THEME_VARIABLE_NAMES) {
    root.style.removeProperty(variableName);
  }

  if (theme !== CUSTOM_THEME_ID) {
    return;
  }

  const state = buildCustomThemeState(customTheme);
  root.style.colorScheme = state.colorScheme;

  for (const [variableName, variableValue] of Object.entries(state.variables)) {
    root.style.setProperty(variableName, variableValue);
  }
}

const THEME_BOOTSTRAP_FUNCTIONS = [
  clamp,
  toHex,
  normalizeHexColor,
  hexToRgb,
  rgbToHex,
  mixColors,
  tint,
  shade,
  withAlpha,
  getLuminance,
  pickReadableColor,
  normalizeCustomThemeWithFallback,
  buildCustomThemeStateWithFallback,
]
  .map((fn) => fn.toString())
  .join('\n\n');

export const THEME_INITIALIZER_SCRIPT = `(() => {
  const storageKey = ${JSON.stringify(THEME_STORAGE_KEY)};
  const customStorageKey = ${JSON.stringify(CUSTOM_THEME_STORAGE_KEY)};
  const defaultTheme = ${JSON.stringify(DEFAULT_THEME)};
  const customThemeId = ${JSON.stringify(CUSTOM_THEME_ID)};
  const themeIds = new Set(${JSON.stringify(THEME_IDS)});
  const defaultCustomTheme = ${JSON.stringify(DEFAULT_CUSTOM_THEME)};
  const customVariableNames = ${JSON.stringify(CUSTOM_THEME_VARIABLE_NAMES)};

  ${THEME_BOOTSTRAP_FUNCTIONS}

  const parseCustomTheme = (value) => {
    if (!value) {
      return null;
    }

    try {
      return normalizeCustomThemeWithFallback(JSON.parse(value), defaultCustomTheme);
    } catch {
      return null;
    }
  };

  const clearCustomTheme = () => {
    document.documentElement.style.colorScheme = '';
    customVariableNames.forEach((variableName) => {
      document.documentElement.style.removeProperty(variableName);
    });
  };

  const applyTheme = (value, customTheme) => {
    const theme = themeIds.has(value) ? value : defaultTheme;
    document.documentElement.dataset.theme = theme;
    clearCustomTheme();

    if (theme !== customThemeId) {
      return;
    }

    const state = buildCustomThemeStateWithFallback(customTheme, defaultCustomTheme);
    document.documentElement.style.colorScheme = state.colorScheme;
    Object.entries(state.variables).forEach(([variableName, variableValue]) => {
      document.documentElement.style.setProperty(variableName, variableValue);
    });
  };

  try {
    const storedTheme = window.localStorage.getItem(storageKey) || defaultTheme;
    const storedCustomTheme = parseCustomTheme(window.localStorage.getItem(customStorageKey));
    applyTheme(storedTheme, storedCustomTheme);
  } catch {
    applyTheme(defaultTheme, defaultCustomTheme);
  }
})();`;
