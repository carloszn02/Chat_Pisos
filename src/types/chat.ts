import type {
  Occupation,
  Pets,
  Schedule,
  Smoking,
  SpokenLanguage,
  Tidiness,
} from '@/types/profile';

export type ChatGroup = {
  id: string;
  slug: string;
  name: string;
  short_code: string;
  is_city_wide: boolean;
  sort_order: number;
  city_id: string;
  /** The district or neighbourhood this group is about (null for the city-wide group). */
  area_id: string | null;
};

export type GroupMessage = {
  id: string;
  group_id: string;
  user_id: string;
  body: string;
  /** Set when the message is a shared listing (shown as a card). */
  listing_id: string | null;
  /** Set when the author deleted the message (its text is then empty). */
  deleted_at: string | null;
  created_at: string;
};

/** A profile as other users see it (the public_profiles view): age, never date of birth. */
export type PublicProfile = {
  id: string;
  first_name: string;
  age: number;
  occupation: Occupation | null;
  languages: SpokenLanguage[];
  about: string | null;
  avatar_url: string | null;
  schedule: Schedule | null;
  tidiness: Tidiness | null;
  smoking: Smoking | null;
  pets: Pets | null;
};

export type ConversationStatus = 'pending' | 'accepted' | 'declined';

export type Conversation = {
  id: string;
  user_a: string;
  user_b: string;
  created_by: string;
  status: ConversationStatus;
};

/** One row of the inbox (the my_conversations database function). */
export type InboxItem = {
  id: string;
  other_user_id: string;
  status: Exclude<ConversationStatus, 'declined'>;
  is_incoming_request: boolean;
  last_message_body: string | null;
  last_message_sender_id: string | null;
  last_message_at: string | null;
  unread_count: number;
  last_message_deleted: boolean;
};

export type DirectMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  /** Set when the message is about a listing (shown as a card). */
  listing_id: string | null;
  /** Set when the sender deleted the message (its text is then empty). */
  deleted_at: string | null;
  created_at: string;
};
