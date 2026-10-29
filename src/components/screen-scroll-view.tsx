import { ScrollView, type ScrollViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * The scrolling area of a full screen (not a tab). Adds room at the end for the phone's own
 * bottom bar (Android's back/home buttons, the iPhone's home line), so the last button
 * (e.g. "Guardar") can be scrolled above it instead of staying hidden behind it.
 */
export function ScreenScrollView({ contentContainerStyle, ...props }: ScrollViewProps) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      {...props}
      contentContainerStyle={[contentContainerStyle, { paddingBottom: insets.bottom }]}
    />
  );
}
