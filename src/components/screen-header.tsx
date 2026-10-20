import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

/**
 * The top of each tab: the big title on the left and round icon buttons on the right,
 * the same on every tab.
 */
export function ScreenHeader({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    <View style={styles.header}>
      <ThemedText type="subtitle" style={styles.title} accessibilityRole="header">
        {title}
      </ThemedText>
      {actions ? <View style={styles.actions}>{actions}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    minHeight: 44,
  },
  title: {
    flexShrink: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
});
