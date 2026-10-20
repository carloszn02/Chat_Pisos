import { StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** A quiet one-line safety reminder at the top of a chat, with a shield icon. */
export function SafetyTip({ text }: { text: string }) {
  const theme = useTheme();
  return (
    <View style={styles.row} accessibilityRole="text">
      <Icon name="shield" size={15} color={theme.primary} strokeWidth={2} />
      <ThemedText type="small" themeColor="textSecondary" style={styles.text}>
        {text}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  text: {
    flexShrink: 1,
    fontSize: 12,
    lineHeight: 16,
  },
});
