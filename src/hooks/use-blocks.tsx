/**
 * The people the current user has blocked, available anywhere with useBlocks().
 * Screens use it to hide blocked users' messages straight away and to show
 * Block / Unblock buttons.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from 'react';

import { useSession } from '@/hooks/use-session';
import { blockUser, fetchBlockedIds, unblockUser } from '@/lib/moderation';

type BlocksState = {
  blockedIds: ReadonlySet<string>;
  block: (userId: string) => Promise<void>;
  unblock: (userId: string) => Promise<void>;
};

// One shared empty set, so screens don't re-render (or re-fetch) for no reason.
const NO_BLOCKS: ReadonlySet<string> = new Set();

const BlocksContext = createContext<BlocksState>({
  blockedIds: NO_BLOCKS,
  block: async () => {},
  unblock: async () => {},
});

export function BlocksProvider({ children }: PropsWithChildren) {
  const { session } = useSession();
  const userId = session?.user.id;

  // Remember whose list this is, so it's never shown for another account.
  const [loaded, setLoaded] = useState<{ userId: string; ids: Set<string> } | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    fetchBlockedIds(userId)
      .then((ids) => {
        if (!cancelled) setLoaded({ userId, ids });
      })
      .catch((error) => console.warn('Could not load blocked users', error));
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const block = useCallback(
    async (blockedId: string) => {
      if (!userId) return;
      await blockUser(blockedId);
      setLoaded((current) => ({
        userId,
        ids: new Set([...(current?.userId === userId ? current.ids : []), blockedId]),
      }));
    },
    [userId]
  );

  const unblock = useCallback(
    async (blockedId: string) => {
      if (!userId) return;
      await unblockUser(userId, blockedId);
      setLoaded((current) => {
        const ids = new Set(current?.userId === userId ? current.ids : []);
        ids.delete(blockedId);
        return { userId, ids };
      });
    },
    [userId]
  );

  const blockedIds = loaded && loaded.userId === userId ? loaded.ids : NO_BLOCKS;

  return (
    <BlocksContext.Provider value={{ blockedIds, block, unblock }}>{children}</BlocksContext.Provider>
  );
}

export function useBlocks() {
  return useContext(BlocksContext);
}
