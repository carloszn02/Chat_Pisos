import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { useTheme } from '@/hooks/use-theme';
import type { Coordinates } from '@/lib/geocoding';
import { buildMapHtml, parseMapMessage } from '@/lib/map';

export type LocationMapProps = {
  center: Coordinates;
  exact: boolean;
  editable?: boolean;
  height?: number;
  onMove?: (coordinates: Coordinates) => void;
};

/** A map with a pin (exact) or a circle (approximate). Phone version; see location-map.web.tsx. */
export function LocationMap({ center, exact, editable = false, height = 220, onMove }: LocationMapProps) {
  const theme = useTheme();
  const html = useMemo(
    () => buildMapHtml({ center, exact, editable, color: theme.primary }),
    [center, exact, editable, theme.primary]
  );

  return (
    <View style={[styles.container, { height, borderColor: theme.border }]}>
      <WebView
        originWhitelist={['*']}
        source={{ html }}
        nestedScrollEnabled
        scrollEnabled={false}
        onMessage={(event) => {
          const message = parseMapMessage(event.nativeEvent.data);
          if (message) onMove?.({ latitude: message.latitude, longitude: message.longitude });
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
