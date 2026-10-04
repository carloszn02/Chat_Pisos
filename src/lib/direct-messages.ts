/** Private 1-to-1 conversations and message requests. */

import { MESSAGES_PAGE_SIZE } from '@/lib/chat';
import { supabase } from '@/lib/supabase';
import type { Conversation, DirectMessage, InboxItem } from '@/types/chat';

const MESSAGE_COLUMNS = 'id, conversation_id, sender_id, body, created_at';

/** Opens (or finds) the conversation with another user and returns its id. */
export async function startConversation(otherUserId: string): Promise<string> {
  const { data, error } = await supabase.rpc('start_conversation', { other_user: otherUserId });
  if (error) throw error;
  return data as string;
}

export async function fetchInbox(): Promise<InboxItem[]> {
  const { data, error } = await supabase.rpc('my_conversations');
  if (error) throw error;
  return data as InboxItem[];
}

export async function fetchConversation(id: string): Promise<Conversation | null> {
  const { data, error } = await supabase
    .from('conversations')
    .select('id, user_a, user_b, created_by, status')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Newest messages first. Pass `before` (a created_at) to load older ones. */
export async function fetchDirectMessages(
  conversationId: string,
  before?: string
): Promise<DirectMessage[]> {
  let query = supabase
    .from('direct_messages')
    .select(MESSAGE_COLUMNS)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(MESSAGES_PAGE_SIZE);
  if (before) query = query.lt('created_at', before);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function sendDirectMessage(conversationId: string, body: string): Promise<DirectMessage> {
  const { data, error } = await supabase
    .from('direct_messages')
    .insert({ conversation_id: conversationId, body: body.trim() })
    .select(MESSAGE_COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

export async function respondToRequest(conversationId: string, accept: boolean): Promise<void> {
  const { error } = await supabase.rpc('respond_to_request', {
    conversation: conversationId,
    accept,
  });
  if (error) throw error;
}

export async function markConversationRead(conversationId: string): Promise<void> {
  const { error } = await supabase.rpc('mark_conversation_read', { conversation: conversationId });
  if (error) console.warn('Could not mark conversation as read', error.message);
}
