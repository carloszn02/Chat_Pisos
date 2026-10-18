import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ReplyBar } from '@/components/message-reply';
import { ThemedText } from '@/components/themed-text';
import { AppFonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ChatComposerProps = {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  sending: boolean;
  placeholder: string;
  /** Shows the photo button. Left out where photos aren't allowed (e.g. chat requests). */
  onPickPhoto?: () => void;
  /** The chosen photo, shown small above the text box until it's sent. */
  photoUri?: string | null;
  onRemovePhoto?: () => void;
  /** The message being replied to, shown above the text box with ✕ to cancel. */
  replyTo?: { name: string; text: string } | null;
  onCancelReply?: () => void;
};

/** The text box, photo button and send button at the bottom of a chat. */
export function ChatComposer({
  value,
  onChangeText,
  onSend,
  sending,
  placeholder,
  onPickPhoto,
  photoUri,
  onRemovePhoto,
  replyTo,
  onCancelReply,
}: ChatComposerProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const canSend = !sending && (value.trim().length > 0 || !!photoUri);

  return (
    <View style={styles.wrap}>
      {replyTo && (
        <ReplyBar name={replyTo.name} text={replyTo.text} onCancel={() => onCancelReply?.()} />
      )}
      {photoUri && (
        <View style={styles.preview}>
          <Image source={{ uri: photoUri }} style={styles.previewImage} contentFit="cover" />
          {!sending && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('chats.removePhoto')}
              onPress={onRemovePhoto}
              hitSlop={8}
              style={[styles.removePhoto, { backgroundColor: theme.text }]}>
              <ThemedText style={[styles.removeText, { color: theme.background }]}>✕</ThemedText>
            </Pressable>
          )}
          <ThemedText type="small" themeColor="textSecondary" style={styles.previewHint}>
            {t('chats.photoCaptionHint')}
          </ThemedText>
        </View>
      )}
      <View style={styles.row}>
        {onPickPhoto && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('chats.addPhoto')}
            disabled={sending}
            onPress={onPickPhoto}
            hitSlop={6}
            style={({ pressed }) => [
              styles.photoButton,
              { borderColor: theme.border, backgroundColor: theme.background },
              pressed && styles.dimmed,
            ]}>
            <SymbolView
              name={{ ios: 'photo', android: 'image', web: 'image' }}
              tintColor={theme.textSecondary}
              size={22}
              fallback={<ThemedText>📷</ThemedText>}
            />
          </Pressable>
        )}
        <TextInput
          style={[
            styles.input,
            { borderColor: theme.border, backgroundColor: theme.background, color: theme.text },
          ]}
          value={value}
          onChangeText={onChangeText}
          placeholder={photoUri ? t('chats.photoCaptionPlaceholder') : placeholder}
          placeholderTextColor={theme.textSecondary}
          multiline
          maxLength={2000}
          accessibilityLabel={placeholder}
          // On a computer, Enter sends and Shift+Enter starts a new line (like WhatsApp Web).
          onKeyPress={
            Platform.OS === 'web'
              ? (event) => {
                  const key = event.nativeEvent as { key: string; shiftKey?: boolean };
                  if (key.key === 'Enter' && !key.shiftKey) {
                    event.preventDefault();
                    if (canSend) onSend();
                  }
                }
              : undefined
          }
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
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.two,
  },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  previewImage: {
    width: 64,
    height: 64,
    borderRadius: 10,
  },
  removePhoto: {
    position: 'absolute',
    left: 48,
    top: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: 700,
  },
  previewHint: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
  },
  photoButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    fontFamily: AppFonts.regular,
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
