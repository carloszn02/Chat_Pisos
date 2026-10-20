import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { AppFonts, Spacing } from '@/constants/theme';

type ChatHeaderTitleProps = {
  title: string;
  /** A short line under the name, e.g. "128 members" or who's in the group. */
  subtitle?: string;
  /** A photo or tile shown before the name. */
  picture?: ReactNode;
  /** Opens the profile or the group's page (like tapping the name in WhatsApp). */
  onPress: () => void;
};

/** The tappable name at the top of a chat. */
export function ChatHeaderTitle({ title, subtitle, picture, onPress }: ChatHeaderTitleProps) {
  const { t } = useTranslation();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={t('chats.openInfoHint')}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      {picture}
      <View style={styles.text}>
        <ThemedText style={styles.title} numberOfLines={1}>
          {title}
        </ThemedText>
        {subtitle ? (
          <ThemedText
            type="small"
            themeColor="textSecondary"
            numberOfLines={1}
            style={styles.subtitle}>
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    maxWidth: 260,
  },
  text: {
    flexShrink: 1,
  },
  title: {
    fontFamily: AppFonts.headingSemiBold,
    fontWeight: 700,
    fontSize: 17,
    lineHeight: 22,
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
  pressed: {
    opacity: 0.6,
  },
});
