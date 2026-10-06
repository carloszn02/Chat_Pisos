/** Listings, as stored in the `listings` table. Must match the migration's checks. */

export const LISTING_TYPES = ['offering_room', 'seeking_room', 'whole_flat'] as const;
export type ListingType = (typeof LISTING_TYPES)[number];

export const MAX_SEEKING_DISTRICTS = 3;
export const MAX_LISTING_PHOTOS = 10;

export type Listing = {
  id: string;
  user_id: string;
  type: ListingType;
  district_ids: string[];
  title: string;
  description: string | null;
  price_eur: number;
  available_from: string; // YYYY-MM-DD
  min_stay_months: number | null;
  bills_included: boolean | null;
  furnished: boolean | null;
  room_size_m2: number | null;
  flatmates: number | null;
  bedrooms: number | null;
  photo_urls: string[];
  /** Map position. When location_exact is false it was moved ~200 m on purpose (privacy). */
  latitude: number | null;
  longitude: number | null;
  location_exact: boolean;
  /** Street address, only kept when location_exact is true. */
  address: string | null;
  status: 'active' | 'closed';
  created_at: string;
};

/** Colors of the small type label, matching the approved design. */
export const LISTING_TYPE_COLORS: Record<ListingType, { background: string; text: string }> = {
  offering_room: { background: '#FBE9DC', text: '#8A3D10' },
  seeking_room: { background: '#E3ECFB', text: '#1E4FB8' },
  whole_flat: { background: '#DFF0E8', text: '#185C45' },
};
