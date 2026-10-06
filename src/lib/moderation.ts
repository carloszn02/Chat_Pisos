/** Blocking and reporting users. */

import { supabase } from '@/lib/supabase';

export const REPORT_REASONS = [
  'scam',
  'harassment',
  'spam',
  'inappropriate',
  'fake_profile',
  'other',
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

export type ReportInput = {
  reportedUserId: string;
  reason: ReportReason;
  details: string;
  groupMessageId?: string;
  directMessageId?: string;
  listingId?: string;
  messageSnapshot?: string;
};

export async function fetchBlockedIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('blocks')
    .select('blocked_id')
    .eq('blocker_id', userId);
  if (error) throw error;
  return new Set(data.map((row) => row.blocked_id as string));
}

export async function blockUser(blockedId: string): Promise<void> {
  const { error } = await supabase.from('blocks').insert({ blocked_id: blockedId });
  // 23505 = already blocked.
  if (error && error.code !== '23505') throw error;
}

export async function unblockUser(blockerId: string, blockedId: string): Promise<void> {
  const { error } = await supabase
    .from('blocks')
    .delete()
    .eq('blocker_id', blockerId)
    .eq('blocked_id', blockedId);
  if (error) throw error;
}

export async function submitReport(input: ReportInput): Promise<void> {
  const { error } = await supabase.from('reports').insert({
    reported_user_id: input.reportedUserId,
    reason: input.reason,
    details: input.details.trim() || null,
    group_message_id: input.groupMessageId ?? null,
    direct_message_id: input.directMessageId ?? null,
    listing_id: input.listingId ?? null,
    message_snapshot: input.messageSnapshot ?? null,
  });
  if (error) throw error;
}
