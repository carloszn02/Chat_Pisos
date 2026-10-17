import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatShortTime } from '@/lib/format';
import { eventText } from '@/lib/private-groups';
import type { PrivateGroupSummary, PublicProfile } from '@/types/chat';

type PrivateGroupRowProps = {
  group: PrivateGroupSummary;
  users: Map<string, PublicProfile>;
  myUserId: string;
  /** Muted chats show a bell icon and a grey counter. */
  muted?: boolean;
};

/** The round badge with a group's initials, e.g. "FH" for "Flat hunting". */
export function PrivateGroupBadge({ name, size = 48 }: { name: string; size?: number }) {
  const theme = useTheme();
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('');
  return (
    <View
      style={[
        styles.badge,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: theme.backgroundSelected,
        },
      ]}>
      <ThemedText style={{ color: theme.primary, fontWeight: 700, fontSize: size * 0.34 }}>
        {initials || '·'}
      </ThemedText>
    </View>
  );
}

/** One private group in the Messages list (or an invitation in the requests list). */
export function PrivateGroupRow({ group, users, myUserId, muted = false }: PrivateGroupRowProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const invited = group.my_status === 'invited';
  const unread = group.unread_count > 0;
  const requests = invited ? 0 : (group.pending_requests ?? 0);
  const highlight = (unread && !muted) || invited;

  let preview: string;
  if (invited) {
    preview = t('privateGroups.invitedBy', {
      name: users.get(group.invited_by ?? '')?.first_name ?? '',
    });
  } else if (!group.last_message_at) {
    preview = t('privateGroups.memberCount', { count: group.member_count });
  } else if (group.last_message_kind === 'event' && group.last_message_event) {
    preview = eventText(
      t,
      group.last_message_event,
      group.last_message_sender_id ?? '',
      group.last_message_subject_id,
      myUserId,
      (personId) => (personId ? (users.get(personId)?.first_name ?? '…') : '…')
    );
  } else {
    const author =
      group.last_message_sender_id === myUserId
        ? t('chats.you')
        : (users.get(group.last_message_sender_id ?? '')?.first_name ?? '');
    const body = group.last_message_deleted
      ? t('chats.messageDeleted')
      : (group.last_message_body ?? '');
    preview = author ? `${author}: ${body}` : body;
  }

  return (
    <Link href={{ pathname: '/private-group/[id]', params: { id: group.id } }} asChild>
      <Pressable
        accessibilityRole="link"
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
        <PrivateGroupBadge name={group.name} />
        <View style={styles.text}>
          <ThemedText style={styles.name} numberOfLines={1}>
            {group.name}
            {muted ? <ThemedText style={styles.mutedIcon}> 🔕</ThemedText> : null}
          </ThemedText>
          <ThemedText
            type="small"
            themeColor={highlight ? 'text' : 'textSecondary'}
            style={highlight && styles.bold}
            numberOfLines={1}>
            {preview}
          </ThemedText>
          {requests > 0 && (
            <ThemedText type="smallBold" style={{ color: theme.primary }}>
              {t('privateGroups.requestsBanner', { count: requests })}
            </ThemedText>
          )}
        </View>
        <View style={styles.meta}>
          {group.last_message_at && !invited && (
            <ThemedText type="small" themeColor="textSecondary">
              {formatShortTime(group.last_message_at, i18n.language)}
            </ThemedText>
          )}
          {(unread || invited) && (
            <View
              style={[
                styles.count,
                {
                  backgroundColor: muted && !invited ? theme.backgroundSelected : theme.primary,
                },
              ]}>
              <ThemedText
                style={[
                  styles.countText,
                  { color: muted && !invited ? theme.textSecondary : theme.onPrimary },
                ]}>
                {invited ? '1' : group.unread_count > 99 ? '99+' : group.unread_count}
              </ThemedText>
            </View>
          )}
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  bold: {
    fontWeight: 700,
  },
  mutedIcon: {
    fontSize: 12,
  },
  meta: {
    alignItems: 'flex-end',
    alignSelf: 'flex-start',
    gap: Spacing.one,
    paddingTop: 2,
  },
  count: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: 700,
  },
  pressed: {
    opacity: 0.7,
  },
});
