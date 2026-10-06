import { useEffect, useState } from 'react';

import { fetchDistricts } from '@/lib/listings';
import type { ChatGroup } from '@/types/chat';

/** The districts people can choose for listings (loaded once, then cached). */
export function useDistricts() {
  const [districts, setDistricts] = useState<ChatGroup[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchDistricts()
      .then((found) => {
        if (!cancelled) setDistricts(found);
      })
      .catch((error) => console.warn('Could not load districts', error));
    return () => {
      cancelled = true;
    };
  }, []);

  return districts;
}

/** "Malasaña, Lavapiés" from a list of district ids. */
export function districtNames(ids: string[], districts: ChatGroup[]): string {
  return ids
    .map((id) => districts.find((d) => d.id === id)?.name)
    .filter(Boolean)
    .join(', ');
}
