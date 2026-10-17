/** Muted chats (the `chat_mutes` table): they stop counting in the badges. */

import { supabase } from '@/lib/supabase';

export type ChatKind = 'group' | 'private_group' | 'conversation';
export type MuteDuration = '8h' | '1w' | 'always';

export type ChatMute = {
  chat_kind: ChatKind;
  chat_id: string;
  /** An ISO date, or 'infinity' for "until I turn it back on". */
  muted_until: string;
};

export function muteKey(kind: ChatKind, chatId: string): string {
  return `${kind}:${chatId}`;
}

export function isStillMuted(mutedUntil: string): boolean {
  return mutedUntil === 'infinity' || new Date(mutedUntil).getTime() > Date.now();
}

export async function fetchMyMutes(): Promise<ChatMute[]> {
  const { data, error } = await supabase
    .from('chat_mutes')
    .select('chat_kind, chat_id, muted_until');
  if (error) throw error;
  return data as ChatMute[];
}

export async function muteChat(
  userId: string,
  kind: ChatKind,
  chatId: string,
  duration: MuteDuration
): Promise<ChatMute> {
  const mutedUntil =
    duration === 'always'
      ? 'infinity'
      : new Date(Date.now() + (duration === '8h' ? 8 : 24 * 7) * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('chat_mutes')
    .upsert({ user_id: userId, chat_kind: kind, chat_id: chatId, muted_until: mutedUntil })
    .select('chat_kind, chat_id, muted_until')
    .single();
  if (error) throw error;
  return data as ChatMute;
}

export async function unmuteChat(kind: ChatKind, chatId: string): Promise<void> {
  const { error } = await supabase
    .from('chat_mutes')
    .delete()
    .eq('chat_kind', kind)
    .eq('chat_id', chatId);
  if (error) throw error;
}
