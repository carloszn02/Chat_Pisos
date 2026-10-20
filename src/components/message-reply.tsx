/**
 * Replies ("Responder"): the small quote of the original message shown inside a reply, and
 * the "Replying to Ana" bar above the text box while writing one.
 */

import type { TFunction } from 'i18next';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Quotable = {
  id: string;
  body: string;
  deleted_at: string | null;
  image_path?: string | null;
  listing_id?: string | null;
};

/** The words shown for a quoted message: its text, "📷 Photo", "Listing" or "Message deleted". */
export function quoteText(t: TFunction, message: Quotable | undefined): string {
  if (!message) return t('chats.replyUnavailable');
  if (message.deleted_at) return t('chats.messageDeleted');
  if (message.body) return message.body;
  if (message.image_path) return t('chats.photoPreview');
  if (message.listing_id) return t('chats.listingPreview');
  return '';
}

/** The quote at the top of a reply bubble. Tapping it jumps to the original message. */
export function QuotedMessage({
  name,
  text,
  mine,
  onPress,
}: {
  name: string;
  text: string;
  /** Inside your own (coloured) bubble. */
  mine: boolean;
  onPress?: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const textColor = mine ? theme.onPrimary : theme.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('chats.replyingToLabel', { name, text })}
      onPress={onPress}
      disabled={!onPress}
      style={[
        styles.quote,
        {
          backgroundColor: mine ? 'rgba(255, 255, 255, 0.18)' : theme.backgroundSelected,
          borderLeftColor: mine ? theme.onPrimary : theme.primary,
        },
      ]}>
      <ThemedText type="smallBold" style={{ color: mine ? theme.onPrimary : theme.primary }}>
        {name}
      </ThemedText>
      <ThemedText type="small" numberOfLines={2} style={{ color: textColor, opacity: 0.85 }}>
        {text}
      </ThemedText>
    </Pressable>
  );
}

/** "Replying to Ana: …" above the text box, with ✕ to cancel. */
export function ReplyBar({
  name,
  text,
  onCancel,
}: {
  name: string;
  text: string;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <View style={[styles.bar, { borderLeftColor: theme.primary }]}>
      <View style={styles.barText}>
        <ThemedText type="smallBold" style={{ color: theme.primary }}>
          {t('chats.replyingTo', { name })}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {text}
        </ThemedText>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('chats.cancelReply')}
        onPress={onCancel}
        hitSlop={10}>
        <Icon name="close" size={18} color={theme.textSecondary} />
      </Pressable>
    </View>
  );
}

/**
 * The messages quoted by replies. Most are already in the chat; older ones (not loaded yet)
 * are fetched with `fetchByIds`. Returns a lookup by message id.
 */
export function useQuotedMessages<T extends { id: string; reply_to_id?: string | null }>(
  messages: T[],
  fetchByIds: (ids: string[]) => Promise<T[]>
): (id: string) => T | undefined {
  const [fetched, setFetched] = useState<Map<string, T>>(new Map());
  const loaded = new Map(messages.map((m) => [m.id, m]));
  const missing = [
    ...new Set(
      messages.flatMap((m) => (m.reply_to_id && !loaded.has(m.reply_to_id) ? [m.reply_to_id] : []))
    ),
  ].filter((id) => !fetched.has(id));
  // A stable key, so the effect only runs when new quotes need fetching.
  const key = missing.sort().join('|');

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    fetchByIds(key.split('|'))
      .then((found) => {
        if (!cancelled)
          setFetched((current) => new Map([...current, ...found.map((m) => [m.id, m] as const)]));
      })
      .catch(() => {
        // The quote then shows "Message not available".
      });
    return () => {
      cancelled = true;
    };
  }, [key, fetchByIds]);

  return (id: string) => loaded.get(id) ?? fetched.get(id);
}

const styles = StyleSheet.create({
  quote: {
    borderLeftWidth: 3,
    borderRadius: 8,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    marginBottom: Spacing.one,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderLeftWidth: 3,
    paddingLeft: Spacing.two,
  },
  barText: {
    flex: 1,
    minWidth: 0,
  },
});
