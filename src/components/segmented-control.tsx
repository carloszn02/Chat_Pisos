import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

export type Segment<Key extends string> = {
  key: Key;
  label: string;
  /** A number in a small bubble (e.g. unread messages); hidden when 0. */
  badge?: number;
};

type SegmentedControlProps<Key extends string> = {
  segments: Segment<Key>[];
  selected: Key;
  onChange: (key: Key) => void;
};

/** Two or three sections side by side, like "Groups | Private" or "About me | Listings". */
export function SegmentedControl<Key extends string>({
  segments,
  selected,
  onChange,
}: SegmentedControlProps<Key>) {
  const theme = useTheme();

  return (
    <View
      style={[styles.segments, { backgroundColor: theme.backgroundSelected }]}
      accessibilityRole="tablist">
      {segments.map((segment) => {
        const isSelected = segment.key === selected;
        const badge = segment.badge ?? 0;
        return (
          <Pressable
            key={segment.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: isSelected }}
            onPress={() => onChange(segment.key)}
            style={[
              styles.segment,
              isSelected && [styles.segmentSelected, { backgroundColor: theme.backgroundElement }],
            ]}>
            <ThemedText
              type={isSelected ? 'smallBold' : 'small'}
              themeColor={isSelected ? 'text' : 'textSecondary'}>
              {segment.label}
            </ThemedText>
            {badge > 0 && (
              <View style={[styles.dot, { backgroundColor: theme.primary }]}>
                <ThemedText style={[styles.dotText, { color: theme.onPrimary }]}>
                  {badge > 99 ? '99+' : badge}
                </ThemedText>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  segments: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 3,
  },
  segment: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  segmentSelected: {
    boxShadow: '0 1px 4px rgba(0, 0, 0, 0.06)',
  },
  dot: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: 700,
  },
});
