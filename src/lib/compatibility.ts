/**
 * How well two people would get on as flatmates, from their profile answers.
 * Only questions both people answered count. Everything happens on the phone.
 */

import { HABIT_QUESTIONS, type Habits, type HabitQuestion, type Interest } from '@/types/profile';

export type CompatibilityLevel = 'high' | 'medium' | 'low';

export type Compatibility = {
  /** Null when too few questions were answered by both. */
  level: CompatibilityLevel | null;
  /** How many questions were compared. */
  compared: number;
  /** Questions with the same answer. */
  sameAnswers: HabitQuestion[];
  sharedInterests: Interest[];
  /** Questions where the answers clash (worth talking about before moving in). */
  differences: HabitQuestion[];
};

/** Below this, the level isn't shown: a couple of answers say too little. */
const MIN_COMPARED = 3;

// Questions where the options go from one end to the other, so "next to" is close.
const SCALES: HabitQuestion[] = [
  'schedule',
  'tidiness',
  'weekends',
  'guests',
  'overnight_guests',
  'noise',
  'social',
  'food_sharing',
];

// Questions that describe someone but don't make two people clash.
const NOT_SCORED: HabitQuestion[] = ['work_from_home', 'cooking', 'diet'];

const HAS_PET = ['have_dog', 'have_cat', 'have_pets'];

/** 1 = perfect, 0 = clash. Null when the question isn't scored. */
function score(question: HabitQuestion, a: string, b: string): number | null {
  if (NOT_SCORED.includes(question)) return null;
  if (a === b) return 1;
  if (question === 'smoking') {
    const pair = [a, b].sort().join('|');
    if (pair === 'non_smoker|smoker') return 0;
    if (pair === 'non_smoker|outside_only') return 0.5;
    if (pair === 'non_smoker_ok|smoker') return 0.75;
    return 1;
  }
  if (question === 'pets') {
    const clash = (x: string, y: string) => HAS_PET.includes(x) && y === 'no_pets';
    if (clash(a, b) || clash(b, a)) return 0;
    if ((a === 'want_pet' && b === 'no_pets') || (b === 'want_pet' && a === 'no_pets')) return 0.5;
    return 1;
  }
  if (SCALES.includes(question)) {
    const options = HABIT_QUESTIONS[question] as readonly string[];
    const distance = Math.abs(options.indexOf(a) - options.indexOf(b));
    return 1 - distance / (options.length - 1);
  }
  return null;
}

export function compareHabits(me: Habits, other: Habits): Compatibility {
  const sameAnswers: HabitQuestion[] = [];
  const differences: HabitQuestion[] = [];
  const scores: number[] = [];

  for (const question of Object.keys(HABIT_QUESTIONS) as HabitQuestion[]) {
    const a = me[question];
    const b = other[question];
    if (!a || !b) continue;
    // "I eat everything" isn't really something in common.
    if (a === b && !(question === 'diet' && a === 'anything')) sameAnswers.push(question);
    const value = score(question, a, b);
    if (value === null) continue;
    scores.push(value);
    if (value <= 0.25) differences.push(question);
  }

  const sharedInterests = me.interests.filter((interest) => other.interests.includes(interest));
  const average = scores.length ? scores.reduce((sum, s) => sum + s, 0) / scores.length : 0;
  const level: CompatibilityLevel | null =
    scores.length < MIN_COMPARED
      ? null
      : average >= 0.75
        ? 'high'
        : average >= 0.5
          ? 'medium'
          : 'low';

  return { level, compared: scores.length, sameAnswers, sharedInterests, differences };
}

/** How much of the profile is filled in, from 0 to 100. */
export function profileCompletion(
  profile: Habits & { avatar_url: string | null; about: string | null; occupation: string | null }
): number {
  const questions = Object.keys(HABIT_QUESTIONS) as HabitQuestion[];
  const parts = [
    !!profile.avatar_url,
    !!profile.about,
    !!profile.occupation,
    profile.interests.length > 0,
    ...questions.map((question) => !!profile[question]),
  ];
  return Math.round((parts.filter(Boolean).length / parts.length) * 100);
}
