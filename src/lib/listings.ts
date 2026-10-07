/** Reading, saving and sharing listings. */

import type { ImagePickerAsset } from 'expo-image-picker';

import { fetchGroups, joinGroup } from '@/lib/chat';
import { supabase } from '@/lib/supabase';
import type { ChatGroup } from '@/types/chat';
import type { Listing, ListingType } from '@/types/listing';

const LISTING_COLUMNS =
  'id, user_id, type, district_ids, title, description, price_eur, available_from, min_stay_months, ' +
  'bills_included, furnished, room_size_m2, flatmates, bedrooms, photo_urls, latitude, longitude, ' +
  'location_exact, address, status, created_at';

const PHOTOS_BUCKET = 'listing-photos';
const PUBLIC_PATH_MARKER = `/storage/v1/object/public/${PHOTOS_BUCKET}/`;

export const LISTINGS_PAGE_SIZE = 50;

export type ListingFilters = {
  type: ListingType | null;
  districtId: string | null;
  maxPrice: number | null;
};

/** Everything a listing form saves, except photos. */
export type ListingValues = Omit<Listing, 'id' | 'user_id' | 'photo_urls' | 'status' | 'created_at'>;

let districtCache: ChatGroup[] | null = null;

/** The districts people can choose (every group except the Madrid-wide one). */
export async function fetchDistricts(): Promise<ChatGroup[]> {
  if (!districtCache) {
    districtCache = (await fetchGroups()).filter((group) => !group.is_city_wide);
  }
  return districtCache;
}

export async function fetchListings(filters: ListingFilters): Promise<Listing[]> {
  let query = supabase
    .from('listings')
    .select(LISTING_COLUMNS)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(LISTINGS_PAGE_SIZE);
  if (filters.type) query = query.eq('type', filters.type);
  if (filters.districtId) query = query.contains('district_ids', [filters.districtId]);
  if (filters.maxPrice) query = query.lte('price_eur', filters.maxPrice);
  const { data, error } = await query;
  if (error) throw error;
  return data as unknown as Listing[];
}

export async function fetchListing(id: string): Promise<Listing | null> {
  const { data, error } = await supabase.from('listings').select(LISTING_COLUMNS).eq('id', id).maybeSingle();
  if (error) throw error;
  return data as unknown as Listing | null;
}

export async function fetchMyListings(userId: string): Promise<Listing[]> {
  const { data, error } = await supabase
    .from('listings')
    .select(LISTING_COLUMNS)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as unknown as Listing[];
}

/** Listings shown as cards in a group chat. Closed or hidden ones simply don't come back. */
export async function fetchListingsByIds(ids: string[]): Promise<Map<string, Listing>> {
  if (ids.length === 0) return new Map();
  const { data, error } = await supabase.from('listings').select(LISTING_COLUMNS).in('id', ids);
  if (error) throw error;
  return new Map((data as unknown as Listing[]).map((listing) => [listing.id, listing]));
}

async function uploadPhoto(userId: string, asset: ImagePickerAsset, index: number): Promise<string> {
  const contentType = asset.mimeType ?? 'image/jpeg';
  const extension = contentType.split('/')[1] ?? 'jpg';
  const path = `${userId}/${Date.now()}-${index}.${extension}`;
  const body = await (await fetch(asset.uri)).arrayBuffer();
  const { error } = await supabase.storage.from(PHOTOS_BUCKET).upload(path, body, { contentType });
  if (error) throw error;
  return supabase.storage.from(PHOTOS_BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Removes listing photos from storage (used when editing, deleting or closing an account). */
export async function deleteListingPhotos(urls: string[]): Promise<void> {
  const paths = urls
    .map((url) => {
      const index = url.indexOf(PUBLIC_PATH_MARKER);
      return index === -1 ? null : decodeURIComponent(url.slice(index + PUBLIC_PATH_MARKER.length));
    })
    .filter((path): path is string => !!path);
  if (paths.length === 0) return;
  const { error } = await supabase.storage.from(PHOTOS_BUCKET).remove(paths);
  if (error) console.warn('Could not delete listing photos', error.message);
}

export async function createListing(
  userId: string,
  values: ListingValues,
  newPhotos: ImagePickerAsset[]
): Promise<Listing> {
  const photoUrls = await Promise.all(newPhotos.map((photo, i) => uploadPhoto(userId, photo, i)));
  const { data, error } = await supabase
    .from('listings')
    .insert({ ...values, photo_urls: photoUrls })
    .select(LISTING_COLUMNS)
    .single();
  if (error) {
    await deleteListingPhotos(photoUrls);
    throw error;
  }
  return data as unknown as Listing;
}

export async function updateListing(
  listing: Listing,
  values: ListingValues,
  keptPhotoUrls: string[],
  newPhotos: ImagePickerAsset[]
): Promise<void> {
  const uploaded = await Promise.all(newPhotos.map((photo, i) => uploadPhoto(listing.user_id, photo, i)));
  const { error } = await supabase
    .from('listings')
    .update({ ...values, photo_urls: [...keptPhotoUrls, ...uploaded] })
    .eq('id', listing.id);
  if (error) {
    await deleteListingPhotos(uploaded);
    throw error;
  }
  // Remove photos the user took out, only after the listing no longer points to them.
  await deleteListingPhotos(listing.photo_urls.filter((url) => !keptPhotoUrls.includes(url)));
}

export async function setListingStatus(id: string, status: Listing['status']): Promise<void> {
  const { error } = await supabase.from('listings').update({ status }).eq('id', id);
  if (error) throw error;
}

export async function deleteListing(listing: Listing): Promise<void> {
  const { error } = await supabase.from('listings').delete().eq('id', listing.id);
  if (error) throw error;
  await deleteListingPhotos(listing.photo_urls);
}

/** Posts the listing as a card in each of its district groups (joining them if needed). */
export async function shareListingInGroups(listing: Listing): Promise<void> {
  for (const groupId of listing.district_ids) {
    await joinGroup(groupId);
    const { error } = await supabase
      .from('group_messages')
      .insert({ group_id: groupId, body: listing.title, listing_id: listing.id });
    if (error) throw error;
  }
}
