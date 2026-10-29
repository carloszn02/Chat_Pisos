/**
 * Ordering listings. "Recommended" (the default, like most apps) puts the most interesting
 * listings first: recent ones, with photos and details, from people you'd get on with.
 * Promoted (premium) listings will go on top of this once they exist.
 */

import { compareHabits } from '@/lib/compatibility';
import type { PublicProfile } from '@/types/chat';
import type { Listing } from '@/types/listing';
import type { Habits } from '@/types/profile';

export const LISTING_SORTS = [
  'recommended',
  'newest',
  'price_asc',
  'price_desc',
  'available_soon',
] as const;
export type ListingSort = (typeof LISTING_SORTS)[number];

const DAY_MS = 24 * 60 * 60 * 1000;

/** How complete a listing is: photos, description and the optional details. */
function completeness(listing: Listing): number {
  const details = [
    listing.description,
    listing.room_size_m2,
    listing.bedrooms,
    listing.bathrooms,
    listing.flatmates,
    listing.floor,
    listing.furnished,
    listing.bills_included,
    listing.deposit_months,
    listing.registration_allowed,
    listing.pets_allowed,
    listing.latitude,
    listing.gender,
  ].filter((value) => value !== null && value !== undefined).length;
  return (
    Math.min(listing.photo_urls.length, 5) * 4 + // up to 20
    Math.min(details * 1.5, 15) +
    Math.min(listing.features.length, 5) +
    (listing.metro_lines.length > 0 ? 3 : 0)
  );
}

/** A score for "recommended". Higher comes first. */
function recommendedScore(
  listing: Listing,
  now: number,
  me: Habits | null,
  owner: PublicProfile | undefined
): number {
  // Freshness: a new listing is worth 50 points, halving roughly every week.
  const ageDays = Math.max(0, (now - new Date(listing.created_at).getTime()) / DAY_MS);
  const freshness = 50 / (1 + ageDays / 7);

  // Available soon (or already) is more useful than in six months.
  const startsInDays = (new Date(`${listing.available_from}T00:00:00`).getTime() - now) / DAY_MS;
  const soon = startsInDays <= 30 ? 6 : startsInDays <= 90 ? 3 : 0;

  let compatibility = 0;
  if (me && owner) {
    const level = compareHabits(me, owner).level;
    compatibility = level === 'high' ? 15 : level === 'medium' ? 7 : 0;
  }

  // Profiles with a photo get more trust (and replies).
  const ownerPhoto = owner?.avatar_url ? 4 : 0;

  return freshness + completeness(listing) + soon + compatibility + ownerPhoto;
}

export function sortListings(
  listings: Listing[],
  sort: ListingSort,
  context: { me: Habits | null; owners: Map<string, PublicProfile> }
): Listing[] {
  const sorted = [...listings];
  const byNewest = (a: Listing, b: Listing) => b.created_at.localeCompare(a.created_at);
  switch (sort) {
    case 'newest':
      return sorted.sort(byNewest);
    case 'price_asc':
      return sorted.sort((a, b) => a.price_eur - b.price_eur || byNewest(a, b));
    case 'price_desc':
      return sorted.sort((a, b) => b.price_eur - a.price_eur || byNewest(a, b));
    case 'available_soon':
      return sorted.sort(
        (a, b) => a.available_from.localeCompare(b.available_from) || byNewest(a, b)
      );
    case 'recommended': {
      const now = Date.now();
      const scores = new Map(
        sorted.map((listing) => [
          listing.id,
          recommendedScore(listing, now, context.me, context.owners.get(listing.user_id)),
        ])
      );
      return sorted.sort((a, b) => scores.get(b.id)! - scores.get(a.id)! || byNewest(a, b));
    }
  }
}
