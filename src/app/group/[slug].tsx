import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChatSkeleton } from '@/components/skeleton';
import { ActionSheet } from '@/components/action-sheet';
import { Avatar } from '@/components/avatar';
import { ChatDividers, findFirstUnread, useJumpToUnread } from '@/components/chat-dividers';
import { IconButton } from '@/components/button';
import { ChatComposer } from '@/components/chat-composer';
import { ChatHeaderTitle } from '@/components/chat-header-title';
import { ChatPhoto, PhotoViewer } from '@/components/chat-photo';
import { GroupListings } from '@/components/group-listings';
import { GroupTile } from '@/components/group-tile';
import { ListingCard } from '@/components/listing-card';
import { SafetyTip } from '@/components/safety-tip';
import { SegmentedControl } from '@/components/segmented-control';
import { QuotedMessage, quoteText, useQuotedMessages } from '@/components/message-reply';
import { MuteSheet, useMuteLabel } from '@/components/mute-sheet';
import { KeyboardSpacer } from '@/components/keyboard-spacer';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useBlocks } from '@/hooks/use-blocks';
import { useChatPhotoUrls } from '@/hooks/use-chat-photo-urls';
import { useSession } from '@/hooks/use-session';
import { useShare } from '@/hooks/use-share';
import { useTheme } from '@/hooks/use-theme';
import {
  deleteMyMessage,
  fetchAuthors,
  fetchGroupBySlug,
  fetchGroupLastRead,
  fetchGroupMessagesByIds,
  fetchGroupStats,
  fetchMessages,
  fetchMyGroupIds,
  joinGroup,
  leaveGroup,
  markGroupRead,
  MESSAGES_PAGE_SIZE,
  sendMessage,
} from '@/lib/chat';
import { deleteChatPhotos, pickChatPhoto, uploadChatPhoto } from '@/lib/chat-photos';
import { startConversation } from '@/lib/direct-messages';
import { isRateLimitError } from '@/lib/errors';
import { formatMessageTime, isSameDay } from '@/lib/format';
import { appUrl } from '@/lib/links';
import { fetchListingsByIds } from '@/lib/listings';
import { supabase } from '@/lib/supabase';
import type { ImagePickerAsset } from 'expo-image-picker';

import type { ChatGroup, GroupMessage, PublicProfile } from '@/types/chat';
import type { Listing } from '@/types/listing';

// Messages from the same person within this time are grouped (name and photo shown once).
const GROUPING_WINDOW_MS = 5 * 60 * 1000;

/** Adds messages that aren't in the list yet, keeping newest first. */
function mergeMessages(current: GroupMessage[], incoming: GroupMessage[]): GroupMessage[] {
  const known = new Set(current.map((m) => m.id));
  const fresh = incoming.filter((m) => !known.has(m.id));
  if (fresh.length === 0) return current;
  return [...current, ...fresh].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/** Swaps in a newer version of a message (e.g. after it was deleted). */
function replaceMessage(current: GroupMessage[], updated: GroupMessage): GroupMessage[] {
  return current.map((m) => (m.id === updated.id ? updated : m));
}

export default function GroupChatScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { session } = useSession();
  const userId = session?.user.id;
  const { blockedIds, block } = useBlocks();

  const [group, setGroup] = useState<ChatGroup | null>(null);
  const [isMember, setIsMember] = useState(false);
  // For the line under the group's name at the top ("128 members").
  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [messages, setMessages] = useState<GroupMessage[]>([]); // newest first
  const [authors, setAuthors] = useState<Map<string, PublicProfile>>(new Map());
  const [listings, setListings] = useState<Map<string, Listing>>(new Map());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [hasOlder, setHasOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  const [toDelete, setToDelete] = useState<GroupMessage | null>(null);
  const [joining, setJoining] = useState(false);
  const [selected, setSelected] = useState<GroupMessage | null>(null);
  const [confirmBlockId, setConfirmBlockId] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // A photo chosen to send (shown above the text box), and a photo opened full screen.
  const [photo, setPhoto] = useState<ImagePickerAsset | null>(null);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const { urls: photoUrls, failed: failedPhotos } = useChatPhotoUrls(messages);
  // Replies: the message being answered, the menu for your own messages, and the original
  // briefly highlighted after tapping a quote.
  const [replyTo, setReplyTo] = useState<GroupMessage | null>(null);
  const [mineMenu, setMineMenu] = useState<GroupMessage | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const quoted = useQuotedMessages(messages, fetchGroupMessagesByIds);
  // The first message you hadn't read when you opened the chat ("3 new messages" goes above it).
  const [firstUnread, setFirstUnread] = useState<{ id: string; count: number } | null>(null);
  const listRef = useRef<FlatList<GroupMessage>>(null);
  const [muteOpen, setMuteOpen] = useState(false);
  const { share, toast } = useShare();
  const muteLabel = useMuteLabel('group', group?.id);
  // Each group has two tabs: the conversation, and its listings in order.
  const [tab, setTab] = useState<'chat' | 'listings'>('chat');

  // Loads the authors' names and photos, and the listings shared as cards.
  const addAuthors = useCallback(async (newMessages: GroupMessage[]) => {
    try {
      const listingIds = newMessages.flatMap((m) => (m.listing_id ? [m.listing_id] : []));
      const [foundAuthors, foundListings] = await Promise.all([
        fetchAuthors(newMessages.map((m) => m.user_id)),
        fetchListingsByIds(listingIds),
      ]);
      setAuthors((current) => new Map([...current, ...foundAuthors]));
      setListings((current) => new Map([...current, ...foundListings]));
    } catch {
      // Names and cards are a nice-to-have; messages still show without them.
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
        const [myGroupIds, latest, lastReadAt] = await Promise.all([
          fetchMyGroupIds(userId),
          fetchMessages(found.id),
          fetchGroupLastRead(found.id, userId).catch(() => null),
        ]);
        if (cancelled) return;
        setGroup(found);
        setIsMember(myGroupIds.has(found.id));
        if (myGroupIds.has(found.id)) {
          setFirstUnread(
            findFirstUnread(latest, lastReadAt, (m) => m.user_id !== userId && !m.deleted_at)
          );
          markGroupRead(found.id);
        }
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
        {
          event: 'INSERT',
          schema: 'public',
          table: 'group_messages',
          filter: `group_id=eq.${groupId}`,
        },
        (payload) => {
          const message = payload.new as GroupMessage;
          setMessages((current) => mergeMessages(current, [message]));
          addAuthors([message]);
          // The chat is open, so this message counts as read.
          markGroupRead(groupId);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'group_messages',
          filter: `group_id=eq.${groupId}`,
        },
        (payload) => setMessages((current) => replaceMessage(current, payload.new as GroupMessage))
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, addAuthors]);

  // Leaving the screen also counts as having read everything so far.
  useEffect(() => {
    if (!groupId) return;
    return () => {
      markGroupRead(groupId);
    };
  }, [groupId]);

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

  async function choosePhoto() {
    const picked = await pickChatPhoto();
    if (picked) setPhoto(picked);
  }

  async function send() {
    if (!group || !userId || (!draft.trim() && !photo) || sending) return;
    setSending(true);
    setSendError(false);
    setRateLimited(false);
    try {
      const uploaded = photo ? await uploadChatPhoto(userId, 'group', group.id, photo) : undefined;
      const message = await sendMessage(group.id, draft, uploaded, replyTo?.id);
      setMessages((current) => mergeMessages(current, [message]));
      setDraft('');
      setPhoto(null);
      setReplyTo(null);
    } catch (error) {
      if (isRateLimitError(error)) setRateLimited(true);
      else setSendError(true);
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

  function authorName(authorId: string): string {
    return authorId === userId ? t('chats.you') : (authors.get(authorId)?.first_name ?? '…');
  }

  /** Scrolls to the quoted message and highlights it for a moment. */
  function jumpTo(messageId: string) {
    const index = visibleMessages.findIndex((m) => m.id === messageId);
    if (index === -1) return;
    listRef.current?.scrollToIndex({ index, viewPosition: 0.5, animated: true });
    setHighlightId(messageId);
    setTimeout(() => setHighlightId((current) => (current === messageId ? null : current)), 1600);
  }

  /** Opens a private chat with the listing's owner, with the listing attached. */
  async function replyPrivately(listingOwnerId: string, listingId: string) {
    try {
      const conversationId = await startConversation(listingOwnerId);
      router.push({ pathname: '/conversation/[id]', params: { id: conversationId, listingId } });
    } catch {
      setSendError(true);
    }
  }

  function openProfile(authorId: string) {
    router.push({ pathname: '/user/[id]', params: { id: authorId } });
  }

  function reportMessage(message: GroupMessage) {
    router.push({
      pathname: '/report',
      params: {
        userId: message.user_id,
        name: authors.get(message.user_id)?.first_name ?? '',
        groupMessageId: message.id,
        snapshot: message.body.slice(0, 500),
        imagePath: message.image_path ?? undefined,
      },
    });
  }

  async function deleteMessage(message: GroupMessage) {
    try {
      if (message.image_path) await deleteChatPhotos([message.image_path]);
      await deleteMyMessage('group', message.id);
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
      setSendError(true);
    }
  }

  async function blockAuthor(authorId: string) {
    try {
      await block(authorId);
    } catch {
      setSendError(true);
    }
  }

  // Messages from people you blocked disappear straight away (the database also stops sending them).
  const visibleMessages = messages.filter((m) => !blockedIds.has(m.user_id));
  const selectedAuthor = selected ? authors.get(selected.user_id) : undefined;
  const blockTarget = confirmBlockId ? authors.get(confirmBlockId) : undefined;

  const firstUnreadIndex = firstUnread
    ? visibleMessages.findIndex((m) => m.id === firstUnread.id)
    : -1;
  const onScrollToIndexFailed = useJumpToUnread(listRef, firstUnreadIndex);

  // Each message, with the day and "new messages" dividers above it when needed.
  function renderMessage({ item, index }: { item: GroupMessage; index: number }) {
    return (
      <ChatDividers
        createdAt={item.created_at}
        olderCreatedAt={visibleMessages[index + 1]?.created_at}
        newCount={item.id === firstUnread?.id ? firstUnread.count : undefined}>
        {renderBubble(item, index)}
      </ChatDividers>
    );
  }

  function renderBubble(item: GroupMessage, index: number) {
    const isMine = item.user_id === userId;
    const time = formatMessageTime(item.created_at, i18n.language);
    const sharedListing = item.listing_id ? listings.get(item.listing_id) : undefined;
    // A shared listing shows as a card instead of the plain text.
    const listingCard = sharedListing ? (
      <View style={styles.listingShare}>
        <ListingCard listing={sharedListing} compact />
        {/* One tap to write to the owner about this listing. */}
        {sharedListing.user_id !== userId && (
          <Pressable
            accessibilityRole="button"
            onPress={() => replyPrivately(sharedListing.user_id, sharedListing.id)}
            hitSlop={6}
            style={({ pressed }) => [
              styles.replyPrivately,
              { borderColor: theme.primary },
              pressed && styles.pressed,
            ]}>
            <ThemedText type="smallBold" style={{ color: theme.primary }}>
              {t('chats.replyPrivately')}
            </ThemedText>
          </Pressable>
        )}
      </View>
    ) : null;
    const quote =
      !item.deleted_at && item.reply_to_id ? (
        <QuotedMessage
          name={(() => {
            const original = quoted(item.reply_to_id);
            return original ? authorName(original.user_id) : '…';
          })()}
          text={quoteText(t, quoted(item.reply_to_id))}
          mine={isMine}
          onPress={() => jumpTo(item.reply_to_id ?? '')}
        />
      ) : null;
    const highlighted = highlightId === item.id && styles.highlight;
    const photoUrl = item.image_path ? photoUrls.get(item.image_path) : undefined;
    const photoView =
      !item.deleted_at && item.image_path ? (
        <ChatPhoto
          url={photoUrl}
          failed={failedPhotos.has(item.image_path ?? '')}
          width={item.image_width ?? null}
          height={item.image_height ?? null}
          onPress={() => setViewerUrl(photoUrl ?? null)}
        />
      ) : null;

    const deletedText = (color: string) => (
      <ThemedText style={[styles.body, styles.deleted, { color }]}>
        {t('chats.messageDeleted')}
      </ThemedText>
    );

    if (isMine) {
      return (
        <Pressable
          onLongPress={item.deleted_at ? undefined : () => setMineMenu(item)}
          delayLongPress={350}
          accessibilityHint={item.deleted_at ? undefined : t('chats.messageOptionsHint')}
          style={[styles.bubble, styles.myBubble, { backgroundColor: theme.primary }, highlighted]}>
          {quote}
          {photoView}
          {item.deleted_at
            ? deletedText(theme.onPrimary)
            : (listingCard ??
              (item.body ? (
                <ThemedText style={[styles.body, { color: theme.onPrimary }]}>
                  {item.body}
                </ThemedText>
              ) : null))}
          <ThemedText style={[styles.time, { color: theme.onPrimary, opacity: 0.75 }]}>
            {time}
          </ThemedText>
        </Pressable>
      );
    }

    // The list is newest-first, so the message shown just above this one is index + 1.
    const previous = visibleMessages[index + 1];
    const continuesPrevious =
      previous?.user_id === item.user_id &&
      item.id !== firstUnread?.id &&
      isSameDay(item.created_at, previous.created_at) &&
      new Date(item.created_at).getTime() - new Date(previous.created_at).getTime() <
        GROUPING_WINDOW_MS;
    const author = authors.get(item.user_id);

    return (
      <View style={styles.theirRow}>
        <View style={styles.avatarSlot}>
          {!continuesPrevious && (
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={author?.first_name}
              onPress={() => openProfile(item.user_id)}
              hitSlop={6}>
              <Avatar uri={author?.avatar_url ?? null} name={author?.first_name ?? '?'} size={32} />
            </Pressable>
          )}
        </View>
        <Pressable
          onLongPress={item.deleted_at ? undefined : () => setSelected(item)}
          delayLongPress={350}
          accessibilityHint={item.deleted_at ? undefined : t('chats.messageOptionsHint')}
          style={[
            styles.bubble,
            styles.theirBubble,
            { backgroundColor: theme.backgroundElement },
            highlighted,
          ]}>
          {!continuesPrevious && (
            <Pressable
              accessibilityRole="link"
              onPress={() => openProfile(item.user_id)}
              hitSlop={6}>
              <ThemedText type="smallBold" style={{ color: theme.primary }}>
                {author ? `${author.first_name}, ${author.age}` : '…'}
              </ThemedText>
            </Pressable>
          )}
          {quote}
          {photoView}
          {item.deleted_at
            ? deletedText(theme.textSecondary)
            : (listingCard ??
              (item.body ? <ThemedText style={styles.body}>{item.body}</ThemedText> : null))}
          <ThemedText type="small" themeColor="textSecondary" style={styles.time}>
            {time}
          </ThemedText>
        </Pressable>
      </View>
    );
  }

  // Coming back from the group's page: you may have joined or left there.
  useFocusEffect(
    useCallback(() => {
      if (!groupId || !userId) return;
      let cancelled = false;
      Promise.all([fetchMyGroupIds(userId), fetchGroupStats()])
        .then(([mine, stats]) => {
          if (cancelled) return;
          setIsMember(mine.has(groupId));
          setMemberCount(stats.get(groupId)?.member_count ?? null);
        })
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }, [groupId, userId])
  );

  const header = (
    <Stack.Screen
      options={{
        title: group?.name ?? '',
        // Tapping the name opens the group's page (like WhatsApp's group info).
        headerTitle: () =>
          group ? (
            <ChatHeaderTitle
              title={group.name}
              subtitle={
                memberCount !== null
                  ? t('chats.memberCount', { count: memberCount })
                  : t('chats.tapForInfo')
              }
              picture={<GroupTile group={group} size={34} />}
              onPress={() =>
                router.push({ pathname: '/group-info/[slug]', params: { slug: group.slug } })
              }
            />
          ) : undefined,
        headerRight: () =>
          group ? (
            <IconButton
              icon="more"
              label={t('messages.options')}
              variant="plain"
              size={40}
              onPress={() => setMenuOpen(true)}
            />
          ) : null,
      }}
    />
  );

  if (loading || loadError || !group) {
    return (
      <ThemedView style={[styles.screen, styles.centered]}>
        {header}
        {loading ? (
          <ChatSkeleton />
        ) : (
          <ThemedText themeColor="textSecondary">{t('chats.loadError')}</ThemedText>
        )}
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.screen}>
      {header}
      <View style={styles.screen}>
        <View style={styles.tabs}>
          <SegmentedControl
            segments={[
              { key: 'chat', label: t('chats.tabChat') },
              { key: 'listings', label: t('chats.tabListings') },
            ]}
            selected={tab}
            onChange={setTab}
          />
        </View>

        {tab === 'listings' ? (
          <GroupListings group={group} />
        ) : (
          <>
            <SafetyTip text={t('chats.safetyTip')} />

            {visibleMessages.length === 0 ? (
              <View style={[styles.screen, styles.centered]}>
                <ThemedText themeColor="textSecondary">{t('chats.emptyChat')}</ThemedText>
              </View>
            ) : (
              <FlatList
                ref={listRef}
                inverted
                data={visibleMessages}
                onScrollToIndexFailed={onScrollToIndexFailed}
                keyExtractor={(m) => m.id}
                renderItem={renderMessage}
                contentContainerStyle={styles.messageList}
                onEndReached={loadOlder}
                onEndReachedThreshold={0.3}
                ListFooterComponent={
                  loadingOlder ? <ActivityIndicator color={theme.primary} /> : null
                }
              />
            )}

            <View
              style={[
                styles.composer,
                {
                  borderTopColor: theme.border,
                  backgroundColor: theme.backgroundElement,
                  paddingBottom: Math.max(insets.bottom, Spacing.two),
                },
              ]}>
              {sendError && (
                <ThemedText
                  type="small"
                  style={{ color: theme.danger }}
                  accessibilityLiveRegion="polite">
                  {t('chats.sendError')}
                </ThemedText>
              )}
              {rateLimited && (
                <ThemedText
                  type="small"
                  style={{ color: theme.danger }}
                  accessibilityLiveRegion="polite">
                  {t('chats.rateLimit')}
                </ThemedText>
              )}
              {isMember ? (
                <ChatComposer
                  value={draft}
                  onChangeText={setDraft}
                  onSend={send}
                  sending={sending}
                  placeholder={t('chats.messagePlaceholder', { name: group.name })}
                  onPickPhoto={choosePhoto}
                  photoUri={photo?.uri}
                  onRemovePhoto={() => setPhoto(null)}
                  replyTo={
                    replyTo
                      ? { name: authorName(replyTo.user_id), text: quoteText(t, replyTo) }
                      : null
                  }
                  onCancelReply={() => setReplyTo(null)}
                />
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
                  <ThemedText style={{ color: theme.onPrimary, fontWeight: 700 }}>
                    {t('chats.joinToWrite')}
                  </ThemedText>
                </Pressable>
              )}
            </View>
          </>
        )}
        {/* Grows with the keyboard so the text box stays visible above it. */}
        <KeyboardSpacer />
      </View>

      <ActionSheet
        visible={!!selected}
        title={selectedAuthor?.first_name}
        options={
          selected
            ? [
                { label: t('chats.reply'), onPress: () => setReplyTo(selected) },
                { label: t('messages.viewProfile'), onPress: () => openProfile(selected.user_id) },
                {
                  label: t('report.reportMessage'),
                  destructive: true,
                  onPress: () => reportMessage(selected),
                },
                {
                  label: t('blocked.blockName', { name: selectedAuthor?.first_name ?? '' }),
                  destructive: true,
                  onPress: () => setConfirmBlockId(selected.user_id),
                },
              ]
            : []
        }
        onClose={() => setSelected(null)}
      />
      <ActionSheet
        visible={!!confirmBlockId}
        title={t('blocked.confirmTitle', { name: blockTarget?.first_name ?? '' })}
        message={t('blocked.confirmBody')}
        options={
          confirmBlockId
            ? [
                {
                  label: t('blocked.block'),
                  destructive: true,
                  onPress: () => blockAuthor(confirmBlockId),
                },
              ]
            : []
        }
        onClose={() => setConfirmBlockId(null)}
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
        visible={confirmLeave}
        title={t('chats.leaveConfirmTitle', { name: group.name })}
        message={t('chats.leaveConfirmBody')}
        options={[{ label: t('chats.leave'), destructive: true, onPress: leave }]}
        onClose={() => setConfirmLeave(false)}
      />
      <ActionSheet
        visible={menuOpen}
        title={group.name}
        options={[
          {
            label: t('share.shareGroup'),
            onPress: () =>
              share(t('share.groupMessage', { name: group.name }), appUrl(`/group/${group.slug}`)),
          },
          ...(isMember
            ? [
                { label: muteLabel, onPress: () => setMuteOpen(true) },
                {
                  label: t('chats.leave'),
                  destructive: true,
                  onPress: () => setConfirmLeave(true),
                },
              ]
            : []),
        ]}
        onClose={() => setMenuOpen(false)}
      />
      <MuteSheet
        visible={muteOpen}
        kind="group"
        chatId={group.id}
        onClose={() => setMuteOpen(false)}
        onError={() => setSendError(true)}
      />
      {toast}
      <PhotoViewer url={viewerUrl} onClose={() => setViewerUrl(null)} />
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
  listingShare: {
    gap: Spacing.two,
  },
  replyPrivately: {
    alignSelf: 'flex-start',
    borderWidth: 1.5,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: 6,
  },
  // The original message, for a moment after tapping its quote.
  highlight: {
    boxShadow: '0 0 0 3px rgba(142, 106, 82, 0.45)',
  },
  tabs: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.one,
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
    borderRadius: 18,
    borderBottomLeftRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(120, 100, 85, 0.18)',
  },
  body: {
    fontSize: 15,
    lineHeight: 21,
  },
  deleted: {
    fontStyle: 'italic',
    opacity: 0.8,
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
  joinButton: {
    height: 48,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
});
