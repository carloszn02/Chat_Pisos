import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import type { ChatGroup } from '@/types/chat';

/**
 * The colours of a district group's tile: one calm warm beige for every district (the
 * city-wide group uses the main mocha colour).
 */
export function useGroupTint(group: ChatGroup): { background: string; text: string } {
  const theme = useTheme();
  return group.is_city_wide
    ? { background: theme.primary, text: theme.onPrimary }
    : { background: theme.tile, text: theme.onTile };
}

/** The square badge with the group's initials (e.g. "ML" for Malasaña). */
export function GroupTile({ group, size = 48 }: { group: ChatGroup; size?: number }) {
  const tint = useGroupTint(group);

  return (
    <View
      style={[
        styles.tile,
        { width: size, height: size, borderRadius: size * 0.3, backgroundColor: tint.background },
      ]}>
      {/* "subtitle" gives the heading font; the size is set here. */}
      <TileInitials text={group.short_code} color={tint.text} size={size * 0.34} />
    </View>
  );
}

/** Initials in the heading font, for tiles and badges. */
export function TileInitials({ text, color, size }: { text: string; color: string; size: number }) {
  return (
    <ThemedText type="subtitle" style={{ color, fontSize: size, lineHeight: size * 1.25 }}>
      {text}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
