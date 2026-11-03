import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type TextStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { formatDate } from '@/lib/format';

export type DateInputProps = {
  /** The date as the forms keep it: day, month and year as text ('' when not chosen). */
  day: string;
  month: string;
  year: string;
  onChange: (day: string, month: string, year: string) => void;
  inputStyle: StyleProp<TextStyle>;
  label: string;
  /** Where the calendar opens when nothing is chosen yet. */
  defaultDate?: Date;
  minimumDate?: Date;
  maximumDate?: Date;
};

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * A date field that opens the phone's own calendar (no typing day, month and year).
 * The web version (date-input.web.tsx) keeps three boxes.
 */
export function DateInput({
  day,
  month,
  year,
  onChange,
  inputStyle,
  label,
  defaultDate = new Date(),
  minimumDate,
  maximumDate,
}: DateInputProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const scheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const chosen =
    day && month && year.length === 4
      ? new Date(Number(year), Number(month) - 1, Number(day))
      : null;
  const valid = chosen && !Number.isNaN(chosen.getTime()) ? chosen : null;
  // iPhone: the calendar opens in a sheet; the date is kept only when "Done" is tapped.
  const [iosOpen, setIosOpen] = useState(false);
  const [iosValue, setIosValue] = useState<Date>(valid ?? defaultDate);

  function pick(date: Date) {
    onChange(String(date.getDate()), String(date.getMonth() + 1), String(date.getFullYear()));
  }

  function open() {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: valid ?? defaultDate,
        mode: 'date',
        minimumDate,
        maximumDate,
        onChange: (event, date) => {
          if (event.type === 'set' && date) pick(date);
        },
      });
    } else {
      setIosValue(valid ?? defaultDate);
      setIosOpen(true);
    }
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={t('dateInput.hint')}
        onPress={open}
        style={({ pressed }) => [inputStyle, styles.field, pressed && styles.pressed]}>
        <ThemedText style={{ color: valid ? theme.text : theme.textSecondary }}>
          {valid
            ? formatDate(
                `${valid.getFullYear()}-${pad(valid.getMonth() + 1)}-${pad(valid.getDate())}`,
                i18n.language
              )
            : t('dateInput.placeholder')}
        </ThemedText>
        <Icon name="calendar" size={18} color={theme.textSecondary} />
      </Pressable>

      {Platform.OS === 'ios' && (
        <Modal
          visible={iosOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setIosOpen(false)}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.cancel')}
            style={styles.backdrop}
            onPress={() => setIosOpen(false)}
          />
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: theme.backgroundElement,
                paddingBottom: Math.max(insets.bottom, Spacing.three),
              },
            ]}>
            <DateTimePicker
              value={iosValue}
              mode="date"
              display="spinner"
              themeVariant={scheme}
              minimumDate={minimumDate}
              maximumDate={maximumDate}
              onChange={(_, date) => {
                if (date) setIosValue(date);
              }}
            />
            <Button
              label={t('dateInput.done')}
              onPress={() => {
                pick(iosValue);
                setIosOpen(false);
              }}
            />
          </View>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pressed: {
    opacity: 0.7,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: Spacing.three,
    gap: Spacing.two,
  },
});
