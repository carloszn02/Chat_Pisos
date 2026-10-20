/**
 * Light or dark: the person chooses in Settings (Light / Dark / Automatic, which follows
 * the phone or computer). The choice is remembered on this device.
 * Use useColorScheme() from here everywhere, never React Native's directly.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from 'react';
import { Appearance, Platform, useColorScheme as useSystemColorScheme } from 'react-native';

export type AppearancePreference = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'chat-pisos.appearance';

type AppearanceState = {
  preference: AppearancePreference;
  setPreference: (preference: AppearancePreference) => void;
};

const AppearanceContext = createContext<AppearanceState>({
  preference: 'system',
  setPreference: () => {},
});

export function AppearanceProvider({ children }: PropsWithChildren) {
  const [preference, setPreferenceState] = useState<AppearancePreference>('system');

  // The choice saved last time.
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (saved === 'light' || saved === 'dark' || saved === 'system') {
          setPreferenceState(saved);
        }
      })
      .catch(() => {});
  }, []);

  // On phones, also tell the system, so the keyboard, status bar and alerts match.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    Appearance.setColorScheme(preference === 'system' ? 'unspecified' : preference);
  }, [preference]);

  const setPreference = useCallback((next: AppearancePreference) => {
    setPreferenceState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  return (
    <AppearanceContext.Provider value={{ preference, setPreference }}>
      {children}
    </AppearanceContext.Provider>
  );
}

/** The person's choice and the way to change it (for Settings). */
export function useAppearance() {
  return useContext(AppearanceContext);
}

/** The colours to use right now: 'light' or 'dark'. */
export function useColorScheme(): 'light' | 'dark' {
  const { preference } = useContext(AppearanceContext);
  const system = useSystemColorScheme();
  if (preference !== 'system') return preference;
  return system === 'dark' ? 'dark' : 'light';
}
