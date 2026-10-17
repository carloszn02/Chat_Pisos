/** Favourite listings (the `saved_listings` table). Only you can see what you saved. */

import { supabase } from '@/lib/supabase';

/** IDs of the listings you saved, newest first. */
export async function fetchSavedListingIds(): Promise<string[]> {
  const { data, error } = await supabase
    .from('saved_listings')
    .select('listing_id')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data.map((row) => row.listing_id as string);
}

export async function saveListing(userId: string, listingId: string): Promise<void> {
  const { error } = await supabase
    .from('saved_listings')
    .insert({ user_id: userId, listing_id: listingId });
  // 23505 = already saved; that's fine.
  if (error && error.code !== '23505') throw error;
}

export async function unsaveListing(userId: string, listingId: string): Promise<void> {
  const { error } = await supabase
    .from('saved_listings')
    .delete()
    .eq('user_id', userId)
    .eq('listing_id', listingId);
  if (error) throw error;
}
