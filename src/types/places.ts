/** Countries → cities → districts → neighbourhoods (the `countries`, `cities` and `areas` tables). */

export type City = {
  id: string;
  country_id: string;
  slug: string;
  name: string;
  photo_credit: string | null;
};

export type Area = {
  id: string;
  city_id: string;
  /** The district a neighbourhood belongs to; null for districts. */
  parent_id: string | null;
  kind: 'district' | 'neighbourhood';
  slug: string;
  /** The name people use, e.g. "Malasaña". */
  name: string;
  /** The official name, e.g. "Universidad". Often the same as `name`. */
  official_name: string;
  sort_order: number;
};
