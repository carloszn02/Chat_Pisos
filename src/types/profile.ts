/**
 * Profile data as stored in the `profiles` table. The option lists must match the
 * `check` constraints in supabase/migrations/*_create_profiles.sql.
 */

export const OCCUPATIONS = ['student', 'working', 'both'] as const;
export const SCHEDULES = ['early_bird', 'night_owl'] as const;
export const TIDINESS = ['very_tidy', 'relaxed'] as const;
export const SMOKING = ['non_smoker', 'outside_only', 'smoker'] as const;
export const PETS = ['have_pets', 'ok_with_pets', 'no_pets'] as const;

// Language names are shown in their own language, so they don't need translating.
export const SPOKEN_LANGUAGES = {
  es: 'Español',
  en: 'English',
  fr: 'Français',
  it: 'Italiano',
  de: 'Deutsch',
  pt: 'Português',
} as const;

export type Occupation = (typeof OCCUPATIONS)[number];
export type Schedule = (typeof SCHEDULES)[number];
export type Tidiness = (typeof TIDINESS)[number];
export type Smoking = (typeof SMOKING)[number];
export type Pets = (typeof PETS)[number];
export type SpokenLanguage = keyof typeof SPOKEN_LANGUAGES;

export type Profile = {
  id: string;
  first_name: string;
  birth_date: string; // YYYY-MM-DD
  occupation: Occupation | null;
  languages: SpokenLanguage[];
  about: string | null;
  avatar_url: string | null;
  schedule: Schedule | null;
  tidiness: Tidiness | null;
  smoking: Smoking | null;
  pets: Pets | null;
  created_at: string;
  updated_at: string;
};
