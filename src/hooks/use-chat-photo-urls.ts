import { useEffect, useState } from 'react';

import { fetchChatPhotoUrls } from '@/lib/chat-photos';

/**
 * Short-lived links for the photos in a chat's messages, fetched as new photos appear.
 * Photos without a link yet show a soft placeholder; photos that couldn't get a link at all
 * are listed in `failed` so they can say "Photo unavailable" instead of staying blank.
 */
export function useChatPhotoUrls(messages: { image_path?: string | null }[]) {
  const [urls, setUrls] = useState<Map<string, string>>(new Map());
  const [failed, setFailed] = useState<Set<string>>(new Set());
  const paths = messages.flatMap((m) => (m.image_path ? [m.image_path] : []));
  // A stable key, so the effect only runs when the set of photos changes.
  const key = paths.join('|');

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    const wanted = key.split('|');
    fetchChatPhotoUrls(wanted)
      .then((found) => {
        if (cancelled) return;
        setUrls((current) => new Map([...current, ...found]));
        const missing = wanted.filter((path) => !found.has(path));
        if (missing.length > 0) {
          console.warn('No link for chat photos', missing);
          setFailed((current) => new Set([...current, ...missing]));
        }
      })
      .catch((error) => {
        console.warn('Could not load chat photos', error);
        if (!cancelled) setFailed((current) => new Set([...current, ...wanted]));
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return { urls, failed };
}
