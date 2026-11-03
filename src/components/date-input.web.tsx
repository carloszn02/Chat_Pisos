import { useTranslation } from 'react-i18next';
import { StyleSheet, TextInput, View, type StyleProp, type TextStyle } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { DateInputProps } from '@/components/date-input';

/** Web: day, month and year boxes (there's no phone date picker in a browser). */
export function DateInput({ day, month, year, onChange, inputStyle }: DateInputProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const box = (style: StyleProp<TextStyle>) => [inputStyle, style];
  return (
    <View style={styles.row}>
      <TextInput
        style={box(styles.short)}
        value={day}
        onChangeText={(text) => onChange(text, month, year)}
        placeholder={t('profileSetup.day')}
        placeholderTextColor={theme.textSecondary}
        inputMode="numeric"
        maxLength={2}
        accessibilityLabel={t('profileSetup.day')}
      />
      <TextInput
        style={box(styles.short)}
        value={month}
        onChangeText={(text) => onChange(day, text, year)}
        placeholder={t('profileSetup.month')}
        placeholderTextColor={theme.textSecondary}
        inputMode="numeric"
        maxLength={2}
        accessibilityLabel={t('profileSetup.month')}
      />
      <TextInput
        style={box(styles.long)}
        value={year}
        onChangeText={(text) => onChange(day, month, text)}
        placeholder={t('profileSetup.year')}
        placeholderTextColor={theme.textSecondary}
        inputMode="numeric"
        maxLength={4}
        accessibilityLabel={t('profileSetup.year')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  // minWidth 0 keeps the boxes inside the row on narrow browser windows.
  short: {
    flex: 1,
    minWidth: 0,
  },
  long: {
    flex: 1.4,
    minWidth: 0,
  },
});
