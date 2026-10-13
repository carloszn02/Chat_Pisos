/**
 * The current city and its districts/neighbourhoods, loaded once for the whole app.
 * Today there is only Madrid; when more cities are active, `cities` lists them and a
 * city picker can call `chooseCity`.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

import { useSession } from '@/hooks/use-session';
import { fetchActiveCities, fetchAreas } from '@/lib/places';
import type { Area, City } from '@/types/places';

type PlacesState = {
  cities: City[];
  city: City | null;
  chooseCity: (cityId: string) => void;
  districts: Area[];
  neighbourhoodsOf: (districtId: string) => Area[];
  areaById: (id: string) => Area | undefined;
  /** "Malasaña, Chueca" — neighbourhoods if there are any, otherwise districts. */
  placeLabel: (areaIds: string[]) => string;
};

const PlacesContext = createContext<PlacesState>({
  cities: [],
  city: null,
  chooseCity: () => {},
  districts: [],
  neighbourhoodsOf: () => [],
  areaById: () => undefined,
  placeLabel: () => '',
});

export function PlacesProvider({ children }: PropsWithChildren) {
  const { session } = useSession();
  const loggedIn = !!session;
  const [cities, setCities] = useState<City[]>([]);
  const [chosenCityId, setChosenCityId] = useState<string | null>(null);
  const [areas, setAreas] = useState<Area[]>([]);

  // Places are only readable when logged in.
  useEffect(() => {
    if (!loggedIn) return;
    let cancelled = false;
    fetchActiveCities()
      .then((found) => {
        if (!cancelled) setCities(found);
      })
      .catch((error) => console.warn('Could not load cities', error));
    return () => {
      cancelled = true;
    };
  }, [loggedIn]);

  const city = cities.find((c) => c.id === chosenCityId) ?? cities[0] ?? null;
  const cityId = city?.id;

  useEffect(() => {
    if (!cityId) return;
    let cancelled = false;
    fetchAreas(cityId)
      .then((found) => {
        if (!cancelled) setAreas(found);
      })
      .catch((error) => console.warn('Could not load places', error));
    return () => {
      cancelled = true;
    };
  }, [cityId]);

  const byId = useMemo(() => new Map(areas.map((area) => [area.id, area])), [areas]);
  const districts = useMemo(() => areas.filter((area) => area.kind === 'district'), [areas]);

  const neighbourhoodsOf = useCallback(
    (districtId: string) => areas.filter((area) => area.parent_id === districtId),
    [areas]
  );
  const areaById = useCallback((id: string) => byId.get(id), [byId]);
  const placeLabel = useCallback(
    (areaIds: string[]) => {
      const places = areaIds.map((id) => byId.get(id)).filter((area): area is Area => !!area);
      const neighbourhoods = places.filter((area) => area.kind === 'neighbourhood');
      return (neighbourhoods.length > 0 ? neighbourhoods : places)
        .map((area) => area.name)
        .join(', ');
    },
    [byId]
  );

  const value = useMemo(
    () => ({
      cities,
      city,
      chooseCity: setChosenCityId,
      districts,
      neighbourhoodsOf,
      areaById,
      placeLabel,
    }),
    [cities, city, districts, neighbourhoodsOf, areaById, placeLabel]
  );

  return <PlacesContext.Provider value={value}>{children}</PlacesContext.Provider>;
}

export function usePlaces() {
  return useContext(PlacesContext);
}
