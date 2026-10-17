import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import type { LocationMapProps } from '@/components/location-map';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { mapConfig } from '@/lib/map';
import { loadMapLibre, type MapLibreMap } from '@/lib/maplibre-web';

/** Web version of LocationMap: draws the map straight into the page. */
export function LocationMap({
  center,
  exact,
  editable = false,
  height = 220,
  onMove,
}: LocationMapProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  // Keep the latest callback without rebuilding the map every time it changes.
  const onMoveRef = useRef(onMove);
  useEffect(() => {
    onMoveRef.current = onMove;
  }, [onMove]);

  const { latitude, longitude } = center;
  const color = theme.primary;

  useEffect(() => {
    let map: MapLibreMap | null = null;
    let cancelled = false;

    loadMapLibre()
      .then((maplibregl) => {
        if (cancelled || !containerRef.current) return;
        const config = mapConfig({ center: { latitude, longitude }, exact, editable, color });
        const send = (lat: number, lng: number) =>
          onMoveRef.current?.({ latitude: lat, longitude: lng });

        map = new maplibregl.Map({
          container: containerRef.current,
          style: config.style,
          center: [config.lng, config.lat],
          zoom: config.showPin ? 15.5 : 14.5,
          attributionControl: { compact: true },
          // Scrolling the page shouldn't zoom the map by accident (Ctrl + scroll zooms).
          cooperativeGestures: true,
        });
        const currentMap = map;
        currentMap.addControl(
          new maplibregl.NavigationControl({ showCompass: false }),
          'top-right'
        );

        if (config.showPin) {
          const marker = new maplibregl.Marker({ color, draggable: editable })
            .setLngLat([config.lng, config.lat])
            .addTo(currentMap);
          if (editable) {
            marker.on('dragend', () => {
              const position = marker.getLngLat();
              send(position.lat, position.lng);
            });
            currentMap.on('click', (event) => {
              marker.setLngLat(event.lngLat);
              send(event.lngLat.lat, event.lngLat.lng);
            });
          }
        } else {
          currentMap.on('load', () => {
            currentMap.addSource('area', { type: 'geojson', data: config.circle });
            currentMap.addLayer({
              id: 'area-fill',
              type: 'fill',
              source: 'area',
              paint: { 'fill-color': color, 'fill-opacity': 0.2 },
            });
            currentMap.addLayer({
              id: 'area-line',
              type: 'line',
              source: 'area',
              paint: { 'line-color': color, 'line-width': 2 },
            });
          });
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [latitude, longitude, exact, editable, color]);

  return (
    <View
      style={[
        styles.container,
        { height, borderColor: theme.border, backgroundColor: theme.backgroundSelected },
      ]}>
      {failed ? (
        <View style={styles.failed}>
          <ThemedText type="small" themeColor="textSecondary">
            {t('listings.mapUnavailable')}
          </ThemedText>
        </View>
      ) : (
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  failed: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.three,
  },
});
