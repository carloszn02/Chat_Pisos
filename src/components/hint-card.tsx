import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * A one-time tip in the page itself: a short note in plain text (no box, so it doesn't
 * compete with the content), with "Got it" to hide it for good. The icon says what the tip
 * is about. `children` can add buttons for a first step.
 */
export function HintCard({
  icon,
  title,
  body,
  onDismiss,
  children,
}: {
  icon?: IconName;
  title?: string;
  body: string;
  onDismiss: () => void;
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <View style={styles.note}>
      <View style={styles.row}>
        {icon && (
          <View style={styles.icon}>
            <Icon name={icon} size={16} color={theme.textSecondary} strokeWidth={2} />
          </View>
        )}
        <ThemedText type="small" themeColor="textSecondary" style={styles.text}>
          {title && <ThemedText type="smallBold">{title} </ThemedText>}
          {body}
        </ThemedText>
        <Pressable
          accessibilityRole="button"
          onPress={onDismiss}
          hitSlop={12}
          style={({ pressed }) => pressed && styles.pressed}>
          <ThemedText type="smallBold" style={{ color: theme.primary }}>
            {t('hints.dismiss')}
          </ThemedText>
        </Pressable>
      </View>
      {children && <View style={styles.actions}>{children}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  note: {
    gap: Spacing.three,
    paddingVertical: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  icon: {
    marginTop: 2,
  },
  text: {
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  pressed: {
    opacity: 0.6,
  },
});
