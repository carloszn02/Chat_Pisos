import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { IconButton } from '@/components/button';
import { Icon, type IconName } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * A one-time tip in the page itself (not a pop-up): what this screen can do, where it's
 * used. The cross hides it for good. `children` can add buttons for a first step.
 */
export function HintCard({
  icon = 'sparkles',
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
    <View
      accessibilityRole="summary"
      style={[styles.card, { backgroundColor: theme.tile, borderColor: theme.border }]}>
      <View style={styles.row}>
        <Icon name={icon} size={20} color={theme.onTile} strokeWidth={2} />
        <View style={styles.text}>
          {title && (
            <ThemedText style={[styles.title, { color: theme.onTile }]}>{title}</ThemedText>
          )}
          <ThemedText type="small" style={{ color: theme.text }}>
            {body}
          </ThemedText>
        </View>
        <IconButton
          icon="close"
          label={t('hints.dismiss')}
          variant="plain"
          size={32}
          onPress={onDismiss}
        />
      </View>
      {children && <View style={styles.actions}>{children}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: Spacing.three,
    paddingRight: Spacing.two,
    gap: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontWeight: 700,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
