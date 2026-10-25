/** Private group chats between connected people (invitations, members, messages). */

import type { ImagePickerAsset } from 'expo-image-picker';
import type { TFunction } from 'i18next';

import { MESSAGES_PAGE_SIZE } from '@/lib/chat';
import type { ChatPhoto } from '@/lib/chat-photos';
import { fetchInbox } from '@/lib/direct-messages';
import { readFileBytes } from '@/lib/file-bytes';
import { shrinkImage } from '@/lib/images';
import { supabase } from '@/lib/supabase';
import type {
  JoinRequest,
  PrivateGroupEvent,
  PrivateGroup,
  PrivateGroupLinkPreview,
  PrivateGroupMember,
  PrivateGroupMessage,
  PrivateGroupSummary,
} from '@/types/chat';

const MESSAGE_COLUMNS =
  'id, group_id, sender_id, body, kind, event, subject_id, listing_id, image_path, image_width, image_height, reply_to_id, deleted_at, created_at';

/** At most this many people per group, counting pending invitations (the database enforces it). */
export const PRIVATE_GROUP_MAX_PEOPLE = 10;

/**
 * People you can invite: those you have an accepted private conversation with
 * (the database checks this too).
 */
export async function fetchConnections(): Promise<string[]> {
  const inbox = await fetchInbox();
  return inbox.filter((item) => item.status === 'accepted').map((item) => item.other_user_id);
}

export async function fetchMyPrivateGroups(): Promise<PrivateGroupSummary[]> {
  const { data, error } = await supabase.rpc('my_private_groups');
  if (error) throw error;
  return data as PrivateGroupSummary[];
}

export async function createPrivateGroup(name: string, invitees: string[]): Promise<string> {
  const { data, error } = await supabase.rpc('create_private_group', {
    group_name: name.trim(),
    invitees,
  });
  if (error) throw error;
  return data as string;
}

export async function inviteToPrivateGroup(groupId: string, invitees: string[]): Promise<void> {
  const { error } = await supabase.rpc('invite_to_private_group', {
    target_group: groupId,
    invitees,
  });
  if (error) throw error;
}

export async function respondToGroupInvite(groupId: string, accept: boolean): Promise<void> {
  const { error } = await supabase.rpc('respond_to_group_invite', {
    target_group: groupId,
    accept,
  });
  if (error) throw error;
}

export async function leavePrivateGroup(groupId: string): Promise<void> {
  const { error } = await supabase.rpc('leave_private_group', { target_group: groupId });
  if (error) throw error;
}

export async function removeFromPrivateGroup(groupId: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc('remove_from_private_group', {
    target_group: groupId,
    target_user: userId,
  });
  if (error) throw error;
}

export async function markPrivateGroupRead(groupId: string): Promise<void> {
  const { error } = await supabase.rpc('mark_private_group_read', { target_group: groupId });
  if (error) console.warn('Could not mark group as read', error.message);
}

export async function fetchPrivateGroup(groupId: string): Promise<PrivateGroup | null> {
  const { data, error } = await supabase
    .from('private_groups')
    .select('id, name, created_by, invite_link_enabled, photo_url')
    .eq('id', groupId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

const GROUP_PHOTOS_BUCKET = 'group-photos';
const GROUP_PHOTO_PATH_MARKER = `/storage/v1/object/public/${GROUP_PHOTOS_BUCKET}/`;

/**
 * Changes the group photo (any member can), or removes it with null.
 * The chat shows "Ana changed the group photo". The old file is deleted afterwards.
 */
export async function changePrivateGroupPhoto(
  group: PrivateGroup,
  asset: ImagePickerAsset | null
): Promise<void> {
  let url: string | null = null;
  if (asset) {
    const image = await shrinkImage(asset, 800);
    const extension = image.mimeType.split('/')[1] ?? 'jpg';
    // A new name each time, so nobody sees an old cached photo.
    const path = `${group.id}/photo-${Date.now()}.${extension}`;
    const body = await readFileBytes(image.uri);
    const { error: uploadError } = await supabase.storage
      .from(GROUP_PHOTOS_BUCKET)
      .upload(path, body, { contentType: image.mimeType });
    if (uploadError) throw uploadError;
    url = supabase.storage.from(GROUP_PHOTOS_BUCKET).getPublicUrl(path).data.publicUrl;
  }
  const { error } = await supabase.rpc('set_private_group_photo', {
    target_group: group.id,
    new_photo_url: url,
  });
  if (error) throw error;
  const index = group.photo_url?.indexOf(GROUP_PHOTO_PATH_MARKER) ?? -1;
  if (group.photo_url && index !== -1) {
    const oldPath = decodeURIComponent(
      group.photo_url.slice(index + GROUP_PHOTO_PATH_MARKER.length)
    );
    const { error: removeError } = await supabase.storage
      .from(GROUP_PHOTOS_BUCKET)
      .remove([oldPath]);
    if (removeError) console.warn('Could not delete the old group photo', removeError.message);
  }
}

/** When you last read a private group. Used for the "new messages" line. */
export async function fetchPrivateGroupLastRead(
  groupId: string,
  userId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('private_group_members')
    .select('last_read_at')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data?.last_read_at ?? null;
}

export async function fetchPrivateGroupMembers(groupId: string): Promise<PrivateGroupMember[]> {
  const { data, error } = await supabase
    .from('private_group_members')
    .select('user_id, role, status, invited_by')
    .eq('group_id', groupId)
    .in('status', ['member', 'invited'])
    .order('created_at');
  if (error) throw error;
  return data as PrivateGroupMember[];
}

/** Newest messages first. Pass `before` (a created_at) to load older ones. */
export async function fetchPrivateGroupMessages(
  groupId: string,
  before?: string
): Promise<PrivateGroupMessage[]> {
  let query = supabase
    .from('private_group_messages')
    .select(MESSAGE_COLUMNS)
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })
    .limit(MESSAGES_PAGE_SIZE);
  if (before) query = query.lt('created_at', before);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

/** Specific messages (e.g. older ones quoted by replies). */
export async function fetchPrivateGroupMessagesByIds(
  ids: string[]
): Promise<PrivateGroupMessage[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from('private_group_messages')
    .select(MESSAGE_COLUMNS)
    .in('id', ids);
  if (error) throw error;
  return data;
}

export async function sendPrivateGroupMessage(
  groupId: string,
  body: string,
  photo?: ChatPhoto,
  replyToId?: string
): Promise<PrivateGroupMessage> {
  const { data, error } = await supabase
    .from('private_group_messages')
    .insert({ group_id: groupId, body: body.trim(), ...photo, reply_to_id: replyToId ?? null })
    .select(MESSAGE_COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

/** The group's invite link (made on the spot if needed). Members only. */
export async function getPrivateGroupLink(groupId: string): Promise<string> {
  const { data, error } = await supabase
    .rpc('get_private_group_link', { target_group: groupId })
    .single();
  if (error) throw error;
  return (data as { token: string }).token;
}

/** The owner turns the link on or off (turning it off makes the old link stop working). */
export async function setPrivateGroupLink(groupId: string, enabled: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_private_group_link', {
    target_group: groupId,
    enabled,
  });
  if (error) throw error;
}

/** What a link shows before joining; null if it's wrong, expired or turned off. */
export async function fetchLinkPreview(token: string): Promise<PrivateGroupLinkPreview | null> {
  const { data, error } = await supabase
    .rpc('private_group_link_preview', { link_token: token })
    .maybeSingle();
  if (error) throw error;
  return data as PrivateGroupLinkPreview | null;
}

/** Ask to join through a link. Returns your status in the group afterwards. */
export async function requestToJoin(token: string): Promise<'requested' | 'invited' | 'member'> {
  const { data, error } = await supabase.rpc('request_to_join_private_group', {
    link_token: token,
  });
  if (error) throw error;
  return data as 'requested' | 'invited' | 'member';
}

export async function fetchJoinRequests(groupId: string): Promise<JoinRequest[]> {
  const { data, error } = await supabase.rpc('private_group_join_requests', {
    target_group: groupId,
  });
  if (error) throw error;
  return data as JoinRequest[];
}

export async function respondToJoinRequest(
  groupId: string,
  userId: string,
  accept: boolean
): Promise<void> {
  const { error } = await supabase.rpc('respond_to_join_request', {
    target_group: groupId,
    target_user: userId,
    accept,
  });
  if (error) throw error;
}

/** The database's reason when an invitation is refused, for a clear message on screen. */
export function inviteErrorKey(error: unknown): 'notConnected' | 'groupFull' | 'generic' {
  const message = (error as { message?: string })?.message ?? '';
  if (message.includes('not_connected')) return 'notConnected';
  if (message.includes('group_full')) return 'groupFull';
  return 'generic';
}

/**
 * The text of a notice, e.g. "Bea joined the group". `name` gives a person's first name,
 * and the translation keys live under privateGroups.events.
 */
export function eventText(
  t: TFunction,
  event: PrivateGroupEvent,
  actorId: string,
  subjectId: string | null,
  myUserId: string,
  name: (userId: string | null) => string
): string {
  const byMe = actorId === myUserId;
  switch (event) {
    case 'created':
      return byMe
        ? t('privateGroups.events.createdByMe')
        : t('privateGroups.events.created', { name: name(actorId) });
    case 'joined':
      return byMe
        ? t('privateGroups.events.joinedMe')
        : t('privateGroups.events.joined', { name: name(actorId) });
    case 'left':
      return t('privateGroups.events.left', { name: name(actorId) });
    case 'removed':
      return byMe
        ? t('privateGroups.events.removedByMe', { name: name(subjectId) })
        : t('privateGroups.events.removed', { name: name(actorId), removed: name(subjectId) });
    case 'requested':
      return t('privateGroups.events.requested', { name: name(actorId) });
    case 'photo':
      return byMe
        ? t('privateGroups.events.photoByMe')
        : t('privateGroups.events.photo', { name: name(actorId) });
    case 'accepted':
      if (subjectId === myUserId) {
        return t('privateGroups.events.acceptedMe', { name: name(actorId) });
      }
      return byMe
        ? t('privateGroups.events.acceptedByMe', { name: name(subjectId) })
        : t('privateGroups.events.accepted', { name: name(actorId), accepted: name(subjectId) });
  }
}
