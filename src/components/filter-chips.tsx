import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Filter chips, used on the Listings tab and in a group's listings. */
export type Chip = {
  key: string;
  label: string;
  selected: boolean;
  onPress: () => void;
  /** An icon before the text (e.g. the filters icon). */
  icon?: IconName;
  /** Shows a small ✕ after the text: tapping the chip removes that filter. */
  removable?: boolean;
  /** Outlined in dark instead of filled (for the "Filters" button). */
  outlined?: boolean;
};

function ChipView({ chip }: { chip: Chip }) {
  const theme = useTheme();
  const filled = chip.selected && !chip.outlined;
  const color = filled ? theme.onPrimary : theme.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: chip.selected }}
      onPress={chip.onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          borderColor: filled ? theme.primary : chip.outlined ? theme.text : theme.border,
          backgroundColor: filled ? theme.primary : theme.backgroundElement,
        },
        pressed && styles.pressed,
      ]}>
      {chip.icon && <Icon name={chip.icon} size={16} color={color} strokeWidth={2} />}
      <ThemedText type={filled || chip.outlined ? 'smallBold' : 'small'} style={{ color }}>
        {chip.label}
      </ThemedText>
      {chip.removable && <Icon name="close" size={14} color={color} strokeWidth={2.2} />}
    </Pressable>
  );
}

/** Chips in a row that scrolls sideways. */
export function ChipRow({ chips }: { chips: Chip[] }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipRow}>
      {chips.map((chip) => (
        <ChipView key={chip.key} chip={chip} />
      ))}
    </ScrollView>
  );
}

/** Chips that wrap onto several lines (inside the filters panel). */
export function ChipWrap({ chips }: { chips: Chip[] }) {
  return (
    <View style={styles.chipWrap}>
      {chips.map((chip) => (
        <ChipView key={chip.key} chip={chip} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  chipRow: {
    gap: Spacing.two,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pressed: {
    opacity: 0.7,
  },
});
