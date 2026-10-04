import type { Occupation, SpokenLanguage } from '@/types/profile';

export type ChatGroup = {
  id: string;
  slug: string;
  name: string;
  short_code: string;
  is_city_wide: boolean;
  sort_order: number;
};

export type GroupMessage = {
  id: string;
  group_id: string;
  user_id: string;
  body: string;
  created_at: string;
};

/** A profile as other users see it (the public_profiles view). */
export type PublicProfile = {
  id: string;
  first_name: string;
  age: number;
  occupation: Occupation | null;
  languages: SpokenLanguage[];
  avatar_url: string | null;
};
