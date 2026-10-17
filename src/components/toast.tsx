import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

/** A short message at the bottom of the screen (e.g. "Link copied") that hides itself. */
export function Toast({ message, onHide }: { message: string | null; onHide: () => void }) {
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onHide, 2500);
    return () => clearTimeout(timer);
  }, [message, onHide]);

  if (!message) return null;
  return (
    <View
      pointerEvents="none"
      style={[styles.wrap, { bottom: Math.max(insets.bottom, Spacing.three) + 72 }]}>
      <View style={styles.toast} accessibilityLiveRegion="polite">
        <ThemedText type="small" style={styles.text}>
          {message}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  toast: {
    backgroundColor: 'rgba(46, 38, 32, 0.92)',
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  text: {
    color: '#FFFFFF',
  },
});
