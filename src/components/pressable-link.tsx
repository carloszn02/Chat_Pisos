import { Link, type Href } from 'expo-router';
import { useState, type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

type PressableLinkProps = Omit<PressableProps, 'style' | 'children'> & {
  href: Href;
  style?: StyleProp<ViewStyle>;
  /** How it looks while being pressed (slightly faded by default). */
  pressedStyle?: ViewStyle;
  children: ReactNode;
};

const PRESSED: ViewStyle = { opacity: 0.7 };

/**
 * Something tappable that opens a screen: a row, a card or a button. On the web it's a real
 * link (it can be opened in a new tab).
 *
 * Use this instead of <Link asChild><Pressable style={...}>: there, Expo Router only keeps a
 * single plain style object on the web, so list styles and "pressed" styles were silently
 * dropped (rows lost their layout). Here the style is flattened and the pressed look is
 * tracked separately.
 */
export function PressableLink({
  href,
  style,
  pressedStyle = PRESSED,
  children,
  ...rest
}: PressableLinkProps) {
  const [pressed, setPressed] = useState(false);
  return (
    <Link href={href} asChild>
      <Pressable
        accessibilityRole="link"
        {...rest}
        onPressIn={(event) => {
          setPressed(true);
          rest.onPressIn?.(event);
        }}
        onPressOut={(event) => {
          setPressed(false);
          rest.onPressOut?.(event);
        }}
        style={StyleSheet.flatten([style, pressed && pressedStyle])}>
        {children}
      </Pressable>
    </Link>
  );
}
