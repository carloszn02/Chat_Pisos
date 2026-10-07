/**
 * App colors (soft mocha / cream palette). The app always uses the light palette;
 * the dark one is kept in case we offer dark mode as an option later.
 * `primary` is for main buttons and accents; `onPrimary` is the text on top of it.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#2E2620',
    background: '#FBF8F4',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#F4ECE4',
    textSecondary: '#75685F',
    border: '#E6DDD2',
    primary: '#8E6A52',
    onPrimary: '#FFFFFF',
    danger: '#B3261E',
  },
  dark: {
    text: '#F7F3EE',
    background: '#1A1512',
    backgroundElement: '#2A221D',
    backgroundSelected: '#3A2F28',
    textSecondary: '#BFB1A6',
    border: '#4A3D34',
    primary: '#C9A188',
    onPrimary: '#1A1512',
    danger: '#F2B8B5',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

/**
 * The app's own fonts (loaded in the root layout). Each weight is a separate font
 * on phones, so pick the family that matches the weight instead of using fontWeight.
 */
export const AppFonts = {
  regular: 'DMSans_400Regular',
  medium: 'DMSans_500Medium',
  bold: 'DMSans_700Bold',
  headingSemiBold: 'BricolageGrotesque_600SemiBold',
  heading: 'BricolageGrotesque_700Bold',
} as const;

/** The body font for a given weight (400, 500 or 700 and up). */
export function bodyFontFor(weight: string | number | undefined): string {
  const value = Number(weight ?? 400);
  if (value >= 700) return AppFonts.bold;
  if (value >= 500) return AppFonts.medium;
  return AppFonts.regular;
}

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
