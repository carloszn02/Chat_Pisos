/**
 * Profile data as stored in the `profiles` table. The option lists must match the
 * `check` constraints in supabase/migrations/*_create_profiles.sql.
 */

export const OCCUPATIONS = ['student', 'working', 'both'] as const;
export const SCHEDULES = ['early_bird', 'regular', 'night_owl'] as const;
/** A scale from very relaxed (1) to spotless (5). */
export const TIDINESS = ['very_relaxed', 'relaxed', 'normal', 'tidy', 'very_tidy'] as const;
export const SMOKING = ['non_smoker', 'non_smoker_ok', 'outside_only', 'smoker'] as const;
export const PETS = [
  'have_dog',
  'have_cat',
  'have_pets',
  'want_pet',
  'ok_with_pets',
  'no_pets',
] as const;
export const WEEKENDS = ['out', 'mixed', 'home'] as const;
export const WORK_FROM_HOME = ['never', 'some_days', 'every_day'] as const;
export const COOKING = ['daily', 'sometimes', 'rarely'] as const;
export const DIETS = ['anything', 'vegetarian', 'vegan'] as const;
export const GUESTS = ['rarely', 'sometimes', 'often'] as const;
export const OVERNIGHT_GUESTS = ['never', 'sometimes', 'often'] as const;
export const NOISE = ['quiet', 'moderate', 'lively'] as const;
export const SOCIAL = ['together', 'sometimes', 'independent'] as const;
export const FOOD_SHARING = ['share', 'basics', 'separate'] as const;
export const INTERESTS = [
  'sports',
  'gym',
  'music',
  'cinema',
  'series',
  'cooking',
  'travel',
  'gaming',
  'parties',
  'reading',
  'art',
  'nature',
  'technology',
  'languages',
  'photography',
  'dancing',
] as const;
export const MAX_INTERESTS = 5;

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
export type Weekends = (typeof WEEKENDS)[number];
export type WorkFromHome = (typeof WORK_FROM_HOME)[number];
export type Cooking = (typeof COOKING)[number];
export type Diet = (typeof DIETS)[number];
export type Guests = (typeof GUESTS)[number];
export type OvernightGuests = (typeof OVERNIGHT_GUESTS)[number];
export type Noise = (typeof NOISE)[number];
export type Social = (typeof SOCIAL)[number];
export type FoodSharing = (typeof FOOD_SHARING)[number];
export type Interest = (typeof INTERESTS)[number];

/** The optional questions about daily life and living together (all in the profile). */
export type Habits = {
  schedule: Schedule | null;
  tidiness: Tidiness | null;
  smoking: Smoking | null;
  pets: Pets | null;
  weekends: Weekends | null;
  work_from_home: WorkFromHome | null;
  cooking: Cooking | null;
  diet: Diet | null;
  guests: Guests | null;
  overnight_guests: OvernightGuests | null;
  noise: Noise | null;
  social: Social | null;
  food_sharing: FoodSharing | null;
  interests: Interest[];
};

/** Each single-choice question with its options, in the order they're asked. */
export const HABIT_QUESTIONS = {
  schedule: SCHEDULES,
  tidiness: TIDINESS,
  weekends: WEEKENDS,
  work_from_home: WORK_FROM_HOME,
  cooking: COOKING,
  diet: DIETS,
  smoking: SMOKING,
  pets: PETS,
  guests: GUESTS,
  overnight_guests: OVERNIGHT_GUESTS,
  noise: NOISE,
  social: SOCIAL,
  food_sharing: FOOD_SHARING,
} as const;
export type HabitQuestion = keyof typeof HABIT_QUESTIONS;

/** Sign-up step 2 ("Your day to day") and step 3 ("Living together"). */
export const DAILY_LIFE_QUESTIONS: HabitQuestion[] = [
  'schedule',
  'tidiness',
  'weekends',
  'work_from_home',
  'cooking',
  'diet',
];
export const LIVING_TOGETHER_QUESTIONS: HabitQuestion[] = [
  'smoking',
  'pets',
  'guests',
  'overnight_guests',
  'noise',
  'social',
  'food_sharing',
];
export type SpokenLanguage = keyof typeof SPOKEN_LANGUAGES;

export type Profile = Habits & {
  id: string;
  first_name: string;
  birth_date: string; // YYYY-MM-DD
  occupation: Occupation | null;
  languages: SpokenLanguage[];
  about: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};
