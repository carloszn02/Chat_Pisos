/**
 * The single Supabase client used across the app (auth, database, realtime chat).
 * Connection values come from .env.local (see .env.example).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing Supabase settings. Copy .env.example to .env.local and fill in the values.'
  );
}

// During web static rendering there is no browser, so there is nowhere to keep a session.
const isServer = typeof window === 'undefined';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: isServer ? undefined : AsyncStorage,
    persistSession: !isServer,
    autoRefreshToken: !isServer,
    detectSessionInUrl: Platform.OS === 'web',
  },
});

// On phones, only refresh the login token while the app is open.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
