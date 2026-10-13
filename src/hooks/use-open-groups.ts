import { useEffect, useState } from 'react';

import { usePlaces } from '@/hooks/use-places';
import { fetchGroups } from '@/lib/chat';
import type { ChatGroup } from '@/types/chat';

/** The district/neighbourhood group chats of the current city (not the city-wide one). */
export function useOpenGroups() {
  const { city } = usePlaces();
  const cityId = city?.id;
  const [groups, setGroups] = useState<ChatGroup[]>([]);

  useEffect(() => {
    if (!cityId) return;
    let cancelled = false;
    fetchGroups()
      .then((found) => {
        if (!cancelled) setGroups(found.filter((g) => g.city_id === cityId && !g.is_city_wide));
      })
      .catch((error) => console.warn('Could not load groups', error));
    return () => {
      cancelled = true;
    };
  }, [cityId]);

  return groups;
}
