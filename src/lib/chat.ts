/** Reading and writing district group chats. */

import type { ChatPhoto } from '@/lib/chat-photos';
import { supabase } from '@/lib/supabase';
import type { ChatGroup, GroupMessage, GroupStats, PublicProfile } from '@/types/chat';

export const MESSAGES_PAGE_SIZE = 50;

const GROUP_MESSAGE_COLUMNS =
  'id, group_id, user_id, body, listing_id, image_path, image_width, image_height, reply_to_id, deleted_at, created_at';

// One string (not joined with +) so the database types can read it.
const PUBLIC_PROFILE_COLUMNS =
  'id, first_name, age, occupation, languages, about, avatar_url, schedule, tidiness, smoking, pets, weekends, work_from_home, cooking, diet, guests, overnight_guests, noise, social, food_sharing, interests';

export async function fetchGroups(): Promise<ChatGroup[]> {
  const { data, error } = await supabase
    .from('chat_groups')
    .select('id, slug, name, short_code, is_city_wide, sort_order, city_id, area_id')
    .order('sort_order');
  if (error) throw error;
  return data;
}

export async function fetchGroupBySlug(slug: string): Promise<ChatGroup | null> {
  const { data, error } = await supabase
    .from('chat_groups')
    .select('id, slug, name, short_code, is_city_wide, sort_order, city_id, area_id')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** How busy each group is (members, messages this week, last message), by group id. */
export async function fetchGroupStats(): Promise<Map<string, GroupStats>> {
  const { data, error } = await supabase.rpc('chat_group_stats');
  if (error) throw error;
  return new Map((data as GroupStats[]).map((row) => [row.group_id, row]));
}

/** For sorting groups busiest first: messages this week, then members. */
export function byActivity(stats: Map<string, GroupStats>) {
  return (a: ChatGroup, b: ChatGroup) => {
    const sa = stats.get(a.id);
    const sb = stats.get(b.id);
    return (
      (sb?.messages_this_week ?? 0) - (sa?.messages_this_week ?? 0) ||
      (sb?.member_count ?? 0) - (sa?.member_count ?? 0) ||
      a.sort_order - b.sort_order
    );
  };
}

/** IDs of the groups the current user has joined. */
export async function fetchMyGroupIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('user_id', userId);
  if (error) throw error;
  return new Set(data.map((row) => row.group_id as string));
}

export type GroupParticipant = {
  user_id: string;
  joined_at: string;
  /** False only for yourself when you chose not to appear. */
  show_in_members: boolean;
};

/** People in a district group who chose to appear (you first), newest first. */
export async function fetchGroupParticipants(groupId: string): Promise<GroupParticipant[]> {
  const { data, error } = await supabase.rpc('group_participants', { target_group: groupId });
  if (error) throw error;
  return data as GroupParticipant[];
}

/** Appear (or not) in a group's list of participants. */
export async function setGroupVisibility(groupId: string, visible: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_group_visibility', {
    target_group: groupId,
    visible,
  });
  if (error) throw error;
}

export async function joinGroup(groupId: string): Promise<void> {
  const { error } = await supabase.from('group_members').insert({ group_id: groupId });
  // 23505 = already a member; that's fine.
  if (error && error.code !== '23505') throw error;
}

export async function leaveGroup(groupId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', userId);
  if (error) throw error;
}

/** Newest messages first. Pass `before` (a created_at) to load older ones. */
export async function fetchMessages(groupId: string, before?: string): Promise<GroupMessage[]> {
  let query = supabase
    .from('group_messages')
    .select(GROUP_MESSAGE_COLUMNS)
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })
    .limit(MESSAGES_PAGE_SIZE);
  if (before) query = query.lt('created_at', before);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export type GroupPreviews = {
  /** Groups the current user has joined. */
  myGroupIds: Set<string>;
  lastMessages: Map<string, GroupMessage>;
  unread: Map<string, number>;
};

type PreviewRow = {
  group_id: string;
  unread_count: number;
  last_message_id: string | null;
  last_message_user_id: string | null;
  last_message_body: string | null;
  last_message_listing_id: string | null;
  last_message_deleted_at: string | null;
  last_message_created_at: string | null;
};

/**
 * Everything the Chats tab list needs about your groups, in one request. Falls back to the
 * older one-request-per-group way if the database function hasn't been added yet.
 */
export async function fetchGroupPreviews(userId: string): Promise<GroupPreviews> {
  const { data, error } = await supabase.rpc('my_group_previews');
  if (error) {
    // PGRST202 = the function doesn't exist yet (its SQL file hasn't been run).
    if (error.code !== 'PGRST202') throw error;
    const [myGroupIds, unread] = await Promise.all([
      fetchMyGroupIds(userId),
      fetchGroupUnreadCounts(),
    ]);
    return { myGroupIds, unread, lastMessages: await fetchLastMessages([...myGroupIds]) };
  }
  const rows = data as PreviewRow[];
  const lastMessages = new Map<string, GroupMessage>();
  for (const row of rows) {
    if (row.last_message_id && row.last_message_user_id && row.last_message_created_at) {
      lastMessages.set(row.group_id, {
        id: row.last_message_id,
        group_id: row.group_id,
        user_id: row.last_message_user_id,
        body: row.last_message_body ?? '',
        listing_id: row.last_message_listing_id,
        deleted_at: row.last_message_deleted_at,
        created_at: row.last_message_created_at,
      });
    }
  }
  return {
    myGroupIds: new Set(rows.map((row) => row.group_id)),
    unread: new Map(rows.map((row) => [row.group_id, row.unread_count ?? 0])),
    lastMessages,
  };
}

/** Specific messages (e.g. older ones quoted by replies). */
export async function fetchGroupMessagesByIds(ids: string[]): Promise<GroupMessage[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from('group_messages')
    .select(GROUP_MESSAGE_COLUMNS)
    .in('id', ids);
  if (error) throw error;
  return data;
}

/** The latest message of each given group, for the previews in the chats list. */
export async function fetchLastMessages(groupIds: string[]): Promise<Map<string, GroupMessage>> {
  const results = await Promise.all(
    groupIds.map((id) =>
      supabase
        .from('group_messages')
        .select('id, group_id, user_id, body, listing_id, deleted_at, created_at')
        .eq('group_id', id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    )
  );
  const map = new Map<string, GroupMessage>();
  for (const { data } of results) {
    if (data) map.set(data.group_id, data);
  }
  return map;
}

export async function sendMessage(
  groupId: string,
  body: string,
  photo?: ChatPhoto,
  replyToId?: string
): Promise<GroupMessage> {
  const { data, error } = await supabase
    .from('group_messages')
    .insert({ group_id: groupId, body: body.trim(), ...photo, reply_to_id: replyToId ?? null })
    .select(GROUP_MESSAGE_COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

// Public profiles are remembered for a few minutes so each author isn't fetched again and
// again. Not longer: when someone changes their photo, the old one is deleted, and keeping
// its address would show an empty photo.
const AUTHOR_CACHE_MS = 3 * 60 * 1000;
const authorCache = new Map<string, PublicProfile>();
const authorFetchedAt = new Map<string, number>();

export async function fetchAuthors(userIds: string[]): Promise<Map<string, PublicProfile>> {
  const now = Date.now();
  const missing = [...new Set(userIds)].filter(
    (id) => !authorCache.has(id) || now - (authorFetchedAt.get(id) ?? 0) > AUTHOR_CACHE_MS
  );
  if (missing.length > 0) {
    const { data, error } = await supabase
      .from('public_profiles')
      .select(PUBLIC_PROFILE_COLUMNS)
      .in('id', missing);
    if (error) throw error;
    for (const profile of data as PublicProfile[]) {
      authorCache.set(profile.id, profile);
      authorFetchedAt.set(profile.id, now);
    }
  }
  return new Map(
    userIds.flatMap((id) => (authorCache.has(id) ? [[id, authorCache.get(id)!]] : []))
  );
}

export async function fetchPublicProfile(userId: string): Promise<PublicProfile | null> {
  const authors = await fetchAuthors([userId]);
  return authors.get(userId) ?? null;
}

/** Forget a cached author, e.g. after the user edits their own profile. */
export function forgetAuthor(userId: string) {
  authorCache.delete(userId);
  authorFetchedAt.delete(userId);
}

/** Unread messages per joined group (messages from blocked users aren't counted). */
export async function fetchGroupUnreadCounts(): Promise<Map<string, number>> {
  const { data, error } = await supabase.rpc('my_group_unread_counts');
  if (error) throw error;
  return new Map(
    (data as { group_id: string; unread_count: number }[]).map((row) => [
      row.group_id,
      row.unread_count,
    ])
  );
}

/** When you last read a group (null if you're not a member). Used for the "new messages" line. */
export async function fetchGroupLastRead(groupId: string, userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('group_members')
    .select('last_read_at')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data?.last_read_at ?? null;
}

/** Marks a group as read for the current user. Failures only affect the counter. */
export async function markGroupRead(groupId: string): Promise<void> {
  const { error } = await supabase.rpc('mark_group_read', { target_group: groupId });
  if (error) console.warn('Could not mark group as read', error.message);
}

/** Deletes one of your own messages. It stays in the chat as "Message deleted". */
export async function deleteMyMessage(
  kind: 'group' | 'direct' | 'private_group',
  messageId: string
): Promise<void> {
  const { error } = await supabase.rpc('delete_my_message', { kind, message: messageId });
  if (error) throw error;
}
