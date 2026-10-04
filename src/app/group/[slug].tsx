import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import {
  fetchAuthors,
  fetchGroupBySlug,
  fetchMessages,
  fetchMyGroupIds,
  joinGroup,
  leaveGroup,
  MESSAGES_PAGE_SIZE,
  sendMessage,
} from '@/lib/chat';
import { formatMessageTime } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import type { ChatGroup, GroupMessage, PublicProfile } from '@/types/chat';

// Messages from the same person within this time are grouped (name and photo shown once).
const GROUPING_WINDOW_MS = 5 * 60 * 1000;

/** Adds messages that aren't in the list yet, keeping newest first. */
function mergeMessages(current: GroupMessage[], incoming: GroupMessage[]): GroupMessage[] {
  const known = new Set(current.map((m) => m.id));
  const fresh = incoming.filter((m) => !known.has(m.id));
  if (fresh.length === 0) return current;
  return [...current, ...fresh].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export default function GroupChatScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { session } = useSession();
  const userId = session?.user.id;

  const [group, setGroup] = useState<ChatGroup | null>(null);
  const [isMember, setIsMember] = useState(false);
  const [messages, setMessages] = useState<GroupMessage[]>([]); // newest first
  const [authors, setAuthors] = useState<Map<string, PublicProfile>>(new Map());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [hasOlder, setHasOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(false);
  const [joining, setJoining] = useState(false);

  const addAuthors = useCallback(async (newMessages: GroupMessage[]) => {
    try {
      const found = await fetchAuthors(newMessages.map((m) => m.user_id));
      setAuthors((current) => new Map([...current, ...found]));
    } catch {
      // Names are a nice-to-have; messages still show without them.
    }
  }, []);

  // First load: the group, whether we're a member, and the latest messages.
  useEffect(() => {
    if (!slug || !userId) return;
    let cancelled = false;
    (async () => {
      try {
        const found = await fetchGroupBySlug(slug);
        if (!found) throw new Error('Group not found');
        const [myGroupIds, latest] = await Promise.all([
          fetchMyGroupIds(userId),
          fetchMessages(found.id),
        ]);
        if (cancelled) return;
        setGroup(found);
        setIsMember(myGroupIds.has(found.id));
        setMessages((current) => mergeMessages(current, latest));
        setHasOlder(latest.length === MESSAGES_PAGE_SIZE);
        addAuthors(latest);
      } catch {
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, userId, addAuthors]);

  // Live updates: new messages from anyone appear straight away.
  const groupId = group?.id;
  useEffect(() => {
    if (!groupId) return;
    const channel = supabase
      .channel(`group-messages:${groupId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'group_messages', filter: `group_id=eq.${groupId}` },
        (payload) => {
          const message = payload.new as GroupMessage;
          setMessages((current) => mergeMessages(current, [message]));
          addAuthors([message]);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, addAuthors]);

  async function loadOlder() {
    if (!group || !hasOlder || loadingOlder || messages.length === 0) return;
    setLoadingOlder(true);
    try {
      const older = await fetchMessages(group.id, messages[messages.length - 1].created_at);
      setMessages((current) => mergeMessages(current, older));
      setHasOlder(older.length === MESSAGES_PAGE_SIZE);
      addAuthors(older);
    } catch {
      // Scrolling up again will retry.
    } finally {
      setLoadingOlder(false);
    }
  }

  async function send() {
    if (!group || !draft.trim() || sending) return;
    setSending(true);
    setSendError(false);
    try {
      const message = await sendMessage(group.id, draft);
      setMessages((current) => mergeMessages(current, [message]));
      setDraft('');
    } catch {
      setSendError(true);
    } finally {
      setSending(false);
    }
  }

  async function join() {
    if (!group) return;
    setJoining(true);
    try {
      await joinGroup(group.id);
      setIsMember(true);
    } catch {
      setSendError(true);
    } finally {
      setJoining(false);
    }
  }

  async function leave() {
    if (!group || !userId) return;
    try {
      await leaveGroup(group.id, userId);
      setIsMember(false);
      if (router.canGoBack()) router.back();
    } catch {
      setSendError(true);
    }
  }

  function renderMessage({ item, index }: { item: GroupMessage; index: number }) {
    const isMine = item.user_id === userId;
    const time = formatMessageTime(item.created_at, i18n.language);

    if (isMine) {
      return (
        <View style={[styles.bubble, styles.myBubble, { backgroundColor: theme.primary }]}>
          <ThemedText style={[styles.body, { color: theme.onPrimary }]}>{item.body}</ThemedText>
          <ThemedText style={[styles.time, { color: theme.onPrimary, opacity: 0.75 }]}>{time}</ThemedText>
        </View>
      );
    }

    // The list is newest-first, so the message shown just above this one is index + 1.
    const previous = messages[index + 1];
    const continuesPrevious =
      previous?.user_id === item.user_id &&
      new Date(item.created_at).getTime() - new Date(previous.created_at).getTime() < GROUPING_WINDOW_MS;
    const author = authors.get(item.user_id);

    return (
      <View style={styles.theirRow}>
        <View style={styles.avatarSlot}>
          {!continuesPrevious && <Avatar uri={author?.avatar_url ?? null} name={author?.first_name ?? '?'} size={32} />}
        </View>
        <View style={[styles.bubble, styles.theirBubble, { backgroundColor: theme.backgroundElement }]}>
          {!continuesPrevious && (
            <ThemedText type="smallBold" style={{ color: theme.primary }}>
              {author ? `${author.first_name}, ${author.age}` : '…'}
            </ThemedText>
          )}
          <ThemedText style={styles.body}>{item.body}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.time}>
            {time}
          </ThemedText>
        </View>
      </View>
    );
  }

  const header = (
    <Stack.Screen
      options={{
        title: group?.name ?? '',
        headerRight: () =>
          isMember ? (
            <Pressable accessibilityRole="button" onPress={leave} hitSlop={12} style={styles.headerButton}>
              <ThemedText type="small" themeColor="textSecondary">
                {t('chats.leave')}
              </ThemedText>
            </Pressable>
          ) : null,
      }}
    />
  );

  if (loading || loadError || !group) {
    return (
      <ThemedView style={[styles.screen, styles.centered]}>
        {header}
        {loading ? (
          <ActivityIndicator color={theme.primary} />
        ) : (
          <ThemedText themeColor="textSecondary">{t('chats.loadError')}</ThemedText>
        )}
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.screen}>
      {header}
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
        <View style={[styles.safetyBanner, { backgroundColor: theme.backgroundSelected }]}>
          <ThemedText type="small" style={styles.safetyText}>
            {t('chats.safetyTip')}
          </ThemedText>
        </View>

        {messages.length === 0 ? (
          <View style={[styles.screen, styles.centered]}>
            <ThemedText themeColor="textSecondary">{t('chats.emptyChat')}</ThemedText>
          </View>
        ) : (
          <FlatList
            inverted
            data={messages}
            keyExtractor={(m) => m.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.messageList}
            onEndReached={loadOlder}
            onEndReachedThreshold={0.3}
            ListFooterComponent={loadingOlder ? <ActivityIndicator color={theme.primary} /> : null}
          />
        )}

        <View
          style={[
            styles.composer,
            { borderTopColor: theme.border, backgroundColor: theme.backgroundElement, paddingBottom: Math.max(insets.bottom, Spacing.two) },
          ]}>
          {sendError && (
            <ThemedText type="small" style={{ color: theme.danger }} accessibilityLiveRegion="polite">
              {t('chats.sendError')}
            </ThemedText>
          )}
          {isMember ? (
            <View style={styles.composerRow}>
              <TextInput
                style={[styles.input, { borderColor: theme.border, backgroundColor: theme.background, color: theme.text }]}
                value={draft}
                onChangeText={setDraft}
                placeholder={t('chats.messagePlaceholder', { name: group.name })}
                placeholderTextColor={theme.textSecondary}
                multiline
                maxLength={2000}
                accessibilityLabel={t('chats.messagePlaceholder', { name: group.name })}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('chats.send')}
                disabled={sending || !draft.trim()}
                onPress={send}
                style={({ pressed }) => [
                  styles.sendButton,
                  { backgroundColor: theme.primary },
                  (pressed || sending || !draft.trim()) && styles.pressed,
                ]}>
                {sending ? (
                  <ActivityIndicator color={theme.onPrimary} />
                ) : (
                  <ThemedText style={{ color: theme.onPrimary, fontWeight: 700 }}>➤</ThemedText>
                )}
              </Pressable>
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              disabled={joining}
              onPress={join}
              style={({ pressed }) => [
                styles.joinButton,
                { backgroundColor: theme.primary },
                (pressed || joining) && styles.pressed,
              ]}>
              <ThemedText style={{ color: theme.onPrimary, fontWeight: 700 }}>{t('chats.joinToWrite')}</ThemedText>
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  headerButton: {
    paddingHorizontal: Spacing.two,
  },
  safetyBanner: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  safetyText: {
    textAlign: 'center',
  },
  messageList: {
    padding: Spacing.three,
    gap: Spacing.two,
  },
  theirRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
    maxWidth: '85%',
  },
  avatarSlot: {
    width: 32,
  },
  bubble: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 2,
  },
  myBubble: {
    alignSelf: 'flex-end',
    maxWidth: '80%',
    borderRadius: 16,
    borderBottomRightRadius: 4,
  },
  theirBubble: {
    flexShrink: 1,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
  },
  body: {
    fontSize: 15,
    lineHeight: 21,
  },
  time: {
    fontSize: 11,
    lineHeight: 14,
    alignSelf: 'flex-end',
  },
  composer: {
    borderTopWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    gap: Spacing.one,
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 11,
    paddingBottom: 11,
    fontSize: 15,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinButton: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
});
