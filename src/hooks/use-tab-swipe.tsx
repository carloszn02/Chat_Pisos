import { createContext, useContext, useEffect, type ReactNode } from 'react';

type TabSwipe = { setSwipeEnabled: (enabled: boolean) => void };

const TabSwipeContext = createContext<TabSwipe>({ setSwipeEnabled: () => {} });

export function TabSwipeProvider({
  setSwipeEnabled,
  children,
}: TabSwipe & { children: ReactNode }) {
  return (
    <TabSwipeContext.Provider value={{ setSwipeEnabled }}>{children}</TabSwipeContext.Provider>
  );
}

/**
 * Turns off swiping between the main tabs while `enabled` is false, e.g. while the map is
 * open (dragging should move the map, not change the page). Does nothing on the web.
 */
export function useTabSwipe(enabled: boolean) {
  const { setSwipeEnabled } = useContext(TabSwipeContext);
  useEffect(() => {
    setSwipeEnabled(enabled);
    return () => setSwipeEnabled(true);
  }, [enabled, setSwipeEnabled]);
}
