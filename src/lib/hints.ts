/**
 * One-time tips shown where a feature lives (instead of a long tutorial up front).
 * Remembered per account on this device once dismissed.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export type HintKey = 'welcome' | 'listings' | 'chat' | 'publish' | 'requests';

const key = (userId: string, hint: HintKey) => `chat-pisos.hint.${hint}.${userId}`;

export async function hasSeenHint(userId: string, hint: HintKey): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(key(userId, hint))) === '1';
  } catch {
    // If storage doesn't work, don't keep showing the tip.
    return true;
  }
}

export async function markHintSeen(userId: string, hint: HintKey): Promise<void> {
  await AsyncStorage.setItem(key(userId, hint), '1').catch(() => {});
}
