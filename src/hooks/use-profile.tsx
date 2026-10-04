/**
 * Loads the logged-in user's profile. `profile` is null when the user hasn't
 * created one yet (they are then sent to the create-profile screen).
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
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types/profile';

type ProfileState = {
  profile: Profile | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
};

const ProfileContext = createContext<ProfileState>({
  profile: null,
  isLoading: true,
  refresh: async () => {},
});

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    console.warn('Could not load profile', error.message);
    return null;
  }
  return data as Profile | null;
}

export function ProfileProvider({ children }: PropsWithChildren) {
  const { session, isLoading: sessionLoading } = useSession();
  const userId = session?.user.id;

  // Remember which user the loaded profile belongs to, so a logout or account
  // switch never shows someone else's profile.
  const [loaded, setLoaded] = useState<{ userId: string; profile: Profile | null } | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    fetchProfile(userId).then((profile) => {
      if (!cancelled) setLoaded({ userId, profile });
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const refresh = useCallback(async () => {
    if (!userId) return;
    const profile = await fetchProfile(userId);
    setLoaded({ userId, profile });
  }, [userId]);

  const isCurrent = !!userId && loaded?.userId === userId;
  const value: ProfileState = {
    profile: isCurrent ? loaded.profile : null,
    isLoading: sessionLoading || (!!userId && !isCurrent),
    refresh,
  };

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  return useContext(ProfileContext);
}
