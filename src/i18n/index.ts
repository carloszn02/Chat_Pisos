/**
 * Translations setup. All user-facing text lives in ./locales — never write
 * text directly in a screen. To add a language, create a new file in ./locales
 * and register it in `resources` and `SUPPORTED_LANGUAGES` below.
 */

import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en';
import es from './locales/es';

export const SUPPORTED_LANGUAGES = ['es', 'en'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

const resources = {
  es: { translation: es },
  en: { translation: en },
};

function detectLanguage(): Language {
  const deviceLanguage = getLocales()[0]?.languageCode;
  return SUPPORTED_LANGUAGES.find((lang) => lang === deviceLanguage) ?? 'es';
}

// eslint-disable-next-line import/no-named-as-default-member -- standard i18next setup
i18n.use(initReactI18next).init({
  resources,
  lng: detectLanguage(),
  fallbackLng: 'es',
  interpolation: { escapeValue: false },
});

export default i18n;
