import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from '@/components/themed-text';

type ChatComposerProps = {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  sending: boolean;
  placeholder: string;
};

/** The text box and send button at the bottom of a chat. */
export function ChatComposer({ value, onChangeText, onSend, sending, placeholder }: ChatComposerProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const canSend = !sending && value.trim().length > 0;

  return (
    <View style={styles.row}>
      <TextInput
        style={[styles.input, { borderColor: theme.border, backgroundColor: theme.background, color: theme.text }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textSecondary}
        multiline
        maxLength={2000}
        accessibilityLabel={placeholder}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('chats.send')}
        disabled={!canSend}
        onPress={onSend}
        style={({ pressed }) => [
          styles.sendButton,
          { backgroundColor: theme.primary },
          (pressed || !canSend) && styles.dimmed,
        ]}>
        {sending ? (
          <ActivityIndicator color={theme.onPrimary} />
        ) : (
          <ThemedText style={{ color: theme.onPrimary, fontWeight: 700 }}>➤</ThemedText>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 11,
    paddingBottom: 11,
    fontSize: 15,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dimmed: {
    opacity: 0.6,
  },
});
