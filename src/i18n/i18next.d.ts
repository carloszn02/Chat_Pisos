import 'i18next';

import type es from './locales/es';

// Lets TypeScript check translation keys, so t('home.typo') is an error.
declare module 'i18next' {
  interface CustomTypeOptions {
    resources: { translation: typeof es };
  }
}
