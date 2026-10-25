/** Listings, as stored in the `listings` table. Must match the migration's checks. */

export const LISTING_TYPES = ['offering_room', 'seeking_room', 'whole_flat'] as const;
export type ListingType = (typeof LISTING_TYPES)[number];

export const MAX_SEEKING_DISTRICTS = 3;
export const MAX_LISTING_PHOTOS = 10;

/** Rooms: who the room is for. People looking: who is looking. */
export const LISTING_GENDERS = ['any', 'female', 'male'] as const;
export type ListingGender = (typeof LISTING_GENDERS)[number];

/** Things a room has (rooms only). */
export const ROOM_FEATURES = [
  'private_bathroom',
  'double_bed',
  'desk',
  'wardrobe',
  'exterior',
  'balcony',
] as const;
/** Things a flat has. Whole flats also get "exterior" and "balcony". */
export const FLAT_FEATURES = [
  'lift',
  'air_conditioning',
  'heating',
  'washing_machine',
  'dishwasher',
  'terrace',
  'wifi',
  'cleaning',
] as const;
/** Must match the list in the database. */
export type ListingFeature = (typeof ROOM_FEATURES)[number] | (typeof FLAT_FEATURES)[number];

export const IDEAL_OCCUPATIONS = ['students', 'workers'] as const;
export type IdealOccupation = (typeof IDEAL_OCCUPATIONS)[number];

/** Madrid metro and Metro Ligero lines with their official colours. Must match the database. */
export const METRO_LINES = {
  L1: { background: '#2EA3DC', text: '#FFFFFF' },
  L2: { background: '#E0292F', text: '#FFFFFF' },
  L3: { background: '#FFD400', text: '#1F1A17' },
  L4: { background: '#956B2E', text: '#FFFFFF' },
  L5: { background: '#8EBF2B', text: '#1F1A17' },
  L6: { background: '#9FA4A6', text: '#1F1A17' },
  L7: { background: '#F7A239', text: '#1F1A17' },
  L8: { background: '#E768AD', text: '#FFFFFF' },
  L9: { background: '#9B3B97', text: '#FFFFFF' },
  L10: { background: '#1C4C9C', text: '#FFFFFF' },
  L11: { background: '#00A04A', text: '#FFFFFF' },
  L12: { background: '#A39A00', text: '#FFFFFF' },
  R: { background: '#FFFFFF', text: '#1C4C9C' },
  ML1: { background: '#5EA9DD', text: '#FFFFFF' },
  ML2: { background: '#5EA9DD', text: '#FFFFFF' },
  ML3: { background: '#5EA9DD', text: '#FFFFFF' },
} as const;
export type MetroLine = keyof typeof METRO_LINES;
export const MAX_METRO_LINES = 6;

export type Listing = {
  id: string;
  user_id: string;
  type: ListingType;
  city_id: string;
  /** Districts and neighbourhoods (rows of `areas`). A neighbourhood's district is always included. */
  area_ids: string[];
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
  bathrooms: number | null;
  gender: ListingGender | null;
  /** 0 = ground floor. */
  floor: number | null;
  deposit_months: number | null;
  /** Roughly how much the bills are per month when they're not included. */
  bills_estimate_eur: number | null;
  features: ListingFeature[];
  /** Empadronamiento: being able to register at the address. */
  registration_allowed: boolean | null;
  pets_allowed: boolean | null;
  smoking_allowed: boolean | null;
  couples_allowed: boolean | null;
  /** Ideal flatmate (rooms only). */
  age_min: number | null;
  age_max: number | null;
  ideal_occupation: IdealOccupation | null;
  metro_lines: MetroLine[];
  metro_station: string | null;
  /** Buses, Cercanías… as free text. */
  transport_notes: string | null;
  /** The owner added contact details (read them with fetchListingContact). */
  has_contact: boolean;
  photo_urls: string[];
  /** Map position. When location_exact is false it was moved ~200 m on purpose (privacy). */
  latitude: number | null;
  longitude: number | null;
  location_exact: boolean;
  /** Street address, only kept when location_exact is true. */
  address: string | null;
  status: 'active' | 'closed';
  /** After this moment the listing is hidden from others until renewed. */
  expires_at: string;
  created_at: string;
};

/** Optional ways to reach the owner outside the app. Only fetched when someone asks for them. */
export type ListingContact = {
  /** Username without @. */
  instagram: string | null;
  /** A full https://…linkedin.com/… link. */
  linkedin: string | null;
  /** International format, e.g. +34612345678. */
  phone: string | null;
  phone_whatsapp: boolean;
  other_link: string | null;
};

/** Colors of the small type label, matching the approved design. */
export const LISTING_TYPE_COLORS: Record<ListingType, { background: string; text: string }> = {
  offering_room: { background: '#FBE9DC', text: '#8A3D10' },
  seeking_room: { background: '#E3ECFB', text: '#1E4FB8' },
  whole_flat: { background: '#DFF0E8', text: '#185C45' },
};
