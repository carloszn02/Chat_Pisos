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

/** Activity numbers for a district group (the chat_group_stats database function). */
export type GroupStats = {
  group_id: string;
  member_count: number;
  messages_this_week: number;
  /** A message in the last 24 hours. */
  active_today: boolean;
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
  /** A photo in the private chat-photos storage (with its size), if the message has one. */
  image_path?: string | null;
  image_width?: number | null;
  image_height?: number | null;
  /** The earlier message this one replies to ("Responder"), if any. */
  reply_to_id?: string | null;
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
  /** When each person last read the conversation (null = never). */
  user_a_last_read_at: string | null;
  user_b_last_read_at: string | null;
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
  /** A photo in the private chat-photos storage (with its size), if the message has one. */
  image_path?: string | null;
  image_width?: number | null;
  image_height?: number | null;
  /** The earlier message this one replies to ("Responder"), if any. */
  reply_to_id?: string | null;
  created_at: string;
};

/** One private group in the Messages tab (the my_private_groups database function). */
export type PrivateGroupSummary = {
  id: string;
  name: string;
  my_status: 'invited' | 'member';
  my_role: 'owner' | 'member';
  invited_by: string | null;
  member_count: number;
  last_message_body: string | null;
  last_message_sender_id: string | null;
  last_message_at: string | null;
  last_message_deleted: boolean;
  last_message_kind: PrivateGroupMessageKind | null;
  last_message_event: PrivateGroupEvent | null;
  last_message_subject_id: string | null;
  unread_count: number;
  /** Join requests (through the invite link) waiting for a member to answer. */
  pending_requests: number;
  invite_link_enabled: boolean;
};

export type PrivateGroup = {
  id: string;
  name: string;
  created_by: string;
  invite_link_enabled: boolean;
};

/** What someone sees when they open a private group's invite link. */
export type PrivateGroupLinkPreview = {
  group_id: string;
  name: string;
  member_ids: string[];
  my_status: 'member' | 'invited' | 'requested' | null;
  is_full: boolean;
};

export type JoinRequest = {
  user_id: string;
  requested_at: string;
};

export type PrivateGroupMember = {
  user_id: string;
  role: 'owner' | 'member';
  status: 'invited' | 'member';
  invited_by: string | null;
};

export type PrivateGroupMessageKind = 'message' | 'event';
/** Notices written by the database when membership changes. */
export type PrivateGroupEvent =
  'created' | 'joined' | 'left' | 'removed' | 'requested' | 'accepted';

export type PrivateGroupMessage = {
  id: string;
  group_id: string;
  sender_id: string;
  body: string;
  kind: PrivateGroupMessageKind;
  event: PrivateGroupEvent | null;
  /** For "removed" / "accepted": the person who was removed or accepted. */
  subject_id: string | null;
  listing_id: string | null;
  deleted_at: string | null;
  /** A photo in the private chat-photos storage (with its size), if the message has one. */
  image_path?: string | null;
  image_width?: number | null;
  image_height?: number | null;
  /** The earlier message this one replies to ("Responder"), if any. */
  reply_to_id?: string | null;
  created_at: string;
};
