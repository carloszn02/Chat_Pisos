/**
 * Keeps track of who is logged in. Wrap the app in <SessionProvider> and call
 * useSession() anywhere to get the current Supabase session (null = logged out).
 */

import type { Session } from '@supabase/supabase-js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from 'react';

import { openedFromPasswordReset, supabase } from '@/lib/supabase';

type SessionState = {
  session: Session | null;
  isLoading: boolean;
  /** True after opening a "reset your password" link, until a new password is set. */
  isRecoveringPassword: boolean;
  finishPasswordRecovery: () => void;
};

const SessionContext = createContext<SessionState>({
  session: null,
  isLoading: true,
  isRecoveringPassword: false,
  finishPasswordRecovery: () => {},
});

export function SessionProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRecoveringPassword, setIsRecoveringPassword] = useState(openedFromPasswordReset);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      setIsLoading(false);
      if (event === 'PASSWORD_RECOVERY') setIsRecoveringPassword(true);
      if (event === 'SIGNED_OUT') setIsRecoveringPassword(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const finishPasswordRecovery = useCallback(() => setIsRecoveringPassword(false), []);

  return (
    <SessionContext.Provider value={{ session, isLoading, isRecoveringPassword, finishPasswordRecovery }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}
