/**
 * App colours: a clean cream with coffee brown (light), and coffee-black with caramel (dark).
 * The person picks Light, Dark or Automatic in Settings (see hooks/use-color-scheme).
 * `primary` is for main buttons and accents; `onPrimary` is the text on top of it.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#1F1A17',
    background: '#FAF8F5',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#F3ECE5',
    textSecondary: '#72675E',
    border: '#ECE5DD',
    /** Outlined buttons: a little stronger than border. */
    borderStrong: '#DCD2C7',
    /** Thin lines between rows in lists. */
    divider: '#F0EAE3',
    /** District tiles and other soft warm surfaces, with their text colour. */
    tile: '#F1E6DB',
    onTile: '#7A4B2A',
    primary: '#7A4B2A',
    onPrimary: '#FFFFFF',
    danger: '#B3261E',
  },
  dark: {
    text: '#F4EEE8',
    background: '#14110F',
    backgroundElement: '#1D1814',
    backgroundSelected: '#2A221C',
    textSecondary: '#A89B90',
    border: '#2E2520',
    borderStrong: '#3F342C',
    divider: '#241D19',
    tile: '#33261D',
    onTile: '#E2B994',
    primary: '#D9AB86',
    onPrimary: '#1E140D',
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
 * The phone's own font: San Francisco on iPhone, Roboto on Android, the system font on the
 * web (like WhatsApp or Instagram). Weight comes from fontWeight, as usual.
 */
const SYSTEM_FONT = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  default: 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
});

export const AppFonts = {
  regular: SYSTEM_FONT,
  medium: SYSTEM_FONT,
  bold: SYSTEM_FONT,
  headingSemiBold: SYSTEM_FONT,
  heading: SYSTEM_FONT,
} as const;

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
