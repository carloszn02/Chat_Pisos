/**
 * Photos in chats. They live in the private "chat-photos" storage bucket, in the sender's
 * folder for that chat:  <user id>/<chat kind>/<chat id>/<file>.jpg
 * To show one, the app asks for a short-lived link (the database checks you're allowed).
 */

import * as ImagePicker from 'expo-image-picker';

import { readFileBytes } from '@/lib/file-bytes';
import { shrinkImage } from '@/lib/images';
import { supabase } from '@/lib/supabase';

const BUCKET = 'chat-photos';
/** Longest side after shrinking: sharp on phones, ~200–400 KB. */
const PHOTO_MAX_SIDE = 1600;
/** How long a photo link works. Links are re-made a little before they run out. */
const LINK_SECONDS = 60 * 60;

export type ChatKind = 'group' | 'conversation' | 'private_group';

export type ChatPhoto = {
  image_path: string;
  image_width: number;
  image_height: number;
};

/** Lets the user choose one photo. Returns null if they cancel. */
export async function pickChatPhoto(): Promise<ImagePicker.ImagePickerAsset | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.8,
  });
  return result.canceled ? null : (result.assets[0] ?? null);
}

/** Shrinks and uploads a photo for a chat, and returns what the message needs to store. */
export async function uploadChatPhoto(
  userId: string,
  kind: ChatKind,
  chatId: string,
  asset: ImagePicker.ImagePickerAsset
): Promise<ChatPhoto> {
  const image = await shrinkImage(asset, PHOTO_MAX_SIDE);
  const extension = image.mimeType.split('/')[1] ?? 'jpg';
  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension}`;
  const path = `${userId}/${kind}/${chatId}/${name}`;
  const body = await readFileBytes(image.uri);
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, body, { contentType: image.mimeType });
  if (error) throw error;
  return {
    image_path: path,
    image_width: Math.round(image.width),
    image_height: Math.round(image.height),
  };
}

/** Deletes photo files. Failures are ignored: it only wastes a little space. */
export async function deleteChatPhotos(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const { error } = await supabase.storage.from(BUCKET).remove(paths);
  if (error) console.warn('Could not delete chat photos', error.message);
}

// Links already made, so scrolling back and forth doesn't ask again.
const linkCache = new Map<string, { url: string; expiresAt: number }>();

/** Short-lived links for the given photos (only those you're allowed to see come back). */
export async function fetchChatPhotoUrls(paths: string[]): Promise<Map<string, string>> {
  const now = Date.now();
  const missing = [...new Set(paths)].filter((path) => {
    const cached = linkCache.get(path);
    // Re-make links with less than 5 minutes left.
    return !cached || cached.expiresAt - now < 5 * 60 * 1000;
  });
  if (missing.length > 0) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrls(missing, LINK_SECONDS);
    if (error) throw error;
    for (const item of data) {
      if (item.path && item.signedUrl) {
        linkCache.set(item.path, { url: item.signedUrl, expiresAt: now + LINK_SECONDS * 1000 });
      }
    }
  }
  return new Map(
    paths.flatMap((path) => {
      const cached = linkCache.get(path);
      return cached ? [[path, cached.url] as const] : [];
    })
  );
}

/** Your own photo files in all chats (used before deleting your account). */
export async function fetchMyChatPhotoPaths(userId: string): Promise<string[]> {
  const [group, direct, privateGroup] = await Promise.all([
    supabase
      .from('group_messages')
      .select('image_path')
      .eq('user_id', userId)
      .not('image_path', 'is', null),
    supabase
      .from('direct_messages')
      .select('image_path')
      .eq('sender_id', userId)
      .not('image_path', 'is', null),
    supabase
      .from('private_group_messages')
      .select('image_path')
      .eq('sender_id', userId)
      .not('image_path', 'is', null),
  ]);
  return [group, direct, privateGroup].flatMap(({ data }) =>
    (data ?? []).flatMap((row) => (row.image_path ? [row.image_path as string] : []))
  );
}
