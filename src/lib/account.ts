/** Permanently deleting the current user's account. */

import { deleteAvatar } from '@/lib/avatars';
import { deleteListingPhotos, fetchMyListings } from '@/lib/listings';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types/profile';

/**
 * Deletes the user's photos, then their account and everything linked to it
 * (profile, messages, conversations, listings, blocks, reports), then logs out.
 */
export async function deleteMyAccount(profile: Profile): Promise<void> {
  // Photos first: once the account is gone, the user no longer has permission to remove them.
  const listings = await fetchMyListings(profile.id);
  await deleteListingPhotos(listings.flatMap((listing) => listing.photo_urls));
  if (profile.avatar_url) await deleteAvatar(profile.avatar_url);

  const { error } = await supabase.rpc('delete_my_account');
  if (error) throw error;

  // The account no longer exists, so only the session on this device needs clearing.
  await supabase.auth.signOut({ scope: 'local' });
}
