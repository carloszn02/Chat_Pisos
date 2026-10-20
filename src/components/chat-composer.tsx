import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { IconButton } from '@/components/button';
import { Icon } from '@/components/icon';
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
              <Icon name="close" size={13} color={theme.background} strokeWidth={2.6} />
            </Pressable>
          )}
          <ThemedText type="small" themeColor="textSecondary" style={styles.previewHint}>
            {t('chats.photoCaptionHint')}
          </ThemedText>
        </View>
      )}
      <View style={styles.row}>
        <View
          style={[
            styles.field,
            { borderColor: theme.border, backgroundColor: theme.backgroundElement },
          ]}>
          <TextInput
            style={[styles.input, { color: theme.text }]}
            value={value}
            onChangeText={onChangeText}
            placeholder={photoUri ? t('chats.photoCaptionPlaceholder') : placeholder}
            placeholderTextColor={theme.textSecondary}
            multiline
            // Starts as one line and grows as you type (the web would otherwise show two).
            numberOfLines={1}
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
          {onPickPhoto && (
            <View style={styles.photoButton}>
              <IconButton
                icon="image"
                label={t('chats.addPhoto')}
                variant="plain"
                size={38}
                disabled={sending}
                onPress={onPickPhoto}
              />
            </View>
          )}
        </View>
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
            <Icon name="arrow-up" size={21} color={theme.onPrimary} strokeWidth={2.4} />
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
  previewHint: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
  },
  photoButton: {
    alignSelf: 'flex-end',
    paddingBottom: 3,
  },
  field: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    minHeight: 46,
    maxHeight: 124,
    borderWidth: 1,
    borderRadius: 23,
    paddingLeft: 16,
    paddingRight: 4,
  },
  input: {
    fontFamily: AppFonts.regular,
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 15,
  },
  sendButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dimmed: {
    opacity: 0.6,
  },
});
