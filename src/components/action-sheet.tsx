import { useTranslation } from 'react-i18next';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ActionSheetOption = {
  label: string;
  onPress: () => void;
  destructive?: boolean;
};

type ActionSheetProps = {
  visible: boolean;
  title?: string;
  message?: string;
  options: ActionSheetOption[];
  onClose: () => void;
};

/** A menu that slides up from the bottom (works on phones and on the web). */
export function ActionSheet({ visible, title, message, options, onClose }: ActionSheetProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('common.cancel')}
        style={styles.backdrop}
        onPress={onClose}
      />
      <View
        style={[
          styles.sheet,
          { backgroundColor: theme.backgroundElement, paddingBottom: Math.max(insets.bottom, Spacing.three) },
        ]}>
        {(title || message) && (
          <View style={styles.header}>
            {title && <ThemedText style={styles.title}>{title}</ThemedText>}
            {message && (
              <ThemedText type="small" themeColor="textSecondary" style={styles.message}>
                {message}
              </ThemedText>
            )}
          </View>
        )}
        {options.map((option) => (
          <Pressable
            key={option.label}
            accessibilityRole="button"
            onPress={() => {
              onClose();
              // iOS can't open a new screen or menu while this one is still closing.
              setTimeout(option.onPress, Platform.OS === 'ios' ? 350 : 0);
            }}
            style={({ pressed }) => [styles.option, { borderTopColor: theme.border }, pressed && styles.pressed]}>
            <ThemedText style={[styles.optionText, option.destructive && { color: theme.danger }]}>
              {option.label}
            </ThemedText>
          </Pressable>
        ))}
        <Pressable
          accessibilityRole="button"
          onPress={onClose}
          style={({ pressed }) => [styles.option, { borderTopColor: theme.border }, pressed && styles.pressed]}>
          <ThemedText style={[styles.optionText, styles.cancel]}>{t('common.cancel')}</ThemedText>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  sheet: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: Spacing.two,
  },
  header: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    gap: Spacing.one,
    alignItems: 'center',
  },
  title: {
    fontWeight: 700,
    textAlign: 'center',
  },
  message: {
    textAlign: 'center',
  },
  option: {
    minHeight: 52,
    justifyContent: 'center',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingHorizontal: Spacing.four,
  },
  optionText: {
    fontSize: 16,
  },
  cancel: {
    fontWeight: 700,
  },
  pressed: {
    opacity: 0.6,
  },
});
