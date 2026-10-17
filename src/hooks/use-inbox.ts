import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { fetchAuthors } from '@/lib/chat';
import { fetchInbox } from '@/lib/direct-messages';
import { fetchMyPrivateGroups } from '@/lib/private-groups';
import { supabase } from '@/lib/supabase';
import type { InboxItem, PrivateGroupSummary, PublicProfile } from '@/types/chat';

type InboxState = {
  items: InboxItem[];
  /** Private groups you belong to or are invited to. */
  groups: PrivateGroupSummary[];
  users: Map<string, PublicProfile>;
};

/**
 * The current user's conversations and private groups, refreshed when the screen is
 * shown and whenever a private message, request or group changes.
 */
export function useInbox() {
  const [data, setData] = useState<InboxState | null>(null);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    try {
      const [items, groups] = await Promise.all([fetchInbox(), fetchMyPrivateGroups()]);
      const users = await fetchAuthors(
        [
          ...items.map((item) => item.other_user_id),
          ...groups.flatMap((group) => [
            group.invited_by,
            group.last_message_sender_id,
            group.last_message_subject_id,
          ]),
        ].filter((id): id is string => !!id)
      );
      setData({ items, groups, users });
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // The database only sends us changes to our own conversations (row level security).
  useEffect(() => {
    // Unique name: the Messages tab and the requests screen can both be open at once.
    const channel = supabase
      .channel(`inbox:${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages' }, () =>
        load()
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () =>
        load()
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'private_group_messages' },
        () => load()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'private_group_members' },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  return { data, loadError, reload: load };
}
