import { useState } from 'react';
import { Appearance } from 'react-native';
import Storage from 'expo-sqlite/kv-store';

export const THEME_MODES = ['system', 'light', 'dark'] as const;
export type ThemeMode = (typeof THEME_MODES)[number];

/** Key under which the chosen theme mode is persisted in the key-value store. */
export const APP_THEME_KEY = 'app.themeMode';

function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'system' || value === 'light' || value === 'dark';
}

/** Persisted choice, defaulting to following the system. */
function initialThemeMode(): ThemeMode {
  try {
    const saved = Storage.getItemSync(APP_THEME_KEY);
    if (isThemeMode(saved)) {
      return saved;
    }
  } catch (error) {
    console.error('Failed to load the saved theme mode', error);
  }

  return 'system';
}

/** Applies the mode via React Native Appearance — `useColorScheme()` follows. */
function applyThemeMode(mode: ThemeMode): void {
  try {
    Appearance.setColorScheme(mode === 'system' ? 'auto' : mode);
  } catch (error) {
    console.error('Failed to apply theme mode', error);
  }
}

// Apply before first render to avoid a flash of the system scheme.
applyThemeMode(initialThemeMode());

/** Persisted theme-mode preference and its setter. */
export function useThemeMode(): [ThemeMode, (mode: ThemeMode) => void] {
  const [mode, setModeState] = useState<ThemeMode>(initialThemeMode);

  const setMode = (next: ThemeMode) => {
    setModeState(next);
    applyThemeMode(next);
    Storage.setItem(APP_THEME_KEY, next).catch((error: unknown) => {
      console.error('Failed to save the theme mode', error);
    });
  };

  return [mode, setMode];
}
