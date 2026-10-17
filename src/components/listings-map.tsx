import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { useTheme } from '@/hooks/use-theme';
import { buildListingsMapHtml, parseListingsMapMessage, type ListingPin } from '@/lib/map';

export type ListingsMapProps = {
  pins: ListingPin[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  height: number;
};

/** Many listings on a map, each as a price label. Phone version; see listings-map.web.tsx. */
export function ListingsMap({ pins, selectedId, onSelect, height }: ListingsMapProps) {
  const theme = useTheme();
  const webViewRef = useRef<WebView>(null);
  const html = useMemo(() => buildListingsMapHtml(pins, theme.primary), [pins, theme.primary]);

  // Highlight the chosen pin without reloading the map.
  useEffect(() => {
    webViewRef.current?.injectJavaScript(
      `window.setSelected && window.setSelected(${JSON.stringify(selectedId)}); true;`
    );
  }, [selectedId]);

  return (
    <View style={[styles.container, { height, borderColor: theme.border }]}>
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html }}
        nestedScrollEnabled
        scrollEnabled={false}
        onMessage={(event) => {
          const message = parseListingsMapMessage(event.nativeEvent.data);
          if (message) onSelect(message.id);
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
