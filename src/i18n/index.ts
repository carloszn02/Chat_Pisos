/**
 * Translations setup. All user-facing text lives in ./locales — never write
 * text directly in a screen. To add a language, create a new file in ./locales
 * and register it in `resources` and `SUPPORTED_LANGUAGES` below.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en';
import es from './locales/es';

export const SUPPORTED_LANGUAGES = ['es', 'en'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

const STORAGE_KEY = 'chat-pisos.language';

const resources = {
  es: { translation: es },
  en: { translation: en },
};

function isSupported(value: string | null | undefined): value is Language {
  return SUPPORTED_LANGUAGES.some((lang) => lang === value);
}

function detectLanguage(): Language {
  const deviceLanguage = getLocales()[0]?.languageCode;
  return isSupported(deviceLanguage) ? deviceLanguage : 'es';
}

// eslint-disable-next-line import/no-named-as-default-member -- standard i18next setup
i18n.use(initReactI18next).init({
  resources,
  lng: detectLanguage(),
  fallbackLng: 'es',
  interpolation: { escapeValue: false },
});

// Remember the language the person picks, and use it again next time the app opens.
// (Skipped while the web version is pre-rendered on the server, where there's no storage.)
if (typeof window !== 'undefined') {
  AsyncStorage.getItem(STORAGE_KEY)
    .then((saved) => {
      // eslint-disable-next-line import/no-named-as-default-member -- same i18next instance as above
      if (isSupported(saved) && saved !== i18n.language) i18n.changeLanguage(saved);
    })
    .catch(() => {})
    .finally(() => {
      i18n.on('languageChanged', (language) => {
        AsyncStorage.setItem(STORAGE_KEY, language).catch(() => {});
      });
    });
}

export default i18n;
