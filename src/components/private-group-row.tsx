import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ZoomablePhoto } from '@/components/avatar';
import { ChatRow } from '@/components/chat-row';
import { TileInitials } from '@/components/group-tile';
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
  /** Long-press: the chat's options. */
  onLongPress?: () => void;
};

/** The group's photo, or a round badge with its initials (e.g. "FH" for "Flat hunting"). */
export function PrivateGroupBadge({
  name,
  photoUrl,
  size = 48,
  zoomable = false,
}: {
  name: string;
  photoUrl?: string | null;
  size?: number;
  /** Tapping the photo opens it big. */
  zoomable?: boolean;
}) {
  const theme = useTheme();
  if (photoUrl) {
    const image = (
      <Image
        source={{ uri: photoUrl }}
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: theme.tile }}
        contentFit="cover"
        accessibilityIgnoresInvertColors
      />
    );
    return zoomable ? <ZoomablePhoto url={photoUrl}>{image}</ZoomablePhoto> : image;
  }
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
        { width: size, height: size, borderRadius: size / 2, backgroundColor: theme.tile },
      ]}>
      <TileInitials text={initials || '·'} color={theme.onTile} size={size * 0.34} />
    </View>
  );
}

/** One private group in the Messages list (or an invitation in the requests list). */
export function PrivateGroupRow({
  group,
  users,
  myUserId,
  muted = false,
  onLongPress,
}: PrivateGroupRowProps) {
  const { t, i18n } = useTranslation();
  const invited = group.my_status === 'invited';
  const requests = invited ? 0 : (group.pending_requests ?? 0);

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
    // A photo sent without text shows as "Photo".
    const body = group.last_message_deleted
      ? t('chats.messageDeleted')
      : group.last_message_body || t('chats.photoPreview');
    preview = author ? `${author}: ${body}` : body;
  }

  return (
    <ChatRow
      href={{ pathname: '/private-group/[id]', params: { id: group.id } }}
      picture={<PrivateGroupBadge name={group.name} photoUrl={group.photo_url} size={50} />}
      title={group.name}
      time={
        group.last_message_at && !invited
          ? formatShortTime(group.last_message_at, i18n.language)
          : null
      }
      preview={preview}
      unread={invited ? 0 : group.unread_count}
      muted={muted && !invited}
      highlight={invited}
      note={requests > 0 ? t('privateGroups.requestsBanner', { count: requests }) : undefined}
      onLongPress={invited ? undefined : onLongPress}
    />
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
