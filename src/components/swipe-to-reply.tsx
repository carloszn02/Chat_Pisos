import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Icon } from '@/components/icon';
import { useTheme } from '@/hooks/use-theme';

/** How far to drag before letting go replies (and how far the bubble can travel). */
const TRIGGER = 64;
const MAX = 96;

/**
 * A chat message you can drag to the right to reply to it, like WhatsApp. A reply arrow
 * appears behind the bubble as it moves. Vertical scrolling and long press still work.
 */
export function SwipeToReply({
  onReply,
  enabled = true,
  children,
}: {
  onReply: () => void;
  enabled?: boolean;
  children: ReactNode;
}) {
  const theme = useTheme();
  const offset = useSharedValue(0);

  const pan = Gesture.Pan()
    .enabled(enabled)
    // Only a clear drag to the right starts it; anything vertical is a scroll.
    .activeOffsetX([-1000, 16])
    .failOffsetY([-12, 12])
    .onUpdate((event) => {
      offset.value = Math.max(0, Math.min(event.translationX, MAX));
    })
    .onEnd(() => {
      if (offset.value >= TRIGGER) scheduleOnRN(onReply);
      offset.value = withSpring(0, { damping: 18, stiffness: 220 });
    });

  const bubbleStyle = useAnimatedStyle(() => ({ transform: [{ translateX: offset.value }] }));
  const arrowStyle = useAnimatedStyle(() => {
    const progress = Math.min(offset.value / TRIGGER, 1);
    return { opacity: progress, transform: [{ scale: 0.6 + progress * 0.4 }] };
  });

  return (
    <GestureDetector gesture={pan}>
      <View>
        <Animated.View style={[styles.arrow, arrowStyle]} pointerEvents="none">
          <View style={[styles.arrowCircle, { backgroundColor: theme.backgroundSelected }]}>
            <Icon name="reply" size={18} color={theme.text} strokeWidth={2} />
          </View>
        </Animated.View>
        <Animated.View style={bubbleStyle}>{children}</Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  arrow: {
    position: 'absolute',
    left: 4,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  arrowCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
