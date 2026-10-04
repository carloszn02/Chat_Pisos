import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import type { ChatGroup } from '@/types/chat';

// Soft tints so neighbouring groups are easy to tell apart.
const TINTS = [
  { background: '#FBE9DC', text: '#8A3D10' },
  { background: '#E3ECFB', text: '#1E4FB8' },
  { background: '#DFF0E8', text: '#185C45' },
  { background: '#F3EAE3', text: '#5C3F2F' },
];

/** The square badge with the group's initials (e.g. "ML" for Malasaña). */
export function GroupTile({ group, size = 48 }: { group: ChatGroup; size?: number }) {
  const theme = useTheme();
  const tint = group.is_city_wide
    ? { background: theme.primary, text: theme.onPrimary }
    : TINTS[group.sort_order % TINTS.length];

  return (
    <View
      style={[
        styles.tile,
        { width: size, height: size, borderRadius: size * 0.3, backgroundColor: tint.background },
      ]}>
      <ThemedText style={{ color: tint.text, fontWeight: 700, fontSize: size * 0.32 }}>
        {group.short_code}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
