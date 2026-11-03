/**
 * App colours, "Madrid rooftops at dusk": an evening haze with dusk blue (light), and the
 * night sky with warm ochre light (dark). Ochre is also the accent for unread counts.
 * The person picks Light, Dark or Automatic in Settings (see hooks/use-color-scheme).
 * `primary` is for main buttons and accents; `onPrimary` is the text on top of it.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#1E1B2E',
    background: '#F3F2F7',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#E6E8F4',
    textSecondary: '#625D75',
    border: '#E2DFEA',
    /** Outlined buttons: a little stronger than border. */
    borderStrong: '#CFCADB',
    /** Outline of text boxes: strong enough to see where to type (3:1 on white and haze). */
    inputBorder: '#8E89A2',
    /** Thin lines between rows in lists. */
    divider: '#ECEAF2',
    /** District tiles and other soft surfaces, with their text colour. */
    tile: '#E6E8F4',
    onTile: '#2E3A78',
    primary: '#2E3A78',
    onPrimary: '#FFFFFF',
    /** Warm ochre light: unread counts and small highlights. */
    accent: '#E3A33B',
    onAccent: '#1E1B2E',
    danger: '#B3261E',
  },
  dark: {
    text: '#F0EDF7',
    background: '#141628',
    backgroundElement: '#1E2138',
    backgroundSelected: '#2A2E50',
    textSecondary: '#A7A2BC',
    border: '#2D3150',
    borderStrong: '#3D4268',
    inputBorder: '#666B9A',
    divider: '#24284A',
    tile: '#262A48',
    onTile: '#C9CDF2',
    primary: '#E7B254',
    onPrimary: '#1E1606',
    accent: '#E7B254',
    onAccent: '#1E1606',
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

// The phone tab bar sits below the screens (it no longer floats over them), so tab screens
// only need their normal bottom spacing.
export const BottomTabInset = 0;

/**
 * Safe-area edges for the tab screens: the tab bar below already keeps clear of the phone's
 * own bottom bar, so the screens only avoid the top (status bar, notch) and the sides.
 */
export const TabScreenEdges = ['top', 'left', 'right'] as const;
export const MaxContentWidth = 800;
