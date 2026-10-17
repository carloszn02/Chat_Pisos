import * as Linking from 'expo-linking';
import { router, type Href } from 'expo-router';
import { useEffect } from 'react';

import { initialLink, rememberLink, shareablePath, takePendingLink } from '@/lib/links';

// The link the app was opened with, read once.
const opening = initialLink();
// Set once the opening link has been dealt with (remembered, or opened by Expo Router).
let openingHandled = false;

/**
 * Shared links (a group, a listing, a private group invitation) opened while logged out:
 * we remember them, and open them once the person has signed in and has a profile.
 * When already logged in, Expo Router opens links by itself.
 */
export function usePendingLinks({ loggedOut, inApp }: { loggedOut: boolean; inApp: boolean }) {
  // While logged out: remember the opening link and any link opened later.
  useEffect(() => {
    if (!loggedOut) return;
    if (!openingHandled) {
      openingHandled = true;
      void opening.then((path) => {
        if (path) return rememberLink(path);
      });
    }
    const subscription = Linking.addEventListener('url', ({ url }) => {
      const path = shareablePath(url);
      if (path) void rememberLink(path);
    });
    return () => subscription.remove();
  }, [loggedOut]);

  // Once in the app: open the remembered link, if any.
  useEffect(() => {
    if (!inApp) return;
    openingHandled = true;
    let cancelled = false;
    void (async () => {
      const path = await takePendingLink();
      if (path && !cancelled) router.push(path as Href);
    })();
    return () => {
      cancelled = true;
    };
  }, [inApp]);
}
