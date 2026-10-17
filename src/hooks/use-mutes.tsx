/**
 * The chats the current user has muted, available anywhere with useMutes().
 * A muted chat still gets messages, but they don't count in the badges (and, once the
 * app sends notifications, it won't send any for that chat).
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
import {
  fetchMyMutes,
  isStillMuted,
  muteChat,
  muteKey,
  unmuteChat,
  type ChatKind,
  type MuteDuration,
} from '@/lib/mutes';

type MutesState = {
  isMuted: (kind: ChatKind, chatId: string) => boolean;
  mute: (kind: ChatKind, chatId: string, duration: MuteDuration) => Promise<void>;
  unmute: (kind: ChatKind, chatId: string) => Promise<void>;
  /** Changes whenever the list changes, so counters can re-calculate. */
  version: number;
};

const MutesContext = createContext<MutesState>({
  isMuted: () => false,
  mute: async () => {},
  unmute: async () => {},
  version: 0,
});

export function MutesProvider({ children }: PropsWithChildren) {
  const { session } = useSession();
  const userId = session?.user.id;

  // chat key -> muted until. Remember whose list this is, so it's never shown for another account.
  const [loaded, setLoaded] = useState<{ userId: string; until: Map<string, string> } | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    fetchMyMutes()
      .then((mutes) => {
        if (cancelled) return;
        setLoaded({
          userId,
          until: new Map(mutes.map((m) => [muteKey(m.chat_kind, m.chat_id), m.muted_until])),
        });
        setVersion((v) => v + 1);
      })
      .catch((error) => console.warn('Could not load muted chats', error));
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const until = loaded && loaded.userId === userId ? loaded.until : null;

  const isMuted = useCallback(
    (kind: ChatKind, chatId: string) => {
      const value = until?.get(muteKey(kind, chatId));
      return !!value && isStillMuted(value);
    },
    [until]
  );

  const mute = useCallback(
    async (kind: ChatKind, chatId: string, duration: MuteDuration) => {
      if (!userId) return;
      const saved = await muteChat(userId, kind, chatId, duration);
      setLoaded((current) => {
        const map = new Map(current?.userId === userId ? current.until : []);
        map.set(muteKey(kind, chatId), saved.muted_until);
        return { userId, until: map };
      });
      setVersion((v) => v + 1);
    },
    [userId]
  );

  const unmute = useCallback(
    async (kind: ChatKind, chatId: string) => {
      if (!userId) return;
      await unmuteChat(kind, chatId);
      setLoaded((current) => {
        const map = new Map(current?.userId === userId ? current.until : []);
        map.delete(muteKey(kind, chatId));
        return { userId, until: map };
      });
      setVersion((v) => v + 1);
    },
    [userId]
  );

  return (
    <MutesContext.Provider value={{ isMuted, mute, unmute, version }}>
      {children}
    </MutesContext.Provider>
  );
}

export function useMutes() {
  return useContext(MutesContext);
}
