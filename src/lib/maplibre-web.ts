/**
 * Loading MapLibre on the web (the phone versions load it inside a WebView instead).
 * Only imported by *.web.tsx files.
 */

import { MAPLIBRE_CSS, MAPLIBRE_JS } from '@/lib/map';

// The small part of the MapLibre library the app uses.
export type LngLat = { lat: number; lng: number };
export type MapLibreMarker = {
  setLngLat(position: [number, number] | LngLat): MapLibreMarker;
  addTo(map: MapLibreMap): MapLibreMarker;
  getLngLat(): LngLat;
  on(event: 'dragend', handler: () => void): void;
  remove(): void;
};
export type MapLibreMap = {
  addControl(control: unknown, position?: string): void;
  on(event: 'click', handler: (event: { lngLat: LngLat }) => void): void;
  on(event: 'load', handler: () => void): void;
  on(event: 'moveend', handler: (event: { originalEvent?: unknown }) => void): void;
  getBounds(): { getNorth(): number; getSouth(): number; getEast(): number; getWest(): number };
  fitBounds(bounds: unknown, options: Record<string, unknown>): void;
  jumpTo(options: Record<string, unknown>): void;
  addSource(id: string, source: unknown): void;
  addLayer(layer: unknown): void;
  remove(): void;
};
export type MapLibre = {
  Map: new (options: Record<string, unknown>) => MapLibreMap;
  Marker: new (
    options: { color: string; draggable: boolean } | { element: HTMLElement }
  ) => MapLibreMarker;
  LngLatBounds: new () => { extend(point: [number, number]): unknown };
  NavigationControl: new (options: { showCompass: boolean }) => unknown;
};

declare global {
  interface Window {
    maplibregl?: MapLibre;
  }
}

let loading: Promise<MapLibre> | null = null;

/** Adds the MapLibre script and styles to the page once, and waits for them. */
export function loadMapLibre(): Promise<MapLibre> {
  if (window.maplibregl) return Promise.resolve(window.maplibregl);
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = MAPLIBRE_CSS.url;
      css.integrity = MAPLIBRE_CSS.integrity;
      css.crossOrigin = 'anonymous';
      document.head.appendChild(css);

      const script = document.createElement('script');
      script.src = MAPLIBRE_JS.url;
      script.integrity = MAPLIBRE_JS.integrity;
      script.crossOrigin = 'anonymous';
      script.onload = () =>
        window.maplibregl ? resolve(window.maplibregl) : reject(new Error('MapLibre missing'));
      script.onerror = () => {
        loading = null; // allow a retry next time
        reject(new Error('MapLibre failed to load'));
      };
      document.head.appendChild(script);
    });
  }
  return loading;
}
