/** Remembers, per account on this device, whether the welcome tutorial was seen or skipped. */

import AsyncStorage from '@react-native-async-storage/async-storage';

const key = (userId: string) => `chat-pisos.tutorial-seen.${userId}`;

export async function hasSeenTutorial(userId: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(key(userId))) === '1';
  } catch {
    // If storage doesn't work, don't keep showing the tutorial.
    return true;
  }
}

export async function markTutorialSeen(userId: string): Promise<void> {
  await AsyncStorage.setItem(key(userId), '1').catch(() => {});
}
