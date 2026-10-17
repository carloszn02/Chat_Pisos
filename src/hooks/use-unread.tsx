/**
 * Total unread private messages (including message requests), private group messages,
 * invitations and join requests, for the badge on the Messages tab. Muted chats don't
 * count. Read from the shared inbox, so it updates live with it.
 */

import { useInboxData } from '@/hooks/use-inbox';
import { useMutes } from '@/hooks/use-mutes';
import type { InboxItem, PrivateGroupSummary } from '@/types/chat';

/** Unread messages, pending requests and invitations, leaving out muted chats. */
export function unreadTotal(
  items: InboxItem[],
  groups: PrivateGroupSummary[],
  isMuted: (kind: 'conversation' | 'private_group', id: string) => boolean
): number {
  return (
    items.reduce(
      (total, item) =>
        total +
        (item.is_incoming_request
          ? 1
          : isMuted('conversation', item.id)
            ? 0
            : (item.unread_count ?? 0)),
      0
    ) +
    groups.reduce((total, group) => {
      if (group.my_status === 'invited') return total + 1;
      if (isMuted('private_group', group.id)) return total;
      // "?? 0": a missing number must never turn the total into NaN.
      return total + (group.unread_count ?? 0) + (group.pending_requests ?? 0);
    }, 0)
  );
}

export function useUnreadCount() {
  const { data } = useInboxData();
  const { isMuted } = useMutes();
  return data ? unreadTotal(data.items, data.groups, isMuted) : 0;
}
