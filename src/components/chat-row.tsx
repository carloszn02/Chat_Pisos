import type { Href } from 'expo-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { PressableLink } from '@/components/pressable-link';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ChatRowProps = {
  href: Href;
  /** The photo or tile on the left. */
  picture: ReactNode;
  title: string;
  /** "10:42", "Ayer"… */
  time?: string | null;
  preview: string;
  /** Unread messages: bold preview and a number. Muted chats show it grey. */
  unread?: number;
  muted?: boolean;
  /** Highlight the preview even with no number (e.g. a pending invitation). */
  highlight?: boolean;
  /** A short coloured line under the preview (e.g. "Request sent", "2 requests to join"). */
  note?: string;
  /** Long-press (or hold the mouse button): the chat's options. */
  onLongPress?: () => void;
};

/**
 * One chat in a list (Chats, Messages, requests): picture, name and time on top, the last
 * message and the unread count below, a thin line between rows.
 */
export function ChatRow({
  href,
  picture,
  title,
  time,
  preview,
  unread = 0,
  muted = false,
  highlight = false,
  note,
  onLongPress,
}: ChatRowProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const strong = (unread > 0 && !muted) || highlight;

  return (
    <PressableLink
      href={href}
      onLongPress={onLongPress}
      delayLongPress={400}
      accessibilityHint={onLongPress ? t('chatActions.hint') : undefined}
      style={[styles.row, { borderBottomColor: theme.divider }]}>
      {picture}
      <View style={styles.text}>
        <View style={styles.line}>
          <ThemedText style={styles.title} numberOfLines={1}>
            {title}
          </ThemedText>
          {time ? (
            <ThemedText
              type={strong ? 'smallBold' : 'small'}
              style={[styles.time, { color: strong ? theme.primary : theme.textSecondary }]}>
              {time}
            </ThemedText>
          ) : null}
        </View>
        <View style={styles.line}>
          <ThemedText
            type={strong ? 'smallBold' : 'small'}
            themeColor={strong ? 'text' : 'textSecondary'}
            numberOfLines={1}
            style={styles.preview}>
            {preview}
          </ThemedText>
          <View style={styles.status}>
            {muted && (
              <Icon
                name="bell-off"
                size={15}
                color={theme.textSecondary}
                label={t('mute.mutedTitle')}
              />
            )}
            {(unread > 0 || highlight) && (
              <View
                style={[
                  styles.count,
                  { backgroundColor: muted && !highlight ? theme.border : theme.primary },
                ]}>
                <ThemedText
                  style={[
                    styles.countText,
                    { color: muted && !highlight ? theme.textSecondary : theme.onPrimary },
                  ]}>
                  {unread > 99 ? '99+' : unread > 0 ? unread : 1}
                </ThemedText>
              </View>
            )}
          </View>
        </View>
        {note ? (
          <ThemedText type="smallBold" style={{ color: theme.primary }} numberOfLines={1}>
            {note}
          </ThemedText>
        ) : null}
      </View>
    </PressableLink>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three - 4,
    borderBottomWidth: 1,
  },
  text: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  title: {
    flex: 1,
    fontWeight: 700,
  },
  time: {
    fontSize: 12,
  },
  preview: {
    flex: 1,
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  count: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: 700,
  },
});
