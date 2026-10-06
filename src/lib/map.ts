/**
 * Maps for listings, drawn with the MapLibre library and OpenFreeMap's free map tiles
 * (OpenStreetMap data; no account or key needed; commercial use allowed).
 *
 * MapLibre is loaded from a pinned version on a public CDN, with an integrity hash so
 * the browser refuses the file if it were ever changed. Phones show the map inside a
 * WebView (buildMapHtml); the web version draws it straight into the page.
 */

import type { Coordinates } from '@/lib/geocoding';

export const MAPLIBRE_JS = {
  url: 'https://unpkg.com/maplibre-gl@5.24.0/dist/maplibre-gl.js',
  integrity: 'sha384-5+cfbwT0iiub6VsQAdn6yz16nr6sDiQoHx6tm4O8OVYXHYOxcffFmCJBL0dgdvGp',
};

export const MAPLIBRE_CSS = {
  url: 'https://unpkg.com/maplibre-gl@5.24.0/dist/maplibre-gl.css',
  integrity: 'sha384-uTttxo/aOKbdE5RlD/SPzSDoDmNvGlUYPjONi2MN/b7c9HPSvW07OIuyP7uL6jxK',
};

/** A light, minimal map style that suits the app's cream palette. */
export const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';

/** Radius of the shaded circle shown for approximate locations. */
export const APPROXIMATE_RADIUS_M = 300;

export type MapOptions = {
  center: Coordinates;
  /** Exact: a pin on the spot. Approximate: a shaded circle. */
  exact: boolean;
  editable: boolean;
  color: string;
};

export type MapMessage = { type: 'move'; latitude: number; longitude: number };

/** A circle around a point, as a GeoJSON polygon MapLibre can draw. */
export function circlePolygon({ latitude, longitude }: Coordinates, radiusMeters: number) {
  const points = 64;
  const latDegrees = radiusMeters / 111320;
  const lngDegrees = radiusMeters / (111320 * Math.cos((latitude * Math.PI) / 180));
  const ring: [number, number][] = [];
  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * 2 * Math.PI;
    ring.push([longitude + lngDegrees * Math.cos(angle), latitude + latDegrees * Math.sin(angle)]);
  }
  return {
    type: 'Feature' as const,
    properties: {},
    geometry: { type: 'Polygon' as const, coordinates: [ring] },
  };
}

/** The settings the map code needs, in one plain object (shared by web and phones). */
export function mapConfig({ center, exact, editable, color }: MapOptions) {
  return {
    lat: center.latitude,
    lng: center.longitude,
    showPin: exact || editable,
    editable,
    color,
    style: MAP_STYLE_URL,
    circle: circlePolygon(center, APPROXIMATE_RADIUS_M),
  };
}

/** A full web page with the map, for the phone WebView. */
export function buildMapHtml(options: MapOptions): string {
  const config = JSON.stringify(mapConfig(options));

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<link rel="stylesheet" href="${MAPLIBRE_CSS.url}" integrity="${MAPLIBRE_CSS.integrity}" crossorigin="anonymous">
<style>html, body, #map { margin: 0; height: 100%; } #error { display: none; padding: 16px; font-family: sans-serif; color: #75685F; }</style>
</head>
<body>
<div id="map"></div>
<div id="error">Map unavailable</div>
<script src="${MAPLIBRE_JS.url}" integrity="${MAPLIBRE_JS.integrity}" crossorigin="anonymous"></script>
<script>
  var config = ${config};
  function send(lat, lng) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'move', latitude: lat, longitude: lng }));
  }
  if (!window.maplibregl) {
    document.getElementById('error').style.display = 'block';
  } else {
    var map = new maplibregl.Map({
      container: 'map',
      style: config.style,
      center: [config.lng, config.lat],
      zoom: config.showPin ? 15.5 : 14.5,
      attributionControl: { compact: true }
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    if (config.showPin) {
      var marker = new maplibregl.Marker({ color: config.color, draggable: config.editable })
        .setLngLat([config.lng, config.lat])
        .addTo(map);
      if (config.editable) {
        marker.on('dragend', function () {
          var p = marker.getLngLat();
          send(p.lat, p.lng);
        });
        map.on('click', function (e) {
          marker.setLngLat(e.lngLat);
          send(e.lngLat.lat, e.lngLat.lng);
        });
      }
    } else {
      map.on('load', function () {
        map.addSource('area', { type: 'geojson', data: config.circle });
        map.addLayer({ id: 'area-fill', type: 'fill', source: 'area', paint: { 'fill-color': config.color, 'fill-opacity': 0.2 } });
        map.addLayer({ id: 'area-line', type: 'line', source: 'area', paint: { 'line-color': config.color, 'line-width': 2 } });
      });
    }
  }
</script>
</body>
</html>`;
}

export function parseMapMessage(data: unknown): MapMessage | null {
  if (typeof data !== 'string') return null;
  try {
    const message = JSON.parse(data);
    if (message?.type === 'move' && typeof message.latitude === 'number' && typeof message.longitude === 'number') {
      return message;
    }
  } catch {
    // Not one of our messages.
  }
  return null;
}
