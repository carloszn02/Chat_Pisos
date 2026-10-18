import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChatSkeleton } from '@/components/skeleton';
import { ActionSheet } from '@/components/action-sheet';
import { Avatar } from '@/components/avatar';
import { ChatDividers, findFirstUnread, useJumpToUnread } from '@/components/chat-dividers';
import { ChatComposer } from '@/components/chat-composer';
import { ChatHeaderTitle } from '@/components/chat-header-title';
import { ChatPhoto, PhotoViewer } from '@/components/chat-photo';
import { ListingCard } from '@/components/listing-card';
import { QuotedMessage, quoteText, useQuotedMessages } from '@/components/message-reply';
import { MuteSheet, useMuteLabel } from '@/components/mute-sheet';
import { KeyboardSpacer } from '@/components/keyboard-spacer';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useBlocks } from '@/hooks/use-blocks';
import { useChatPhotoUrls } from '@/hooks/use-chat-photo-urls';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { deleteMyMessage, fetchPublicProfile, MESSAGES_PAGE_SIZE } from '@/lib/chat';
import {
  fetchConversation,
  fetchDirectMessagesByIds,
  fetchDirectMessages,
  markConversationRead,
  respondToRequest,
  sendDirectMessage,
} from '@/lib/direct-messages';
import { deleteChatPhotos, pickChatPhoto, uploadChatPhoto } from '@/lib/chat-photos';
import { isRateLimitError } from '@/lib/errors';
import { formatMessageTime } from '@/lib/format';
import { fetchListingsByIds } from '@/lib/listings';
import { supabase } from '@/lib/supabase';
import type { ImagePickerAsset } from 'expo-image-picker';

import type { Conversation, DirectMessage, PublicProfile } from '@/types/chat';
import type { Listing } from '@/types/listing';

/** Adds messages that aren't in the list yet, keeping newest first. */
function mergeMessages(current: DirectMessage[], incoming: DirectMessage[]): DirectMessage[] {
  const known = new Set(current.map((m) => m.id));
  const fresh = incoming.filter((m) => !known.has(m.id));
  if (fresh.length === 0) return current;
  return [...current, ...fresh].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/** Swaps in a newer version of a message (e.g. after it was deleted). */
function replaceMessage(current: DirectMessage[], updated: DirectMessage): DirectMessage[] {
  return current.map((m) => (m.id === updated.id ? updated : m));
}

export default function ConversationScreen() {
  // listingId is set when the chat was opened from a listing's "Message" button.
  const { id, listingId } = useLocalSearchParams<{ id: string; listingId?: string }>();
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { session } = useSession();
  const userId = session?.user.id;
  const { blockedIds, block, unblock } = useBlocks();

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [otherUser, setOtherUser] = useState<PublicProfile | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]); // newest first
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [hasOlder, setHasOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [actionError, setActionError] = useState(false);
  const [responding, setResponding] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // A photo chosen to send (shown above the text box), and a photo opened full screen.
  const [photo, setPhoto] = useState<ImagePickerAsset | null>(null);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const { urls: photoUrls, failed: failedPhotos } = useChatPhotoUrls(messages);
  // Replies: the message being answered, the menu for your own messages, and the original
  // briefly highlighted after tapping a quote.
  const [replyTo, setReplyTo] = useState<DirectMessage | null>(null);
  const [mineMenu, setMineMenu] = useState<DirectMessage | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const quoted = useQuotedMessages(messages, fetchDirectMessagesByIds);
  // The first message you hadn't read when you opened the chat ("3 new messages" goes above it).
  const [firstUnread, setFirstUnread] = useState<{ id: string; count: number } | null>(null);
  const listRef = useRef<FlatList<DirectMessage>>(null);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [muteOpen, setMuteOpen] = useState(false);
  const muteLabel = useMuteLabel('conversation', id);
  const [selected, setSelected] = useState<DirectMessage | null>(null);
  const [toDelete, setToDelete] = useState<DirectMessage | null>(null);
  const [rateLimited, setRateLimited] = useState(false);
  const [listings, setListings] = useState<Map<string, Listing>>(new Map());
  // The listing to attach to the next message ("Talking about…"), until it's sent or removed.
  const [attachedListingId, setAttachedListingId] = useState<string | null>(listingId ?? null);

  // Loads the listings shown as cards in this conversation.
  const addListings = useCallback(async (ids: (string | null)[]) => {
    const wanted = ids.filter((value): value is string => !!value);
    if (wanted.length === 0) return;
    try {
      const found = await fetchListingsByIds(wanted);
      setListings((current) => new Map([...current, ...found]));
    } catch {
      // Cards are a nice-to-have; the text still shows without them.
    }
  }, []);

  // First load: the conversation, the other person and the latest messages.
  useEffect(() => {
    if (!id || !userId) return;
    let cancelled = false;
    (async () => {
      try {
        const found = await fetchConversation(id);
        if (!found) throw new Error('Conversation not found');
        const otherId = found.user_a === userId ? found.user_b : found.user_a;
        const [profile, latest] = await Promise.all([
          fetchPublicProfile(otherId),
          fetchDirectMessages(id),
        ]);
        if (cancelled) return;
        setConversation(found);
        setOtherUser(profile);
        setMessages((current) => mergeMessages(current, latest));
        setHasOlder(latest.length === MESSAGES_PAGE_SIZE);
        addListings([...latest.map((m) => m.listing_id), listingId ?? null]);
        const lastReadAt =
          found.user_a === userId ? found.user_a_last_read_at : found.user_b_last_read_at;
        setFirstUnread(
          findFirstUnread(latest, lastReadAt, (m) => m.sender_id !== userId && !m.deleted_at)
        );
        markConversationRead(id);
      } catch {
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, userId, listingId, addListings]);

  const reloadConversation = useCallback(async () => {
    if (!id) return;
    try {
      const found = await fetchConversation(id);
      if (found) setConversation(found);
    } catch {
      // Keep showing what we have.
    }
  }, [id]);

  // Live updates: new messages and the request being accepted.
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`conversation:${id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
          filter: `conversation_id=eq.${id}`,
        },
        (payload) => {
          const message = payload.new as DirectMessage;
          setMessages((current) => mergeMessages(current, [message]));
          addListings([message.listing_id]);
          markConversationRead(id);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'direct_messages',
          filter: `conversation_id=eq.${id}`,
        },
        (payload) => setMessages((current) => replaceMessage(current, payload.new as DirectMessage))
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'conversations', filter: `id=eq.${id}` },
        () => reloadConversation()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, reloadConversation, addListings]);

  async function loadOlder() {
    if (!id || !hasOlder || loadingOlder || messages.length === 0) return;
    setLoadingOlder(true);
    try {
      const older = await fetchDirectMessages(id, messages[messages.length - 1].created_at);
      setMessages((current) => mergeMessages(current, older));
      setHasOlder(older.length === MESSAGES_PAGE_SIZE);
    } catch {
      // Scrolling up again will retry.
    } finally {
      setLoadingOlder(false);
    }
  }

  async function choosePhoto() {
    const picked = await pickChatPhoto();
    if (picked) setPhoto(picked);
  }

  async function send() {
    if (!id || !userId || (!draft.trim() && !photo) || sending) return;
    setSending(true);
    setActionError(false);
    setRateLimited(false);
    try {
      const uploaded = photo ? await uploadChatPhoto(userId, 'conversation', id, photo) : undefined;
      const message = await sendDirectMessage(
        id,
        draft,
        attachedListingId ?? undefined,
        uploaded,
        replyTo?.id
      );
      setMessages((current) => mergeMessages(current, [message]));
      setDraft('');
      setAttachedListingId(null);
      setPhoto(null);
      setReplyTo(null);
    } catch (error) {
      if (isRateLimitError(error)) setRateLimited(true);
      else setActionError(true);
    } finally {
      setSending(false);
    }
  }

  async function respond(accept: boolean) {
    if (!id) return;
    setResponding(true);
    setActionError(false);
    try {
      await respondToRequest(id, accept);
      await reloadConversation();
    } catch {
      setActionError(true);
    } finally {
      setResponding(false);
    }
  }

  const firstUnreadIndex = firstUnread ? messages.findIndex((m) => m.id === firstUnread.id) : -1;
  const onScrollToIndexFailed = useJumpToUnread(listRef, firstUnreadIndex);

  const header = (
    <Stack.Screen
      options={{
        title: otherUser ? `${otherUser.first_name}, ${otherUser.age}` : '',
        // Tapping the photo and name opens their profile (like WhatsApp).
        headerTitle: () =>
          otherUser ? (
            <ChatHeaderTitle
              title={`${otherUser.first_name}, ${otherUser.age}`}
              subtitle={t('chats.seeProfile')}
              picture={<Avatar uri={otherUser.avatar_url} name={otherUser.first_name} size={34} />}
              onPress={openProfile}
            />
          ) : null,
        headerRight: () =>
          otherUser ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('messages.options')}
              onPress={() => setMenuOpen(true)}
              hitSlop={8}
              style={styles.headerButton}>
              <ThemedText style={styles.menuDots}>⋯</ThemedText>
            </Pressable>
          ) : null,
      }}
    />
  );

  if (loading || loadError || !conversation) {
    return (
      <ThemedView style={[styles.screen, styles.centered]}>
        {header}
        {loading ? (
          <ChatSkeleton />
        ) : (
          <ThemedText themeColor="textSecondary">{t('messages.loadError')}</ThemedText>
        )}
      </ThemedView>
    );
  }

  const startedByMe = conversation.created_by === userId;
  const isIncomingRequest = conversation.status === 'pending' && !startedByMe;
  // A declined request still looks pending to the sender (they aren't told).
  const isWaitingForAnswer = conversation.status !== 'accepted' && startedByMe;
  const name = otherUser?.first_name ?? '';
  const otherId = conversation.user_a === userId ? conversation.user_b : conversation.user_a;
  const iBlockedThem = blockedIds.has(otherId);

  function openProfile() {
    router.push({ pathname: '/user/[id]', params: { id: otherId } });
  }

  function authorName(senderId: string): string {
    return senderId === userId ? t('chats.you') : (otherUser?.first_name ?? '…');
  }

  /** Scrolls to the quoted message and highlights it for a moment. */
  function jumpTo(messageId: string) {
    const index = messages.findIndex((m) => m.id === messageId);
    if (index === -1) return;
    listRef.current?.scrollToIndex({ index, viewPosition: 0.5, animated: true });
    setHighlightId(messageId);
    setTimeout(() => setHighlightId((current) => (current === messageId ? null : current)), 1600);
  }

  function report(message?: DirectMessage) {
    router.push({
      pathname: '/report',
      params: {
        userId: otherId,
        name,
        ...(message
          ? {
              directMessageId: message.id,
              snapshot: message.body.slice(0, 500),
              imagePath: message.image_path ?? undefined,
            }
          : {}),
      },
    });
  }

  async function deleteMessage(message: DirectMessage) {
    try {
      if (message.image_path) await deleteChatPhotos([message.image_path]);
      await deleteMyMessage('direct', message.id);
      setMessages((current) =>
        replaceMessage(current, {
          ...message,
          body: '',
          listing_id: null,
          image_path: null,
          deleted_at: new Date().toISOString(),
        })
      );
    } catch {
      setActionError(true);
    }
  }

  async function toggleBlock() {
    setActionError(false);
    try {
      if (iBlockedThem) await unblock(otherId);
      else await block(otherId);
    } catch {
      setActionError(true);
    }
  }

  // Each message, with the day and "new messages" dividers above it when needed.
  function renderMessage({ item, index }: { item: DirectMessage; index: number }) {
    return (
      <ChatDividers
        createdAt={item.created_at}
        olderCreatedAt={messages[index + 1]?.created_at}
        newCount={item.id === firstUnread?.id ? firstUnread.count : undefined}>
        {renderBubble(item)}
      </ChatDividers>
    );
  }

  function renderBubble(item: DirectMessage) {
    const isMine = item.sender_id === userId;
    const listing = item.listing_id ? listings.get(item.listing_id) : undefined;
    const textColor = isMine ? theme.onPrimary : theme.text;
    return (
      <Pressable
        onLongPress={
          item.deleted_at ? undefined : () => (isMine ? setMineMenu(item) : setSelected(item))
        }
        delayLongPress={350}
        accessibilityHint={item.deleted_at ? undefined : t('chats.messageOptionsHint')}
        style={[
          styles.bubble,
          isMine
            ? [styles.myBubble, { backgroundColor: theme.primary }]
            : [styles.theirBubble, { backgroundColor: theme.backgroundElement }],
          highlightId === item.id && styles.highlight,
        ]}>
        {item.deleted_at ? (
          <ThemedText style={[styles.body, styles.deleted, { color: textColor }]}>
            {t('chats.messageDeleted')}
          </ThemedText>
        ) : (
          <>
            {item.reply_to_id && (
              <QuotedMessage
                name={(() => {
                  const original = quoted(item.reply_to_id);
                  return original ? authorName(original.sender_id) : '…';
                })()}
                text={quoteText(t, quoted(item.reply_to_id))}
                mine={isMine}
                onPress={() => jumpTo(item.reply_to_id ?? '')}
              />
            )}
            {item.image_path && (
              <ChatPhoto
                url={photoUrls.get(item.image_path)}
                failed={failedPhotos.has(item.image_path ?? '')}
                width={item.image_width ?? null}
                height={item.image_height ?? null}
                onPress={() => setViewerUrl(photoUrls.get(item.image_path ?? '') ?? null)}
              />
            )}
            {listing && <ListingCard listing={listing} compact />}
            {item.body ? (
              <ThemedText style={[styles.body, { color: textColor }]}>{item.body}</ThemedText>
            ) : null}
          </>
        )}
        <ThemedText
          style={[
            styles.time,
            isMine ? { color: theme.onPrimary, opacity: 0.75 } : { color: theme.textSecondary },
          ]}>
          {formatMessageTime(item.created_at, i18n.language)}
        </ThemedText>
      </Pressable>
    );
  }

  return (
    <ThemedView style={styles.screen}>
      {header}
      <View style={styles.screen}>
        <View style={[styles.banner, { backgroundColor: theme.backgroundSelected }]}>
          <ThemedText type="small" style={styles.bannerText}>
            {t('messages.safetyTip')}
          </ThemedText>
        </View>

        {messages.length === 0 ? (
          <View style={[styles.screen, styles.centered]}>
            <ThemedText themeColor="textSecondary" style={styles.bannerText}>
              {t('messages.firstMessageHint', { name })}
            </ThemedText>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            inverted
            data={messages}
            onScrollToIndexFailed={onScrollToIndexFailed}
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
            styles.footer,
            {
              borderTopColor: theme.border,
              backgroundColor: theme.backgroundElement,
              paddingBottom: Math.max(insets.bottom, Spacing.two),
            },
          ]}>
          {actionError && (
            <ThemedText
              type="small"
              style={{ color: theme.danger }}
              accessibilityLiveRegion="polite">
              {t('messages.actionError')}
            </ThemedText>
          )}

          {iBlockedThem ? (
            <View style={styles.requestBox}>
              <ThemedText type="small" style={styles.bannerText}>
                {t('blocked.youBlocked', { name })}
              </ThemedText>
              <Pressable
                accessibilityRole="button"
                onPress={toggleBlock}
                style={({ pressed }) => [
                  styles.requestButton,
                  { borderColor: theme.border, borderWidth: 1 },
                  pressed && styles.pressed,
                ]}>
                <ThemedText style={styles.bold}>{t('blocked.unblock')}</ThemedText>
              </Pressable>
            </View>
          ) : isIncomingRequest ? (
            <View style={styles.requestBox}>
              <ThemedText type="small" style={styles.bannerText}>
                {t('messages.incomingRequest', { name })}
              </ThemedText>
              <View style={styles.requestButtons}>
                <Pressable
                  accessibilityRole="button"
                  disabled={responding}
                  onPress={() => respond(false)}
                  style={({ pressed }) => [
                    styles.requestButton,
                    { borderColor: theme.border, borderWidth: 1 },
                    (pressed || responding) && styles.pressed,
                  ]}>
                  <ThemedText style={styles.bold}>{t('messages.decline')}</ThemedText>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={responding}
                  onPress={() => respond(true)}
                  style={({ pressed }) => [
                    styles.requestButton,
                    { backgroundColor: theme.primary },
                    (pressed || responding) && styles.pressed,
                  ]}>
                  <ThemedText style={[styles.bold, { color: theme.onPrimary }]}>
                    {t('messages.accept')}
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          ) : (
            <>
              {isWaitingForAnswer && messages.length > 0 && (
                <ThemedText type="small" themeColor="textSecondary" style={styles.bannerText}>
                  {t('messages.waitingForAnswer', { name })}
                </ThemedText>
              )}
              {attachedListingId && listings.get(attachedListingId) && (
                <View style={styles.attached}>
                  <View style={styles.attachedHeader}>
                    <ThemedText type="smallBold" themeColor="textSecondary">
                      {t('messages.talkingAbout')}
                    </ThemedText>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t('messages.removeListing')}
                      onPress={() => setAttachedListingId(null)}
                      hitSlop={10}>
                      <ThemedText themeColor="textSecondary">✕</ThemedText>
                    </Pressable>
                  </View>
                  <ListingCard listing={listings.get(attachedListingId)!} compact />
                </View>
              )}
              {rateLimited && (
                <ThemedText
                  type="small"
                  style={{ color: theme.danger }}
                  accessibilityLiveRegion="polite">
                  {t('chats.rateLimit')}
                </ThemedText>
              )}
              <ChatComposer
                value={draft}
                onChangeText={setDraft}
                onSend={send}
                sending={sending}
                placeholder={t('messages.placeholder', { name })}
                // Photos only once the request has been accepted.
                onPickPhoto={conversation.status === 'accepted' ? choosePhoto : undefined}
                photoUri={photo?.uri}
                onRemovePhoto={() => setPhoto(null)}
                replyTo={
                  replyTo
                    ? { name: authorName(replyTo.sender_id), text: quoteText(t, replyTo) }
                    : null
                }
                onCancelReply={() => setReplyTo(null)}
              />
            </>
          )}
        </View>
        {/* Grows with the keyboard so the text box stays visible above it. */}
        <KeyboardSpacer />
      </View>

      <ActionSheet
        visible={menuOpen}
        title={otherUser ? `${otherUser.first_name}, ${otherUser.age}` : undefined}
        options={[
          { label: t('messages.viewProfile'), onPress: openProfile },
          ...(id ? [{ label: muteLabel, onPress: () => setMuteOpen(true) }] : []),
          { label: t('report.action'), destructive: true, onPress: () => report() },
          iBlockedThem
            ? { label: t('blocked.unblock'), onPress: toggleBlock }
            : {
                label: t('blocked.blockName', { name }),
                destructive: true,
                onPress: () => setConfirmBlock(true),
              },
        ]}
        onClose={() => setMenuOpen(false)}
      />
      <PhotoViewer url={viewerUrl} onClose={() => setViewerUrl(null)} />
      {id && (
        <MuteSheet
          visible={muteOpen}
          kind="conversation"
          chatId={id}
          onClose={() => setMuteOpen(false)}
          onError={() => setActionError(true)}
        />
      )}
      <ActionSheet
        visible={!!selected}
        options={
          selected
            ? [
                { label: t('chats.reply'), onPress: () => setReplyTo(selected) },
                {
                  label: t('report.reportMessage'),
                  destructive: true,
                  onPress: () => report(selected),
                },
              ]
            : []
        }
        onClose={() => setSelected(null)}
      />
      <ActionSheet
        visible={!!mineMenu}
        options={
          mineMenu
            ? [
                { label: t('chats.reply'), onPress: () => setReplyTo(mineMenu) },
                {
                  label: t('chats.deleteMessage'),
                  destructive: true,
                  onPress: () => setToDelete(mineMenu),
                },
              ]
            : []
        }
        onClose={() => setMineMenu(null)}
      />
      <ActionSheet
        visible={!!toDelete}
        title={t('chats.deleteConfirmTitle')}
        message={t('chats.deleteConfirmBody')}
        options={
          toDelete
            ? [
                {
                  label: t('chats.deleteMessage'),
                  destructive: true,
                  onPress: () => deleteMessage(toDelete),
                },
              ]
            : []
        }
        onClose={() => setToDelete(null)}
      />
      <ActionSheet
        visible={confirmBlock}
        title={t('blocked.confirmTitle', { name })}
        message={t('blocked.confirmBody')}
        options={[{ label: t('blocked.block'), destructive: true, onPress: toggleBlock }]}
        onClose={() => setConfirmBlock(false)}
      />
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
  // The original message, for a moment after tapping its quote.
  highlight: {
    boxShadow: '0 0 0 3px rgba(142, 106, 82, 0.45)',
  },
  headerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  menuDots: {
    fontSize: 20,
    fontWeight: 700,
  },
  banner: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  bannerText: {
    textAlign: 'center',
  },
  messageList: {
    padding: Spacing.three,
    gap: Spacing.two,
  },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 2,
    borderRadius: 16,
  },
  myBubble: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  theirBubble: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  body: {
    fontSize: 15,
    lineHeight: 21,
  },
  deleted: {
    fontStyle: 'italic',
    opacity: 0.8,
  },
  attached: {
    gap: Spacing.one,
  },
  attachedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  time: {
    fontSize: 11,
    lineHeight: 14,
    alignSelf: 'flex-end',
  },
  footer: {
    borderTopWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    gap: Spacing.two,
  },
  requestBox: {
    gap: Spacing.two,
  },
  requestButtons: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  requestButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bold: {
    fontWeight: 700,
  },
  pressed: {
    opacity: 0.6,
  },
});
