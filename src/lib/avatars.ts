import type { ImagePickerAsset } from 'expo-image-picker';

import { supabase } from '@/lib/supabase';

const PUBLIC_PATH_MARKER = '/storage/v1/object/public/avatars/';

/** Uploads a profile photo to the user's own folder and returns its public URL. */
export async function uploadAvatar(userId: string, asset: ImagePickerAsset): Promise<string> {
  const contentType = asset.mimeType ?? 'image/jpeg';
  const extension = contentType.split('/')[1] ?? 'jpg';
  // A new file name each time, so phones and browsers never show an old cached photo.
  const path = `${userId}/avatar-${Date.now()}.${extension}`;

  const body = await (await fetch(asset.uri)).arrayBuffer();
  const { error } = await supabase.storage.from('avatars').upload(path, body, { contentType });
  if (error) throw error;

  return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
}

/** Deletes a previously uploaded photo. Failures are ignored: it only wastes a little space. */
export async function deleteAvatar(publicUrl: string): Promise<void> {
  const index = publicUrl.indexOf(PUBLIC_PATH_MARKER);
  if (index === -1) return;
  const path = decodeURIComponent(publicUrl.slice(index + PUBLIC_PATH_MARKER.length));
  const { error } = await supabase.storage.from('avatars').remove([path]);
  if (error) console.warn('Could not delete old avatar', error.message);
}
