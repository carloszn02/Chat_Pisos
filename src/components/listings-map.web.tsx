import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import type { ListingsMapProps } from '@/components/listings-map';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { DEFAULT_MAP_CENTER, listingPinCss, MAP_STYLE_URL } from '@/lib/map';
import { loadMapLibre, type MapLibreMap, type MapLibreMarker } from '@/lib/maplibre-web';

const STYLE_ID = 'listing-pin-style';

/** Web version of ListingsMap: draws the map straight into the page. */
export function ListingsMap({ pins, selectedId, onSelect, height }: ListingsMapProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const color = theme.primary;
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);

  // Keep the latest callback and selection without rebuilding the map.
  const onSelectRef = useRef(onSelect);
  const selectedRef = useRef(selectedId);
  useEffect(() => {
    onSelectRef.current = onSelect;
    selectedRef.current = selectedId;
  }, [onSelect, selectedId]);

  // The map itself, made once.
  useEffect(() => {
    let cancelled = false;
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = listingPinCss(color);
      document.head.appendChild(style);
    }
    loadMapLibre()
      .then((maplibregl) => {
        if (cancelled || !containerRef.current) return;
        const map = new maplibregl.Map({
          container: containerRef.current,
          style: MAP_STYLE_URL,
          center: [DEFAULT_MAP_CENTER.longitude, DEFAULT_MAP_CENTER.latitude],
          zoom: 11.5,
          attributionControl: { compact: true },
          // Scrolling the page shouldn't zoom the map by accident (Ctrl + scroll zooms).
          cooperativeGestures: true,
        });
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
        map.on('click', () => onSelectRef.current(null));
        // Fold the map credits into the small (i) button so they don't cover the pins.
        map.on('load', () => {
          containerRef.current
            ?.querySelector('.maplibregl-ctrl-attrib')
            ?.classList.remove('maplibregl-compact-show');
        });
        mapRef.current = map;
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [color]);

  // The pins: redrawn when the listings change (e.g. after changing a filter).
  useEffect(() => {
    const map = mapRef.current;
    const maplibregl = window.maplibregl;
    if (!ready || !map || !maplibregl) return;
    const markers: MapLibreMarker[] = [];
    const bounds = new maplibregl.LngLatBounds();
    for (const pin of pins) {
      const element = document.createElement('div');
      element.className = pin.id === selectedRef.current ? 'pin selected' : 'pin';
      element.textContent = pin.label;
      element.dataset.id = pin.id;
      element.addEventListener('click', (event) => {
        event.stopPropagation();
        onSelectRef.current(pin.id);
      });
      markers.push(
        new maplibregl.Marker({ element }).setLngLat([pin.longitude, pin.latitude]).addTo(map)
      );
      bounds.extend([pin.longitude, pin.latitude]);
    }
    if (pins.length > 1) map.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: 0 });
    else if (pins.length === 1) {
      map.jumpTo({ center: [pins[0].longitude, pins[0].latitude], zoom: 14 });
    }
    return () => markers.forEach((marker) => marker.remove());
  }, [pins, ready]);

  // Highlight the chosen pin.
  useEffect(() => {
    const pinElements = containerRef.current?.querySelectorAll<HTMLDivElement>('.pin') ?? [];
    for (const element of pinElements) {
      // Only toggle our class: MapLibre keeps its own classes on the same element.
      element.classList.toggle('selected', element.dataset.id === selectedId);
    }
  }, [selectedId, pins]);

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
