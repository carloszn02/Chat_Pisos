import Animated, { useAnimatedKeyboard, useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Empty space under a chat's text box that grows with the keyboard, frame by frame, so the
 * box always sits right above the keyboard (on iPhone and Android, including Android's
 * edge-to-edge screens). On the web there's no on-screen keyboard to make room for.
 *
 * Uses Reanimated's keyboard tracking because it works in Expo Go. When the app moves to
 * its own builds (launch steps), switch to react-native-keyboard-controller, which Expo
 * recommends and Reanimated now points to.
 */
export function KeyboardSpacer() {
  const insets = useSafeAreaInsets();
  const keyboard = useAnimatedKeyboard({
    isStatusBarTranslucentAndroid: true,
    isNavigationBarTranslucentAndroid: true,
  });

  // The text box already leaves room for the phone's bottom edge; don't count it twice.
  const style = useAnimatedStyle(() => ({
    height: Math.max(0, keyboard.height.value - insets.bottom),
  }));

  return <Animated.View style={style} />;
}
