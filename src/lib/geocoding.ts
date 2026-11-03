/**
 * Turns an address into map coordinates, using OpenStreetMap's free Nominatim service
 * (the search button), and suggests addresses while typing with Photon (below).
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

export type AddressSuggestion = {
  /** What goes in the address box, e.g. "Calle de Embajadores 12". */
  label: string;
  /** Where it is, e.g. "Lavapiés, Centro". */
  area: string;
  coordinates: Coordinates;
};

type PhotonFeature = {
  geometry: { coordinates: [number, number] };
  properties: {
    name?: string;
    street?: string;
    housenumber?: string;
    locality?: string;
    district?: string;
    city?: string;
  };
};

/**
 * Address suggestions while typing, from Photon (Komoot's free OpenStreetMap search, made
 * for search-as-you-type; Nominatim's rules don't allow it). Madrid first; results that
 * are the same address (e.g. a shop in the building) are shown once.
 */
export async function suggestAddresses(
  query: string,
  signal?: AbortSignal
): Promise<AddressSuggestion[]> {
  const params = new URLSearchParams({
    q: query,
    limit: '8',
    lat: String(MADRID_CENTER.latitude),
    lon: String(MADRID_CENTER.longitude),
    // west, south, east, north
    bbox: '-3.89,40.31,-3.52,40.56',
  });
  for (const layer of ['house', 'street', 'locality', 'district']) params.append('layer', layer);
  const response = await fetch(`https://photon.komoot.io/api/?${params}`, {
    signal,
    headers: Platform.OS === 'web' ? undefined : { 'User-Agent': 'ChatPisos/1.0' },
  });
  if (!response.ok) throw new Error(`Address suggestions failed (${response.status})`);
  const { features }: { features: PhotonFeature[] } = await response.json();
  const seen = new Set<string>();
  const suggestions: AddressSuggestion[] = [];
  for (const { geometry, properties: p } of features) {
    const label = p.street ? [p.street, p.housenumber].filter(Boolean).join(' ') : (p.name ?? '');
    if (!label || seen.has(label)) continue;
    seen.add(label);
    const area = [p.locality, p.district ?? p.city].filter((part) => part && part !== label);
    suggestions.push({
      label,
      area: area.join(', '),
      coordinates: { latitude: geometry.coordinates[1], longitude: geometry.coordinates[0] },
    });
    if (suggestions.length === 5) break;
  }
  return suggestions;
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
