/**
 * The current user's conversations and private groups, loaded once for the whole app and
 * kept up to date live. The Messages tab, the requests screen and the tab badge all read
 * this same copy (so it's downloaded once, not once per screen).
 */

import { useFocusEffect } from 'expo-router';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from 'react';

import { useBlocks } from '@/hooks/use-blocks';
import { useProfile } from '@/hooks/use-profile';
import { fetchAuthors } from '@/lib/chat';
import { fetchInbox } from '@/lib/direct-messages';
import { fetchMyPrivateGroups } from '@/lib/private-groups';
import { supabase } from '@/lib/supabase';
import type { InboxItem, PrivateGroupSummary, PublicProfile } from '@/types/chat';

export type InboxData = {
  items: InboxItem[];
  /** Private groups you belong to or are invited to. */
  groups: PrivateGroupSummary[];
  users: Map<string, PublicProfile>;
};

type InboxState = {
  data: InboxData | null;
  loadError: boolean;
  reload: () => Promise<void>;
};

const InboxContext = createContext<InboxState>({
  data: null,
  loadError: false,
  reload: async () => {},
});

export function InboxProvider({ children }: PropsWithChildren) {
  const { profile } = useProfile();
  const { blockedIds } = useBlocks();
  const userId = profile?.id;

  // Remember whose inbox this is, so it's never shown for another account.
  const [loaded, setLoaded] = useState<{ userId: string; data: InboxData } | null>(null);
  const [loadError, setLoadError] = useState(false);

  const reload = useCallback(async () => {
    if (!userId) return;
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
      setLoaded({ userId, data: { items, groups, users } });
      setLoadError(false);
    } catch {
      // Keep showing the last known data.
      setLoadError(true);
    }
  }, [userId]);

  // Load on sign-in, and again when the blocked list changes (blocked chats disappear).
  useEffect(() => {
    void (async () => {
      await reload();
    })();
  }, [reload, blockedIds]);

  // The database only sends us changes to our own conversations (row level security).
  useEffect(() => {
    if (!userId) return;
    const refresh = () => {
      void reload();
    };
    const channel = supabase
      .channel(`inbox:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'direct_messages' },
        refresh
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, refresh)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'private_group_messages' },
        refresh
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'private_group_members' },
        refresh
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, reload]);

  const data = loaded && loaded.userId === userId ? loaded.data : null;

  return (
    <InboxContext.Provider value={{ data, loadError, reload }}>{children}</InboxContext.Provider>
  );
}

/** The shared inbox. Screens using it also refresh it when they're shown. */
export function useInbox() {
  const inbox = useContext(InboxContext);
  const { reload } = inbox;

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload])
  );

  return inbox;
}

/** The shared inbox without refreshing on focus (for the tab badge). */
export function useInboxData() {
  return useContext(InboxContext);
}
