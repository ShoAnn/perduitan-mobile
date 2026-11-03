import { getLocales } from 'expo-localization';
import Storage from 'expo-sqlite/kv-store';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from '@/i18n/locales/en.json';
import id from '@/i18n/locales/id.json';

export const SUPPORTED_LANGUAGES = ['en', 'id'] as const;
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/** Key under which the chosen language is persisted in the key-value store. */
export const APP_LANGUAGE_KEY = 'app.language';

function isAppLanguage(value: unknown): value is AppLanguage {
  return value === 'en' || value === 'id';
}

/** Persisted choice first, then the device language, then English. */
function initialLanguage(): AppLanguage {
  try {
    const saved = Storage.getItemSync(APP_LANGUAGE_KEY);
    if (isAppLanguage(saved)) {
      return saved;
    }
  } catch (error) {
    console.error('Failed to load the saved language', error);
  }

  const deviceLanguage = getLocales()[0]?.languageCode;
  return deviceLanguage === 'id' ? 'id' : 'en';
}

// eslint-disable-next-line import/no-named-as-default-member
i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    id: { translation: id },
  },
  lng: initialLanguage(),
  fallbackLng: 'en',
  // Resources are bundled, so initialize synchronously and avoid a first-render
  // suspense while translations "load".
  initAsync: false,
  interpolation: {
    escapeValue: false,
  },
});

/** Switches the app language and persists the choice for the next launch. */
export function setAppLanguage(language: AppLanguage): void {
  // eslint-disable-next-line import/no-named-as-default-member
  i18n.changeLanguage(language);
  Storage.setItem(APP_LANGUAGE_KEY, language).catch((error: unknown) => {
    console.error('Failed to save the language preference', error);
  });
}

export default i18n;
