import { useEffect, useState, type ReactNode, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, type FlatList } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatChatDay, isSameDay } from '@/lib/format';

type ChatDividersProps = {
  /** When this message was sent. */
  createdAt: string;
  /** When the message shown just above it was sent (undefined for the oldest one loaded). */
  olderCreatedAt: string | undefined;
  /** Set on the first unread message: shows "3 new messages" above it. */
  newCount?: number;
  children: ReactNode;
};

/**
 * Wraps one chat message with what goes above it: the day ("Today", "Yesterday",
 * "12 October") when it starts a new day, and the "new messages" line.
 */
export function ChatDividers({ createdAt, olderCreatedAt, newCount, children }: ChatDividersProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const startsDay = !olderCreatedAt || !isSameDay(createdAt, olderCreatedAt);

  if (!startsDay && !newCount) return children;

  return (
    <View style={styles.wrap}>
      {startsDay && (
        <View style={[styles.dayPill, { backgroundColor: theme.backgroundSelected }]}>
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.dayText}>
            {formatChatDay(createdAt, i18n.language, {
              today: t('chats.today'),
              yesterday: t('chats.yesterday'),
            })}
          </ThemedText>
        </View>
      )}
      {!!newCount && (
        <View style={styles.newRow} accessibilityRole="text">
          <View style={[styles.newLine, { backgroundColor: theme.primary }]} />
          <ThemedText type="smallBold" style={{ color: theme.primary }}>
            {t('chats.newMessages', { count: newCount })}
          </ThemedText>
          <View style={[styles.newLine, { backgroundColor: theme.primary }]} />
        </View>
      )}
      {children}
    </View>
  );
}

/**
 * The first unread message when the chat was opened: written by someone else after you last
 * read the chat. Worked out once, so it doesn't move while you're reading.
 * `messages` is newest first. Returns its id and how many unread messages there were.
 */
export function findFirstUnread<T extends { id: string; created_at: string }>(
  messages: T[],
  lastReadAt: string | null,
  isFromOthers: (message: T) => boolean
): { id: string; count: number } | null {
  const unread = messages.filter(
    (m) => isFromOthers(m) && (!lastReadAt || m.created_at > lastReadAt)
  );
  if (unread.length === 0) return null;
  return { id: unread[unread.length - 1].id, count: unread.length };
}

/**
 * When opening a chat with many unread messages, scroll up so the "new messages" line is
 * visible, like WhatsApp. Pass this to the list's onScrollToIndexFailed too.
 */
export function useJumpToUnread<T>(
  listRef: RefObject<FlatList<T> | null>,
  index: number
): (info: { index: number; averageItemLength: number }) => void {
  const [done, setDone] = useState(false);

  useEffect(() => {
    // A few messages fit on screen anyway; only jump for longer gaps.
    if (done || index < 6) return;
    const timer = setTimeout(() => {
      listRef.current?.scrollToIndex({ index, viewPosition: 0.8, animated: false });
      setDone(true);
    }, 150);
    return () => clearTimeout(timer);
  }, [done, index, listRef]);

  // The list hasn't measured that far yet: scroll roughly there, then try again.
  return (info) => {
    listRef.current?.scrollToOffset({
      offset: info.averageItemLength * info.index,
      animated: false,
    });
    setTimeout(() => {
      listRef.current?.scrollToIndex({ index: info.index, viewPosition: 0.8, animated: false });
    }, 120);
  };
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.two,
  },
  dayPill: {
    alignSelf: 'center',
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    marginVertical: Spacing.one,
  },
  dayText: {
    fontSize: 12,
    lineHeight: 16,
  },
  newRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginVertical: Spacing.one,
  },
  newLine: {
    flex: 1,
    height: 1,
    opacity: 0.5,
  },
});
