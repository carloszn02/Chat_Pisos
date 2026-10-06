/**
 * Turns an address into map coordinates, using OpenStreetMap's free Nominatim service.
 * Fine for testing and a small launch; before growing we should switch to a paid
 * provider (Nominatim allows about one search per second and no autocomplete).
 */

import { Platform } from 'react-native';

export type Coordinates = { latitude: number; longitude: number };

// Searches are limited to Madrid (west, north, east, south).
const MADRID_BOUNDS = '-3.89,40.56,-3.52,40.31';

/** The centre of Madrid (Puerta del Sol), used when placing a pin by hand. */
export const MADRID_CENTER: Coordinates = { latitude: 40.4168, longitude: -3.7038 };

export async function searchAddress(query: string): Promise<Coordinates | null> {
  const params = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    limit: '1',
    countrycodes: 'es',
    viewbox: MADRID_BOUNDS,
    bounded: '1',
  });
  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    // Browsers send their own identification; phone apps must name themselves.
    headers: Platform.OS === 'web' ? undefined : { 'User-Agent': 'ChatPisos/1.0' },
  });
  if (!response.ok) throw new Error(`Address search failed (${response.status})`);
  const results: { lat: string; lon: string }[] = await response.json();
  if (results.length === 0) return null;
  return { latitude: Number(results[0].lat), longitude: Number(results[0].lon) };
}

/**
 * Moves a point randomly by up to about 200 m, so an approximate location can't be
 * traced back to the exact building.
 */
export function blurLocation({ latitude, longitude }: Coordinates): Coordinates {
  const offset = () => (Math.random() - 0.5) * 2; // between -1 and 1
  return {
    latitude: latitude + offset() * 0.0018, // ~200 m north/south
    longitude: longitude + offset() * 0.0024, // ~200 m east/west at Madrid's latitude
  };
}
