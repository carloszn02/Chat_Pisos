import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';

import { useTheme } from '@/hooks/use-theme';
import {
  buildListingsMapHtml,
  parseListingsMapMessage,
  type ListingPin,
  type MapBounds,
} from '@/lib/map';

export type ListingsMapProps = {
  pins: ListingPin[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Called when the person moves or zooms the map, with what's now visible. */
  onMove: (bounds: MapBounds) => void;
  /** Zoom to show all the pins when they change (off while searching a chosen area). */
  fitToPins: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Many listings on a map, each as a price label. Phone version; see listings-map.web.tsx. */
export function ListingsMap({
  pins,
  selectedId,
  onSelect,
  onMove,
  fitToPins,
  style,
}: ListingsMapProps) {
  const theme = useTheme();
  const webViewRef = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  // The page is made once; pins and the selection are sent to it afterwards.
  const html = useMemo(() => buildListingsMapHtml(theme.primary), [theme.primary]);

  useEffect(() => {
    if (!ready) return;
    webViewRef.current?.injectJavaScript(
      `window.setPins && window.setPins(${JSON.stringify(pins)}, ${fitToPins}); true;`
    );
    // Only when the pins change: re-fitting when just the setting changes would jump.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pins, ready]);

  useEffect(() => {
    if (!ready) return;
    webViewRef.current?.injectJavaScript(
      `window.setSelected && window.setSelected(${JSON.stringify(selectedId)}); true;`
    );
  }, [selectedId, ready]);

  return (
    <View style={[styles.container, { borderColor: theme.border }, style]}>
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html }}
        scrollEnabled={false}
        onMessage={(event) => {
          const message = parseListingsMapMessage(event.nativeEvent.data);
          if (!message) return;
          if (message.type === 'ready') setReady(true);
          else if (message.type === 'select') onSelect(message.id);
          else onMove(message);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
});
