import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatShortTime } from '@/lib/format';
import type { InboxItem, PublicProfile } from '@/types/chat';

type ConversationRowProps = {
  item: InboxItem;
  otherUser: PublicProfile | undefined;
  myUserId: string;
};

/** One conversation in the Messages list or the requests list. */
export function ConversationRow({ item, otherUser, myUserId }: ConversationRowProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const name = otherUser?.first_name ?? '…';
  const unread = item.unread_count > 0;

  let preview = item.last_message_body ?? '';
  if (item.last_message_sender_id === myUserId) preview = `${t('chats.you')}: ${preview}`;

  const isSentRequest = item.status === 'pending' && !item.is_incoming_request;

  return (
    <Link href={{ pathname: '/conversation/[id]', params: { id: item.id } }} asChild>
      <Pressable accessibilityRole="link" style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
        <Avatar uri={otherUser?.avatar_url ?? null} name={name} size={48} />
        <View style={styles.text}>
          <ThemedText style={styles.name}>
            {otherUser ? `${otherUser.first_name}, ${otherUser.age}` : name}
          </ThemedText>
          {isSentRequest && (
            <ThemedText type="small" style={{ color: theme.primary }}>
              {t('messages.requestSent')}
            </ThemedText>
          )}
          <ThemedText
            type="small"
            themeColor={unread ? 'text' : 'textSecondary'}
            style={unread && styles.unreadText}
            numberOfLines={1}>
            {preview}
          </ThemedText>
        </View>
        <View style={styles.meta}>
          {item.last_message_at && (
            <ThemedText type="small" themeColor="textSecondary">
              {formatShortTime(item.last_message_at, i18n.language)}
            </ThemedText>
          )}
          {unread && (
            <View style={[styles.badge, { backgroundColor: theme.primary }]}>
              <ThemedText style={[styles.badgeText, { color: theme.onPrimary }]}>{item.unread_count}</ThemedText>
            </View>
          )}
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  text: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontWeight: 700,
  },
  unreadText: {
    fontWeight: 700,
  },
  meta: {
    alignItems: 'flex-end',
    alignSelf: 'flex-start',
    gap: Spacing.one,
    paddingTop: 2,
  },
  badge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: 700,
  },
  pressed: {
    opacity: 0.7,
  },
});
