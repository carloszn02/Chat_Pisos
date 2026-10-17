/**
 * Links people can share: a district group, a listing, or a private group invitation.
 * If someone opens one while logged out, we remember it and open it after they sign in.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

const PENDING_KEY = 'chat-pisos.pending-link';
// A remembered link is forgotten after a day (e.g. if they never finish signing up).
const PENDING_MAX_AGE_MS = 24 * 60 * 60 * 1000;

// Only these screens can be opened from a link.
const SHAREABLE = [/^\/group\/[\w-]+$/, /^\/listing\/[\w-]+$/, /^\/join\/[\w-]+$/];

/**
 * The full address for a screen, e.g. "/group/malasana". Uses the website address once we
 * have one (EXPO_PUBLIC_WEB_URL); until then the web version's own address, or on phones
 * a link that opens the app (works in Expo Go while testing).
 */
export function appUrl(path: string): string {
  const base = process.env.EXPO_PUBLIC_WEB_URL;
  if (base) return `${base.replace(/\/$/, '')}${path}`;
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}${path}`;
  }
  return Linking.createURL(path);
}

/** "/group/malasana" from any of our links, or null if it isn't a screen we share. */
export function shareablePath(url: string | null): string | null {
  if (!url) return null;
  let path: string | null = null;
  if (url.startsWith('/')) {
    path = url;
  } else {
    const parsed = Linking.parse(url);
    path = parsed.path ? `/${parsed.path.replace(/^\/+/, '')}` : null;
  }
  if (!path) return null;
  path = path.split('?')[0].replace(/\/$/, '');
  return SHAREABLE.some((pattern) => pattern.test(path)) ? path : null;
}

export async function rememberLink(path: string): Promise<void> {
  try {
    await AsyncStorage.setItem(PENDING_KEY, JSON.stringify({ path, at: Date.now() }));
  } catch {
    // Not critical: they can open the link again.
  }
}

/** The remembered link (and forgets it), if there is a recent one. */
export async function takePendingLink(): Promise<string | null> {
  try {
    const saved = await AsyncStorage.getItem(PENDING_KEY);
    if (!saved) return null;
    await AsyncStorage.removeItem(PENDING_KEY);
    const { path, at } = JSON.parse(saved) as { path: string; at: number };
    return Date.now() - at < PENDING_MAX_AGE_MS ? shareablePath(path) : null;
  } catch {
    return null;
  }
}

/** The link the app was opened with (the page address on the web). */
export async function initialLink(): Promise<string | null> {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return shareablePath(window.location.pathname);
  }
  return shareablePath(await Linking.getInitialURL());
}
