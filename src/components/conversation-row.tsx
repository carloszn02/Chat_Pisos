import { useTranslation } from 'react-i18next';

import { Avatar } from '@/components/avatar';
import { ChatRow } from '@/components/chat-row';
import { formatShortTime } from '@/lib/format';
import type { InboxItem, PublicProfile } from '@/types/chat';

type ConversationRowProps = {
  item: InboxItem;
  otherUser: PublicProfile | undefined;
  myUserId: string;
  /** Muted chats show a bell icon and a grey counter. */
  muted?: boolean;
};

/** One conversation in the Messages list or the requests list. */
export function ConversationRow({
  item,
  otherUser,
  myUserId,
  muted = false,
}: ConversationRowProps) {
  const { t, i18n } = useTranslation();
  const name = otherUser?.first_name ?? '…';

  // A photo sent without text shows as "Photo".
  let preview = item.last_message_deleted
    ? t('chats.messageDeleted')
    : item.last_message_at && !item.last_message_body
      ? t('chats.photoPreview')
      : (item.last_message_body ?? '');
  if (item.last_message_sender_id === myUserId) preview = `${t('chats.you')}: ${preview}`;

  const isSentRequest = item.status === 'pending' && !item.is_incoming_request;

  return (
    <ChatRow
      href={{ pathname: '/conversation/[id]', params: { id: item.id } }}
      picture={<Avatar uri={otherUser?.avatar_url ?? null} name={name} size={50} />}
      title={otherUser ? `${otherUser.first_name}, ${otherUser.age}` : name}
      time={item.last_message_at ? formatShortTime(item.last_message_at, i18n.language) : null}
      preview={preview}
      unread={item.unread_count}
      muted={muted}
      highlight={item.is_incoming_request}
      note={isSentRequest ? t('messages.requestSent') : undefined}
    />
  );
}
