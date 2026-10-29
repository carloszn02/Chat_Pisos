/**
 * The app's buttons, always the same three kinds:
 * - primary: filled mocha, for the main action on a screen
 * - secondary: outlined, for other actions
 * - text: a plain coloured link-style button
 * All are pill-shaped. IconButton is the round icon button used at the top of screens.
 */

import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'text';
  /** 'small' is for buttons inside cards and rows. */
  size?: 'regular' | 'small';
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  /** Red text, for destructive actions like "Log out". */
  danger?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'regular',
  icon,
  loading = false,
  disabled = false,
  danger = false,
  style,
  accessibilityLabel,
}: ButtonProps) {
  const theme = useTheme();
  const inactive = disabled || loading;
  const textColor =
    variant === 'primary'
      ? theme.onPrimary
      : danger
        ? theme.danger
        : variant === 'text'
          ? theme.primary
          : theme.text;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      hitSlop={variant === 'text' ? 8 : undefined}
      style={({ pressed }) => [
        styles.base,
        size === 'small' ? styles.small : styles.regular,
        variant === 'primary' && { backgroundColor: theme.primary },
        variant === 'secondary' && [
          styles.outlined,
          {
            borderColor: danger ? theme.border : theme.borderStrong,
            backgroundColor: theme.backgroundElement,
          },
        ],
        variant === 'text' && styles.textOnly,
        (pressed || inactive) && styles.dimmed,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <View style={styles.content}>
          {icon && (
            <Icon name={icon} size={size === 'small' ? 16 : 18} color={textColor} strokeWidth={2} />
          )}
          <ThemedText
            type="smallBold"
            // With very large system text, buttons still keep their shape.
            maxFontSizeMultiplier={1.4}
            style={[styles.label, size === 'small' && styles.labelSmall, { color: textColor }]}>
            {label}
          </ThemedText>
        </View>
      )}
    </Pressable>
  );
}

type IconButtonProps = {
  icon: IconName;
  /** What it does, for screen readers (it has no visible text). */
  label: string;
  onPress?: () => void;
  /** 'plain' has no circle around it (for headers and inside text boxes). */
  variant?: 'outlined' | 'plain' | 'filled';
  size?: number;
  disabled?: boolean;
  /** A small dot or number on the corner, e.g. how many saved listings. */
  badge?: number;
};

export function IconButton({
  icon,
  label,
  onPress,
  variant = 'outlined',
  size = 40,
  disabled = false,
  badge,
}: IconButtonProps) {
  const theme = useTheme();
  const color = variant === 'filled' ? theme.onPrimary : theme.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        styles.iconButton,
        { width: size, height: size, borderRadius: size / 2 },
        variant === 'outlined' && {
          borderWidth: 1,
          borderColor: theme.border,
          backgroundColor: theme.backgroundElement,
        },
        variant === 'filled' && { backgroundColor: theme.primary },
        (pressed || disabled) && styles.dimmed,
      ]}>
      <Icon
        name={icon}
        size={Math.round(size * 0.5)}
        color={color}
        strokeWidth={variant === 'filled' ? 2.2 : 1.8}
      />
      {!!badge && badge > 0 && (
        <View
          style={[styles.badge, { backgroundColor: theme.primary, borderColor: theme.background }]}>
          <ThemedText style={[styles.badgeText, { color: theme.onPrimary }]}>
            {badge > 99 ? '99+' : badge}
          </ThemedText>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  regular: {
    minHeight: 48,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  small: {
    minHeight: 36,
    paddingHorizontal: Spacing.three,
  },
  outlined: {
    borderWidth: 1,
  },
  textOnly: {
    minHeight: 36,
    paddingHorizontal: Spacing.two,
    alignSelf: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    maxWidth: '100%',
  },
  label: {
    fontSize: 15,
    lineHeight: 20,
    textAlign: 'center',
    flexShrink: 1,
  },
  labelSmall: {
    fontSize: 14,
  },
  dimmed: {
    opacity: 0.6,
  },
  iconButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: 700,
  },
});
