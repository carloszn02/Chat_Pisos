import type { ImagePickerAsset } from 'expo-image-picker';

import { supabase } from '@/lib/supabase';

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
