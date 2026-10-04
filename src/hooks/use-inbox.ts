import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { fetchAuthors } from '@/lib/chat';
import { fetchInbox } from '@/lib/direct-messages';
import { supabase } from '@/lib/supabase';
import type { InboxItem, PublicProfile } from '@/types/chat';

type InboxState = {
  items: InboxItem[];
  users: Map<string, PublicProfile>;
};

/**
 * The current user's conversations, refreshed when the screen is shown and
 * whenever a private message or request changes.
 */
export function useInbox() {
  const [data, setData] = useState<InboxState | null>(null);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    try {
      const items = await fetchInbox();
      const users = await fetchAuthors(items.map((item) => item.other_user_id));
      setData({ items, users });
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
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  return { data, loadError, reload: load };
}
