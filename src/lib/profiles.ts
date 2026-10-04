/**
 * Saving profiles. Both functions return null on success, or the key of the
 * error message to show (see profileSetup.errors in the translation files).
 */

import type { ImagePickerAsset } from 'expo-image-picker';

import type es from '@/i18n/locales/es';
import { deleteAvatar, uploadAvatar } from '@/lib/avatars';
import { supabase } from '@/lib/supabase';
import type { Occupation, Pets, Profile, Schedule, Smoking, SpokenLanguage, Tidiness } from '@/types/profile';

export type ProfileErrorKey = keyof typeof es.profileSetup.errors;

export type ProfileFormValues = {
  /** A newly picked photo, or null to keep the current one. */
  photo: ImagePickerAsset | null;
  firstName: string;
  /** Only set when creating a profile; it can't be changed afterwards. */
  birthDate: Date | null;
  occupation: Occupation | null;
  languages: SpokenLanguage[];
  about: string;
  schedule: Schedule | null;
  tidiness: Tidiness | null;
  smoking: Smoking | null;
  pets: Pets | null;
};

function editableFields(values: ProfileFormValues) {
  return {
    first_name: values.firstName.trim(),
    occupation: values.occupation,
    languages: values.languages,
    about: values.about.trim() || null,
    schedule: values.schedule,
    tidiness: values.tidiness,
    smoking: values.smoking,
    pets: values.pets,
  };
}

export async function createProfile(
  userId: string,
  values: ProfileFormValues
): Promise<ProfileErrorKey | null> {
  if (!values.birthDate) return 'invalidDate';

  let avatarUrl: string | null = null;
  if (values.photo) {
    try {
      avatarUrl = await uploadAvatar(userId, values.photo);
    } catch {
      return 'photoUpload';
    }
  }

  const { error } = await supabase.from('profiles').insert({
    id: userId,
    birth_date: values.birthDate.toISOString().slice(0, 10),
    avatar_url: avatarUrl,
    ...editableFields(values),
  });
  // 23505 = a profile already exists (e.g. saved twice); treat it as done.
  if (error && error.code !== '23505') return 'generic';
  return null;
}

export async function updateProfile(
  profile: Profile,
  values: ProfileFormValues
): Promise<ProfileErrorKey | null> {
  let avatarUrl = profile.avatar_url;
  if (values.photo) {
    try {
      avatarUrl = await uploadAvatar(profile.id, values.photo);
    } catch {
      return 'photoUpload';
    }
  }

  const { error } = await supabase
    .from('profiles')
    .update({ avatar_url: avatarUrl, ...editableFields(values) })
    .eq('id', profile.id);
  if (error) return 'generic';

  // Remove the replaced photo only after the profile points to the new one.
  if (values.photo && profile.avatar_url) {
    await deleteAvatar(profile.avatar_url);
  }
  return null;
}
