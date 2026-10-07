/** Reading and writing district group chats. */

import { supabase } from '@/lib/supabase';
import type { ChatGroup, GroupMessage, PublicProfile } from '@/types/chat';

export const MESSAGES_PAGE_SIZE = 50;

const PUBLIC_PROFILE_COLUMNS =
  'id, first_name, age, occupation, languages, about, avatar_url, schedule, tidiness, smoking, pets';

export async function fetchGroups(): Promise<ChatGroup[]> {
  const { data, error } = await supabase
    .from('chat_groups')
    .select('id, slug, name, short_code, is_city_wide, sort_order')
    .order('sort_order');
  if (error) throw error;
  return data;
}

export async function fetchGroupBySlug(slug: string): Promise<ChatGroup | null> {
  const { data, error } = await supabase
    .from('chat_groups')
    .select('id, slug, name, short_code, is_city_wide, sort_order')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  return data;
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
    .select('id, group_id, user_id, body, listing_id, created_at')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })
    .limit(MESSAGES_PAGE_SIZE);
  if (before) query = query.lt('created_at', before);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

/** The latest message of each given group, for the previews in the chats list. */
export async function fetchLastMessages(groupIds: string[]): Promise<Map<string, GroupMessage>> {
  const results = await Promise.all(
    groupIds.map((id) =>
      supabase
        .from('group_messages')
        .select('id, group_id, user_id, body, listing_id, created_at')
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

export async function sendMessage(groupId: string, body: string): Promise<GroupMessage> {
  const { data, error } = await supabase
    .from('group_messages')
    .insert({ group_id: groupId, body: body.trim() })
    .select('id, group_id, user_id, body, listing_id, created_at')
    .single();
  if (error) throw error;
  return data;
}

// Public profiles are cached for the whole session so each author is only fetched once.
const authorCache = new Map<string, PublicProfile>();

export async function fetchAuthors(userIds: string[]): Promise<Map<string, PublicProfile>> {
  const missing = [...new Set(userIds)].filter((id) => !authorCache.has(id));
  if (missing.length > 0) {
    const { data, error } = await supabase
      .from('public_profiles')
      .select(PUBLIC_PROFILE_COLUMNS)
      .in('id', missing);
    if (error) throw error;
    for (const profile of data as PublicProfile[]) authorCache.set(profile.id, profile);
  }
  return new Map(userIds.flatMap((id) => (authorCache.has(id) ? [[id, authorCache.get(id)!]] : [])));
}

export async function fetchPublicProfile(userId: string): Promise<PublicProfile | null> {
  const authors = await fetchAuthors([userId]);
  return authors.get(userId) ?? null;
}

/** Forget a cached author, e.g. after the user edits their own profile. */
export function forgetAuthor(userId: string) {
  authorCache.delete(userId);
}

/** Unread messages per joined group (messages from blocked users aren't counted). */
export async function fetchGroupUnreadCounts(): Promise<Map<string, number>> {
  const { data, error } = await supabase.rpc('my_group_unread_counts');
  if (error) throw error;
  return new Map((data as { group_id: string; unread_count: number }[]).map((row) => [row.group_id, row.unread_count]));
}

/** Marks a group as read for the current user. Failures only affect the counter. */
export async function markGroupRead(groupId: string): Promise<void> {
  const { error } = await supabase.rpc('mark_group_read', { target_group: groupId });
  if (error) console.warn('Could not mark group as read', error.message);
}
