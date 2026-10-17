/**
 * The listings the current user saved (the heart), available anywhere with useSaved().
 * Tapping the heart updates straight away and is undone if saving fails.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

import { useSession } from '@/hooks/use-session';
import { fetchSavedListingIds, saveListing, unsaveListing } from '@/lib/saved';

type SavedState = {
  /** Saved listing IDs, newest first. */
  savedIds: string[];
  isSaved: (listingId: string) => boolean;
  /** Saves or un-saves. Returns false if it didn't work. */
  toggle: (listingId: string) => Promise<boolean>;
};

// One shared empty list, so screens don't re-render (or re-fetch) for no reason.
const NO_IDS: string[] = [];

const SavedContext = createContext<SavedState>({
  savedIds: [],
  isSaved: () => false,
  toggle: async () => false,
});

export function SavedProvider({ children }: PropsWithChildren) {
  const { session } = useSession();
  const userId = session?.user.id;

  // Remember whose list this is, so it's never shown for another account.
  const [loaded, setLoaded] = useState<{ userId: string; ids: string[] } | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    fetchSavedListingIds()
      .then((ids) => {
        if (!cancelled) setLoaded({ userId, ids });
      })
      .catch((error) => console.warn('Could not load saved listings', error));
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const savedIds = useMemo(
    () => (loaded && loaded.userId === userId ? loaded.ids : NO_IDS),
    [loaded, userId]
  );

  const isSaved = useCallback((listingId: string) => savedIds.includes(listingId), [savedIds]);

  const toggle = useCallback(
    async (listingId: string) => {
      if (!userId) return false;
      const wasSaved = savedIds.includes(listingId);
      const update = (save: boolean) =>
        setLoaded((current) => {
          const ids = (current?.userId === userId ? current.ids : []).filter(
            (id) => id !== listingId
          );
          return { userId, ids: save ? [listingId, ...ids] : ids };
        });
      update(!wasSaved);
      try {
        if (wasSaved) await unsaveListing(userId, listingId);
        else await saveListing(userId, listingId);
        return true;
      } catch {
        update(wasSaved);
        return false;
      }
    },
    [userId, savedIds]
  );

  return (
    <SavedContext.Provider value={{ savedIds, isSaved, toggle }}>{children}</SavedContext.Provider>
  );
}

export function useSaved() {
  return useContext(SavedContext);
}
