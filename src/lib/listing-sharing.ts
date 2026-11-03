/**
 * Sending a listing into the app's chats, and "Ask with my flatmates": a private group about
 * a listing, with the publisher invited (they accept or decline, like any invitation).
 */

import { fetchAuthors, fetchGroups, fetchMyGroupIds } from '@/lib/chat';
import { fetchInbox } from '@/lib/direct-messages';
import { fetchMyPrivateGroups } from '@/lib/private-groups';
import { supabase } from '@/lib/supabase';
import type { ChatGroup, PrivateGroupSummary, PublicProfile } from '@/types/chat';
import type { Listing } from '@/types/listing';

/** Where a listing can be sent: one of your chats. */
export type ShareTarget =
  | { kind: 'private_group'; id: string; group: PrivateGroupSummary }
  | { kind: 'conversation'; id: string; person: PublicProfile | undefined; personId: string }
  | { kind: 'group'; id: string; group: ChatGroup };

/** Your chats, newest activity first: private groups, private chats, then district groups. */
export async function fetchShareTargets(userId: string): Promise<ShareTarget[]> {
  const [privateGroups, inbox, groups, myGroupIds] = await Promise.all([
    fetchMyPrivateGroups(),
    fetchInbox(),
    fetchGroups(),
    fetchMyGroupIds(userId),
  ]);
  const accepted = inbox.filter((item) => item.status === 'accepted');
  const people = await fetchAuthors(accepted.map((item) => item.other_user_id));
  return [
    ...privateGroups
      .filter((group) => group.my_status === 'member')
      .map((group): ShareTarget => ({ kind: 'private_group', id: group.id, group })),
    ...accepted.map((item): ShareTarget => ({
      kind: 'conversation',
      id: item.id,
      personId: item.other_user_id,
      person: people.get(item.other_user_id),
    })),
    ...groups
      .filter((group) => myGroupIds.has(group.id))
      .map((group): ShareTarget => ({ kind: 'group', id: group.id, group })),
  ];
}

/** Sends the listing as a card. The text is its title (what chat previews show). */
export async function sendListingTo(target: ShareTarget, listing: Listing): Promise<void> {
  const body = listing.title.trim();
  const { error } =
    target.kind === 'private_group'
      ? await supabase
          .from('private_group_messages')
          .insert({ group_id: target.id, body, listing_id: listing.id })
      : target.kind === 'conversation'
        ? await supabase
            .from('direct_messages')
            .insert({ conversation_id: target.id, body, listing_id: listing.id })
        : await supabase
            .from('group_messages')
            .insert({ group_id: target.id, body, listing_id: listing.id });
  if (error) throw error;
}

/** At most this many flatmates (you and the publisher make 10, the group limit). */
export const MAX_FLATMATES = 8;

/**
 * People you can bring along: those you have an accepted private chat with, and those in
 * your private groups (the database checks this too).
 */
export async function fetchFlatmateCandidates(userId: string): Promise<PublicProfile[]> {
  const [inbox, privateGroups] = await Promise.all([fetchInbox(), fetchMyPrivateGroups()]);
  const memberGroupIds = privateGroups.filter((g) => g.my_status === 'member').map((g) => g.id);
  let groupMates: string[] = [];
  if (memberGroupIds.length > 0) {
    const { data, error } = await supabase
      .from('private_group_members')
      .select('user_id')
      .in('group_id', memberGroupIds)
      .eq('status', 'member');
    if (error) throw error;
    groupMates = data.map((row) => row.user_id as string);
  }
  const ids = [
    ...new Set([
      ...inbox.filter((item) => item.status === 'accepted').map((item) => item.other_user_id),
      ...groupMates,
    ]),
  ].filter((id) => id !== userId);
  const people = await fetchAuthors(ids);
  return ids
    .map((id) => people.get(id))
    .filter((person): person is PublicProfile => !!person)
    .sort((a, b) => a.first_name.localeCompare(b.first_name));
}

export type AskErrorKey =
  | 'listingUnavailable'
  | 'publisherDeclined'
  | 'notConnected'
  | 'groupFull'
  | 'rateLimit'
  | 'generic';

/** What went wrong, from the database's answer. */
export function askErrorKey(error: unknown): AskErrorKey {
  const message = error instanceof Error ? error.message : String(error ?? '');
  if (message.includes('listing_unavailable') || message.includes('own_listing'))
    return 'listingUnavailable';
  if (message.includes('publisher_declined')) return 'publisherDeclined';
  if (message.includes('not_connected')) return 'notConnected';
  if (message.includes('group_full')) return 'groupFull';
  if (message.includes('rate_limit')) return 'rateLimit';
  return 'generic';
}

/**
 * Creates the group about the listing (or opens the one you already have) and invites your
 * flatmates and the publisher. Returns the group's id.
 */
export async function askAboutListing(listingId: string, flatmates: string[]): Promise<string> {
  const { data, error } = await supabase.rpc('ask_about_listing', {
    target_listing: listingId,
    flatmates,
  });
  if (error) throw new Error(error.message);
  return data as string;
}
