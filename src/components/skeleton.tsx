/**
 * Soft grey shapes shown while a screen loads, shaped like what's coming (rows, cards,
 * chat bubbles), so the screen doesn't jump when the real content arrives.
 * They pulse gently, unless the phone asks for reduced motion.
 */

import { useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, type DimensionValue, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Pulses everything inside it together (one animation for the whole group). */
function SkeletonGroup({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) return;
    opacity.value = withRepeat(withTiming(0.45, { duration: 750 }), -1, true);
  }, [opacity, reduceMotion]);

  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={t('common.loading')}
      style={[style, animated]}>
      {children}
    </Animated.View>
  );
}

/** One grey shape. */
function Bone({
  width = '100%',
  height,
  radius = 8,
  style,
}: {
  width?: DimensionValue;
  /** Leave out to size it with style (e.g. aspectRatio). */
  height?: number;
  radius?: number;
  style?: ViewStyle;
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        // The soft beige of the borders: visible on cream and white, never harsh.
        { width, height, borderRadius: radius, backgroundColor: theme.border },
        style,
      ]}
    />
  );
}

/** Rows like the chat lists: a photo (round or square) and two lines of text. */
export function RowsSkeleton({
  count = 5,
  shape = 'circle',
}: {
  count?: number;
  shape?: 'circle' | 'square';
}) {
  return (
    <SkeletonGroup style={styles.list}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={styles.row}>
          <Bone width={48} height={48} radius={shape === 'circle' ? 24 : 14} />
          <View style={styles.rowText}>
            <Bone width={`${45 + ((i * 17) % 30)}%`} height={14} />
            <Bone width={`${65 + ((i * 11) % 25)}%`} height={12} />
          </View>
        </View>
      ))}
    </SkeletonGroup>
  );
}

/** Listing cards: a photo, a label, a title, a price and a line of details. */
export function ListingCardsSkeleton({ count = 3 }: { count?: number }) {
  const theme = useTheme();
  return (
    <SkeletonGroup style={styles.list}>
      {Array.from({ length: count }, (_, i) => (
        <View
          key={i}
          style={[
            styles.card,
            { borderColor: theme.border, backgroundColor: theme.backgroundElement },
          ]}>
          <Bone style={styles.cardPhoto} radius={10} />
          <Bone width={110} height={22} radius={11} />
          <Bone width="80%" height={16} />
          <Bone width={90} height={18} />
          <Bone width="60%" height={12} />
        </View>
      ))}
    </SkeletonGroup>
  );
}

/** District cards in a grid (Explore). */
export function CardGridSkeleton({ count = 4, cardWidth }: { count?: number; cardWidth: number }) {
  const theme = useTheme();
  return (
    <SkeletonGroup style={styles.grid}>
      {Array.from({ length: count }, (_, i) => (
        <View
          key={i}
          style={[
            styles.gridCard,
            {
              width: cardWidth,
              borderColor: theme.border,
              backgroundColor: theme.backgroundElement,
            },
          ]}>
          <Bone height={72} radius={0} />
          <View style={styles.gridBody}>
            <Bone width="70%" height={16} />
            <Bone width="45%" height={12} />
            <Bone height={34} radius={17} style={styles.gridButton} />
          </View>
        </View>
      ))}
    </SkeletonGroup>
  );
}

// Bubble widths, alternating sides, like a real conversation.
const BUBBLES: { mine: boolean; width: DimensionValue; height: number }[] = [
  { mine: false, width: '62%', height: 44 },
  { mine: false, width: '40%', height: 36 },
  { mine: true, width: '55%', height: 44 },
  { mine: false, width: '70%', height: 64 },
  { mine: true, width: '35%', height: 36 },
  { mine: true, width: '58%', height: 44 },
  { mine: false, width: '48%', height: 36 },
];

/** A chat: bubbles on both sides, from the bottom up. */
export function ChatSkeleton() {
  return (
    <SkeletonGroup style={styles.chat}>
      {BUBBLES.map((bubble, i) => (
        <Bone
          key={i}
          width={bubble.width}
          height={bubble.height}
          radius={16}
          style={{ alignSelf: bubble.mine ? 'flex-end' : 'flex-start' }}
        />
      ))}
    </SkeletonGroup>
  );
}

/** A detail page (a listing or a profile): a big block, a title and a few lines. */
export function DetailSkeleton({ photo = true }: { photo?: boolean }) {
  return (
    <SkeletonGroup style={styles.detail}>
      {photo ? (
        <Bone style={styles.detailPhoto} radius={0} />
      ) : (
        <View style={styles.detailHeader}>
          <Bone width={80} height={80} radius={40} />
          <View style={styles.rowText}>
            <Bone width="60%" height={24} />
            <Bone width="40%" height={14} />
          </View>
        </View>
      )}
      <View style={styles.detailBody}>
        {photo && <Bone width={120} height={24} radius={12} />}
        <Bone width="85%" height={24} />
        <Bone width="40%" height={14} />
        <Bone width={140} height={28} />
        <View style={styles.detailLines}>
          <Bone height={12} />
          <Bone height={12} />
          <Bone width="70%" height={12} />
        </View>
      </View>
    </SkeletonGroup>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.one,
  },
  rowText: {
    flex: 1,
    gap: Spacing.two,
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  cardPhoto: {
    aspectRatio: 16 / 9,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  gridCard: {
    borderWidth: 1,
    borderRadius: 18,
    overflow: 'hidden',
  },
  gridBody: {
    padding: Spacing.three,
    gap: Spacing.two,
  },
  gridButton: {
    marginTop: Spacing.one,
  },
  chat: {
    flex: 1,
    alignSelf: 'stretch',
    justifyContent: 'flex-end',
    padding: Spacing.three,
    gap: Spacing.two,
  },
  detail: {
    flex: 1,
    alignSelf: 'stretch',
  },
  detailPhoto: {
    aspectRatio: 3 / 2,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
  },
  detailBody: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  detailLines: {
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
});
