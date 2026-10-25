import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppFonts } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { METRO_LINES, type MetroLine } from '@/types/listing';

/** "L1" → "1"; the branch line and Metro Ligero keep their letters. */
export function metroLineLabel(line: MetroLine): string {
  return line.replace(/^L(?=\d)/, '');
}

type MetroBadgeProps = {
  line: MetroLine;
  size?: 'small' | 'regular';
};

/** A Madrid metro line in its colour, like the signs in the stations. */
export function MetroBadge({ line, size = 'regular' }: MetroBadgeProps) {
  const colors = METRO_LINES[line];
  const small = size === 'small';
  return (
    <View
      accessibilityLabel={`Metro ${metroLineLabel(line)}`}
      style={[
        styles.badge,
        small && styles.badgeSmall,
        { backgroundColor: colors.background },
        // The white branch line needs an outline to be visible.
        line === 'R' && { borderWidth: 1.5, borderColor: colors.text },
      ]}>
      <Text style={[styles.text, small && styles.textSmall, { color: colors.text }]}>
        {metroLineLabel(line)}
      </Text>
    </View>
  );
}

type MetroLinePickerProps = {
  value: MetroLine[];
  onToggle: (line: MetroLine) => void;
  /** Lines that can't be picked right now (e.g. the maximum is reached). */
  disabled?: (line: MetroLine) => boolean;
};

/** All the lines as badges; the chosen ones are full colour, the rest faded. */
export function MetroLinePicker({ value, onToggle, disabled }: MetroLinePickerProps) {
  const theme = useTheme();
  return (
    <View style={styles.picker}>
      {(Object.keys(METRO_LINES) as MetroLine[]).map((line) => {
        const selected = value.includes(line);
        const off = !selected && !!disabled?.(line);
        return (
          <Pressable
            key={line}
            accessibilityRole="checkbox"
            accessibilityLabel={`Metro ${metroLineLabel(line)}`}
            accessibilityState={{ checked: selected, disabled: off }}
            disabled={off}
            onPress={() => onToggle(line)}
            hitSlop={4}
            style={({ pressed }) => [
              styles.option,
              { borderColor: selected ? theme.text : 'transparent' },
              !selected && styles.faded,
              pressed && styles.pressed,
            ]}>
            <MetroBadge line={line} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    minWidth: 30,
    height: 30,
    paddingHorizontal: 7,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeSmall: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
  },
  text: {
    fontFamily: AppFonts.bold,
    fontWeight: 800,
    fontSize: 14,
  },
  textSmall: {
    fontSize: 11,
  },
  picker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  option: {
    borderWidth: 2,
    borderRadius: 19,
    padding: 2,
  },
  faded: {
    opacity: 0.35,
  },
  pressed: {
    opacity: 0.7,
  },
});
