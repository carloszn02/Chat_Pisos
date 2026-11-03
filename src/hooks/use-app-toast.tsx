import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

import { Toast } from '@/components/toast';

const AppToastContext = createContext<(message: string) => void>(() => {});

/** One short message area for the whole app (e.g. "Saved"), above everything. */
export function AppToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const hide = useCallback(() => setMessage(null), []);
  return (
    <AppToastContext.Provider value={setMessage}>
      {children}
      <Toast message={message} onHide={hide} />
    </AppToastContext.Provider>
  );
}

/** Shows a short message at the bottom of the screen, which hides itself. */
export function useAppToast() {
  return useContext(AppToastContext);
}
