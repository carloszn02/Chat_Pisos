import type { Ref } from 'react';
import type { ScrollViewProps } from 'react-native';
import {
  KeyboardAwareScrollView,
  type KeyboardAwareScrollViewRef,
} from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type FormScrollViewProps = ScrollViewProps & {
  ref?: Ref<KeyboardAwareScrollViewRef>;
  /** Full screens (not tabs): leave room for the phone's own bottom bar at the end. */
  bottomInset?: boolean;
};

/**
 * The scrolling area of a screen with a form. When the keyboard opens it scrolls the
 * field being typed in above it, on Android and iPhone alike (Android doesn't move the page
 * by itself). On the web it's a normal scroll view.
 */
export function FormScrollView({
  bottomInset = false,
  contentContainerStyle,
  ...props
}: FormScrollViewProps) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAwareScrollView
      keyboardShouldPersistTaps="handled"
      // A little space between the field and the top of the keyboard.
      bottomOffset={24}
      {...props}
      contentContainerStyle={[
        contentContainerStyle,
        bottomInset && { paddingBottom: insets.bottom },
      ]}
    />
  );
}
