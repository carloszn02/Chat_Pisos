/**
 * The app's icons: one family of thin line icons (Lucide), drawn the same on iPhone,
 * Android and the web. Each one is imported on its own so the app only carries these.
 * Use <Icon name="search" /> instead of emojis or text symbols.
 */

import ArrowRight from 'lucide-react-native/icons/arrow-right';
import ArrowUp from 'lucide-react-native/icons/arrow-up';
import BellOff from 'lucide-react-native/icons/bell-off';
import Camera from 'lucide-react-native/icons/camera';
import Check from 'lucide-react-native/icons/check';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import Ellipsis from 'lucide-react-native/icons/ellipsis';
import Heart from 'lucide-react-native/icons/heart';
import ImageIcon from 'lucide-react-native/icons/image';
import List from 'lucide-react-native/icons/list';
import MapIcon from 'lucide-react-native/icons/map';
import MapPin from 'lucide-react-native/icons/map-pin';
import Plus from 'lucide-react-native/icons/plus';
import Search from 'lucide-react-native/icons/search';
import Settings from 'lucide-react-native/icons/settings';
import ShieldCheck from 'lucide-react-native/icons/shield-check';
import SlidersHorizontal from 'lucide-react-native/icons/sliders-horizontal';
import X from 'lucide-react-native/icons/x';

import { Platform } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

const ICONS = {
  'arrow-right': ArrowRight,
  'arrow-up': ArrowUp,
  'bell-off': BellOff,
  camera: Camera,
  check: Check,
  'chevron-right': ChevronRight,
  close: X,
  heart: Heart,
  image: ImageIcon,
  list: List,
  map: MapIcon,
  'map-pin': MapPin,
  more: Ellipsis,
  plus: Plus,
  search: Search,
  settings: Settings,
  shield: ShieldCheck,
  filters: SlidersHorizontal,
} as const;

export type IconName = keyof typeof ICONS;

type IconProps = {
  name: IconName;
  size?: number;
  /** Defaults to the text colour. */
  color?: string;
  /** Fill the shape (e.g. a saved heart). */
  filled?: boolean;
  strokeWidth?: number;
  /** For screen readers when the icon means something on its own; otherwise it's hidden. */
  label?: string;
};

export function Icon({
  name,
  size = 22,
  color,
  filled = false,
  strokeWidth = 1.8,
  label,
}: IconProps) {
  const theme = useTheme();
  const Component = ICONS[name];
  const stroke = color ?? theme.text;
  return (
    <Component
      size={size}
      color={stroke}
      fill={filled ? stroke : 'none'}
      strokeWidth={strokeWidth}
      {...a11y(label)}
    />
  );
}

/**
 * Screen readers: an icon with a label is read out; one without is skipped (its button or
 * text says what it means). The web uses ARIA attributes, phones their own settings.
 */
function a11y(label: string | undefined): object {
  if (Platform.OS === 'web') {
    return label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true };
  }
  return label
    ? { accessible: true, accessibilityLabel: label }
    : {
        accessibilityElementsHidden: true,
        importantForAccessibility: 'no-hide-descendants' as const,
      };
}
