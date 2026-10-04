import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ChoiceChipsProps<T extends string> = {
  label: string;
  options: readonly T[];
  getLabel: (option: T) => string;
  /** One value for single choice, an array for multiple choice. */
  value: T | null | T[];
  onChange: (option: T) => void;
};

/** A labelled row of pill buttons, e.g. "Smoking: Non-smoker / Outside only / Smoker". */
export function ChoiceChips<T extends string>({
  label,
  options,
  getLabel,
  value,
  onChange,
}: ChoiceChipsProps<T>) {
  const theme = useTheme();
  const multiple = Array.isArray(value);

  return (
    <View style={styles.group} accessibilityRole={multiple ? undefined : 'radiogroup'} accessibilityLabel={label}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <View style={styles.chips}>
        {options.map((option) => {
          const selected = multiple ? value.includes(option) : value === option;
          return (
            <Pressable
              key={option}
              accessibilityRole={multiple ? 'checkbox' : 'radio'}
              accessibilityState={multiple ? { checked: selected } : { selected }}
              onPress={() => onChange(option)}
              style={({ pressed }) => [
                styles.chip,
                {
                  borderColor: selected ? theme.primary : theme.border,
                  backgroundColor: selected ? theme.primary : theme.backgroundElement,
                },
                pressed && styles.pressed,
              ]}>
              <ThemedText type="small" style={{ color: selected ? theme.onPrimary : theme.text }}>
                {getLabel(option)}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: Spacing.two,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});
