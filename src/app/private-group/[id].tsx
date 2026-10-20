import { router, Stack, useLocalSearchParams } from 'expo-router';
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
import { MuteSheet, useMuteLabel } from '@/components/mute-sheet';
import { Icon } from '@/components/icon';
import { KeyboardSpacer } from '@/components/keyboard-spacer';
import { QuotedMessage, quoteText, useQuotedMessages } from '@/components/message-reply';
import { PrivateGroupBadge } from '@/components/private-group-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useBlocks } from '@/hooks/use-blocks';
import { useChatPhotoUrls } from '@/hooks/use-chat-photo-urls';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { deleteMyMessage, fetchAuthors, MESSAGES_PAGE_SIZE } from '@/lib/chat';
import { deleteChatPhotos, pickChatPhoto, uploadChatPhoto } from '@/lib/chat-photos';
import { isRateLimitError } from '@/lib/errors';
import { formatMessageTime, isSameDay } from '@/lib/format';
import {
  fetchJoinRequests,
  fetchPrivateGroup,
  fetchPrivateGroupLastRead,
  fetchPrivateGroupMessagesByIds,
  fetchPrivateGroupMembers,
  fetchPrivateGroupMessages,
  eventText,
  leavePrivateGroup,
  markPrivateGroupRead,
  respondToGroupInvite,
  sendPrivateGroupMessage,
} from '@/lib/private-groups';
import { supabase } from '@/lib/supabase';
import type { ImagePickerAsset } from 'expo-image-picker';

import type {
  PrivateGroup,
  PrivateGroupMember,
  PrivateGroupMessage,
  PublicProfile,
} from '@/types/chat';

// Messages from the same person within this time are grouped (name and photo shown once).
const GROUPING_WINDOW_MS = 5 * 60 * 1000;

/** Adds messages that aren't in the list yet, keeping newest first. */
function mergeMessages(current: PrivateGroupMessage[], incoming: PrivateGroupMessage[]) {
  const known = new Set(current.map((m) => m.id));
  const fresh = incoming.filter((m) => !known.has(m.id));
  if (fresh.length === 0) return current;
  return [...current, ...fresh].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/** Swaps in a newer version of a message (e.g. after it was deleted). */
function replaceMessage(current: PrivateGroupMessage[], updated: PrivateGroupMessage) {
  return current.map((m) => (m.id === updated.id ? updated : m));
}

export default function PrivateGroupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { session } = useSession();
  const userId = session?.user.id;
  const { blockedIds } = useBlocks();

  const [group, setGroup] = useState<PrivateGroup | null>(null);
  const [members, setMembers] = useState<PrivateGroupMember[]>([]);
  const [people, setPeople] = useState<Map<string, PublicProfile>>(new Map());
  const [messages, setMessages] = useState<PrivateGroupMessage[]>([]); // newest first
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [hasOlder, setHasOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [actionError, setActionError] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  const [responding, setResponding] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [selected, setSelected] = useState<PrivateGroupMessage | null>(null);
  const [toDelete, setToDelete] = useState<PrivateGroupMessage | null>(null);
  const [muteOpen, setMuteOpen] = useState(false);
  const [pendingRequests, setPendingRequests] = useState(0);
  // A photo chosen to send (shown above the text box), and a photo opened full screen.
  const [photo, setPhoto] = useState<ImagePickerAsset | null>(null);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const { urls: photoUrls, failed: failedPhotos } = useChatPhotoUrls(messages);
  // Replies: the message being answered, the menu for your own messages, and the original
  // briefly highlighted after tapping a quote.
  const [replyTo, setReplyTo] = useState<PrivateGroupMessage | null>(null);
  const [mineMenu, setMineMenu] = useState<PrivateGroupMessage | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const quoted = useQuotedMessages(messages, fetchPrivateGroupMessagesByIds);
  // The first message you hadn't read when you opened the chat ("3 new messages" goes above it).
  const [firstUnread, setFirstUnread] = useState<{ id: string; count: number } | null>(null);
  const listRef = useRef<FlatList<PrivateGroupMessage>>(null);
  const muteLabel = useMuteLabel('private_group', id);

  const me = members.find((m) => m.user_id === userId);
  const isMember = me?.status === 'member';

  const addPeople = useCallback(async (ids: string[]) => {
    try {
      const found = await fetchAuthors(ids);
      setPeople((current) => new Map([...current, ...found]));
    } catch {
      // Names are a nice-to-have.
    }
  }, []);

  /** Group details and members; messages only once you're a member. */
  const loadGroup = useCallback(async () => {
    if (!id) return;
    const [found, memberList, requests] = await Promise.all([
      fetchPrivateGroup(id),
      fetchPrivateGroupMembers(id),
      // Empty unless you're a member.
      fetchJoinRequests(id).catch(() => []),
    ]);
    setGroup(found);
    setMembers(memberList);
    setPendingRequests(requests.length);
    addPeople(memberList.map((m) => m.user_id));
    return memberList;
  }, [id, addPeople]);

  useEffect(() => {
    if (!id || !userId) return;
    let cancelled = false;
    (async () => {
      try {
        const memberList = await loadGroup();
        const mine = memberList?.find((m) => m.user_id === userId);
        if (!cancelled && mine?.status === 'member') {
          const [latest, lastReadAt] = await Promise.all([
            fetchPrivateGroupMessages(id),
            fetchPrivateGroupLastRead(id, userId).catch(() => null),
          ]);
          if (cancelled) return;
          setFirstUnread(
            findFirstUnread(
              latest,
              lastReadAt,
              (m) => m.kind === 'message' && m.sender_id !== userId && !m.deleted_at
            )
          );
          setMessages((current) => mergeMessages(current, latest));
          setHasOlder(latest.length === MESSAGES_PAGE_SIZE);
          addPeople(latest.flatMap((m) => (m.subject_id ? [m.subject_id] : [])));
          markPrivateGroupRead(id);
        }
      } catch {
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, userId, loadGroup, addPeople]);

  // Live updates: new or deleted messages, and people joining or leaving.
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`private-group:${id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'private_group_messages',
          filter: `group_id=eq.${id}`,
        },
        (payload) => {
          const message = payload.new as PrivateGroupMessage;
          setMessages((current) => mergeMessages(current, [message]));
          addPeople([message.sender_id, ...(message.subject_id ? [message.subject_id] : [])]);
          markPrivateGroupRead(id);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'private_group_messages',
          filter: `group_id=eq.${id}`,
        },
        (payload) =>
          setMessages((current) => replaceMessage(current, payload.new as PrivateGroupMessage))
      )
      .on(
        'postgres_changes',
        // "Asked to join" notices disappear when the request is answered.
        { event: 'DELETE', schema: 'public', table: 'private_group_messages' },
        (payload) => {
          const removedId = (payload.old as { id?: string }).id;
          if (removedId) setMessages((current) => current.filter((m) => m.id !== removedId));
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'private_group_members',
          filter: `group_id=eq.${id}`,
        },
        () => {
          loadGroup().catch(() => {});
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, addPeople, loadGroup]);

  // Leaving the screen counts as having read everything so far.
  useEffect(() => {
    if (!id) return;
    return () => {
      markPrivateGroupRead(id);
    };
  }, [id]);

  async function loadOlder() {
    if (!id || !hasOlder || loadingOlder || messages.length === 0) return;
    setLoadingOlder(true);
    try {
      const older = await fetchPrivateGroupMessages(id, messages[messages.length - 1].created_at);
      setMessages((current) => mergeMessages(current, older));
      setHasOlder(older.length === MESSAGES_PAGE_SIZE);
      addPeople(older.map((m) => m.sender_id));
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
      const uploaded = photo
        ? await uploadChatPhoto(userId, 'private_group', id, photo)
        : undefined;
      const message = await sendPrivateGroupMessage(id, draft, uploaded, replyTo?.id);
      setMessages((current) => mergeMessages(current, [message]));
      setDraft('');
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
      await respondToGroupInvite(id, accept);
      if (!accept) {
        if (router.canGoBack()) router.back();
        else router.replace('/messages');
        return;
      }
      await loadGroup();
      const latest = await fetchPrivateGroupMessages(id);
      setMessages(latest);
      setHasOlder(latest.length === MESSAGES_PAGE_SIZE);
      addPeople(latest.map((m) => m.sender_id));
    } catch {
      setActionError(true);
    } finally {
      setResponding(false);
    }
  }

  async function leave() {
    if (!id) return;
    try {
      await leavePrivateGroup(id);
      if (router.canGoBack()) router.back();
      else router.replace('/messages');
    } catch {
      setActionError(true);
    }
  }

  async function deleteMessage(message: PrivateGroupMessage) {
    try {
      if (message.image_path) await deleteChatPhotos([message.image_path]);
      await deleteMyMessage('private_group', message.id);
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

  function authorName(personId: string): string {
    return personId === userId ? t('chats.you') : (people.get(personId)?.first_name ?? '…');
  }

  /** Scrolls to the quoted message and highlights it for a moment. */
  function jumpTo(messageId: string) {
    const index = visibleMessages.findIndex((m) => m.id === messageId);
    if (index === -1) return;
    listRef.current?.scrollToIndex({ index, viewPosition: 0.5, animated: true });
    setHighlightId(messageId);
    setTimeout(() => setHighlightId((current) => (current === messageId ? null : current)), 1600);
  }

  function openProfile(personId: string) {
    router.push({ pathname: '/user/[id]', params: { id: personId } });
  }

  function reportMessage(message: PrivateGroupMessage) {
    router.push({
      pathname: '/report',
      params: {
        userId: message.sender_id,
        name: people.get(message.sender_id)?.first_name ?? '',
        privateGroupMessageId: message.id,
        snapshot: message.body.slice(0, 500),
        imagePath: message.image_path ?? undefined,
      },
    });
  }

  const firstUnreadIndex = firstUnread
    ? messages.filter((m) => !blockedIds.has(m.sender_id)).findIndex((m) => m.id === firstUnread.id)
    : -1;
  const onScrollToIndexFailed = useJumpToUnread(listRef, firstUnreadIndex);

  // Under the group's name: who's in it.
  const headerMembers = members
    .filter((m) => m.status === 'member')
    .map((m) =>
      m.user_id === userId ? t('chats.you') : (people.get(m.user_id)?.first_name ?? '…')
    )
    .join(', ');

  const header = (
    <Stack.Screen
      options={{
        title: group?.name ?? '',
        // Tapping the name opens the members page (like WhatsApp's group info).
        headerTitle: () =>
          group && isMember ? (
            <ChatHeaderTitle
              title={group.name}
              subtitle={headerMembers}
              picture={<PrivateGroupBadge name={group.name} size={34} />}
              onPress={() =>
                router.push({ pathname: '/private-group-members/[id]', params: { id: group.id } })
              }
            />
          ) : undefined,
        headerRight: () =>
          isMember ? (
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

  if (loading || loadError || !group || !me) {
    return (
      <ThemedView style={[styles.screen, styles.centered]}>
        {header}
        {loading ? (
          <ChatSkeleton />
        ) : (
          <ThemedText themeColor="textSecondary">{t('privateGroups.notFound')}</ThemedText>
        )}
      </ThemedView>
    );
  }

  const memberNames = members
    .filter((m) => m.status === 'member')
    .map((m) =>
      m.user_id === userId ? t('chats.you') : (people.get(m.user_id)?.first_name ?? '…')
    )
    .join(', ');

  // Invitation not yet answered: show who's inside and Accept / Decline.
  if (!isMember) {
    const inviter = people.get(me.invited_by ?? '');
    return (
      <ThemedView style={[styles.screen, styles.centered]}>
        {header}
        <View style={styles.inviteBox}>
          <ThemedText type="subtitle" style={styles.inviteTitle}>
            {group.name}
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.centerText}>
            {t('privateGroups.inviteBody', { name: inviter?.first_name ?? '' })}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
            {t('privateGroups.whoIsIn', { names: memberNames })}
          </ThemedText>
          {actionError && (
            <ThemedText type="small" style={{ color: theme.danger }}>
              {t('messages.actionError')}
            </ThemedText>
          )}
          <View style={styles.inviteButtons}>
            <Pressable
              accessibilityRole="button"
              disabled={responding}
              onPress={() => respond(false)}
              style={({ pressed }) => [
                styles.inviteButton,
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
                styles.inviteButton,
                { backgroundColor: theme.primary },
                (pressed || responding) && styles.pressed,
              ]}>
              <ThemedText style={[styles.bold, { color: theme.onPrimary }]}>
                {t('privateGroups.join')}
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </ThemedView>
    );
  }

  const visibleMessages = messages.filter((m) => !blockedIds.has(m.sender_id));

  // Each message, with the day and "new messages" dividers above it when needed.
  function renderMessage({ item, index }: { item: PrivateGroupMessage; index: number }) {
    return (
      <ChatDividers
        createdAt={item.created_at}
        olderCreatedAt={visibleMessages[index + 1]?.created_at}
        newCount={item.id === firstUnread?.id ? firstUnread.count : undefined}>
        {renderBubble(item, index)}
      </ChatDividers>
    );
  }

  function renderBubble(item: PrivateGroupMessage, index: number) {
    if (item.kind === 'event' && item.event) {
      return (
        <View style={styles.eventRow}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
            {eventText(t, item.event, item.sender_id, item.subject_id, userId ?? '', (personId) =>
              personId ? (people.get(personId)?.first_name ?? '…') : '…'
            )}
          </ThemedText>
        </View>
      );
    }
    const isMine = item.sender_id === userId;
    const time = formatMessageTime(item.created_at, i18n.language);
    const photoUrl = item.image_path ? photoUrls.get(item.image_path) : undefined;
    // The photo (if any) above the text; a photo alone has no text line.
    const body = (color: string) =>
      item.deleted_at ? (
        <ThemedText style={[styles.body, styles.deleted, { color }]}>
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
              url={photoUrl}
              failed={failedPhotos.has(item.image_path ?? '')}
              width={item.image_width ?? null}
              height={item.image_height ?? null}
              onPress={() => setViewerUrl(photoUrl ?? null)}
            />
          )}
          {item.body ? <ThemedText style={[styles.body, { color }]}>{item.body}</ThemedText> : null}
        </>
      );

    if (isMine) {
      return (
        <Pressable
          onLongPress={item.deleted_at ? undefined : () => setMineMenu(item)}
          delayLongPress={350}
          accessibilityHint={item.deleted_at ? undefined : t('chats.messageOptionsHint')}
          style={[
            styles.bubble,
            styles.myBubble,
            { backgroundColor: theme.primary },
            highlightId === item.id && styles.highlight,
          ]}>
          {body(theme.onPrimary)}
          <ThemedText style={[styles.time, { color: theme.onPrimary, opacity: 0.75 }]}>
            {time}
          </ThemedText>
        </Pressable>
      );
    }

    // The list is newest-first, so the message shown just above this one is index + 1.
    const previous = visibleMessages[index + 1];
    const continuesPrevious =
      previous?.kind === 'message' &&
      previous?.sender_id === item.sender_id &&
      item.id !== firstUnread?.id &&
      isSameDay(item.created_at, previous.created_at) &&
      new Date(item.created_at).getTime() - new Date(previous.created_at).getTime() <
        GROUPING_WINDOW_MS;
    const author = people.get(item.sender_id);

    return (
      <View style={styles.theirRow}>
        <View style={styles.avatarSlot}>
          {!continuesPrevious && (
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={author?.first_name}
              onPress={() => openProfile(item.sender_id)}
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
            highlightId === item.id && styles.highlight,
          ]}>
          {!continuesPrevious && (
            <ThemedText type="smallBold" style={{ color: theme.primary }}>
              {author ? `${author.first_name}, ${author.age}` : '…'}
            </ThemedText>
          )}
          {body(theme.text)}
          <ThemedText type="small" themeColor="textSecondary" style={styles.time}>
            {time}
          </ThemedText>
        </Pressable>
      </View>
    );
  }

  return (
    <ThemedView style={styles.screen}>
      {header}
      <View style={styles.screen}>
        {pendingRequests > 0 && (
          <Pressable
            accessibilityRole="link"
            onPress={() =>
              router.push({ pathname: '/private-group-members/[id]', params: { id: group.id } })
            }
            style={({ pressed }) => [
              styles.requestsBar,
              { backgroundColor: theme.backgroundElement, borderColor: theme.border },
              pressed && styles.pressed,
            ]}>
            <View style={[styles.requestsDot, { backgroundColor: theme.primary }]} />
            <ThemedText type="smallBold" style={[styles.flex, { color: theme.primary }]}>
              {t('privateGroups.requestsBanner', { count: pendingRequests })}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t('privateGroups.review')}
            </ThemedText>
            <Icon name="chevron-right" size={16} color={theme.textSecondary} />
          </Pressable>
        )}

        {visibleMessages.length === 0 ? (
          <View style={[styles.screen, styles.centered]}>
            <ThemedText themeColor="textSecondary">{t('privateGroups.emptyChat')}</ThemedText>
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
            ListFooterComponent={loadingOlder ? <ActivityIndicator color={theme.primary} /> : null}
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
          {actionError && (
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
              replyTo ? { name: authorName(replyTo.sender_id), text: quoteText(t, replyTo) } : null
            }
            onCancelReply={() => setReplyTo(null)}
          />
        </View>
        {/* Grows with the keyboard so the text box stays visible above it. */}
        <KeyboardSpacer />
      </View>

      <ActionSheet
        visible={menuOpen}
        title={group.name}
        options={[
          {
            label: t('privateGroups.membersAndInvite'),
            onPress: () =>
              router.push({ pathname: '/private-group-members/[id]', params: { id: group.id } }),
          },
          { label: muteLabel, onPress: () => setMuteOpen(true) },
          {
            label: t('privateGroups.leave'),
            destructive: true,
            onPress: () => setConfirmLeave(true),
          },
        ]}
        onClose={() => setMenuOpen(false)}
      />
      <PhotoViewer url={viewerUrl} onClose={() => setViewerUrl(null)} />
      <MuteSheet
        visible={muteOpen}
        kind="private_group"
        chatId={group.id}
        onClose={() => setMuteOpen(false)}
        onError={() => setActionError(true)}
      />
      <ActionSheet
        visible={confirmLeave}
        title={t('privateGroups.leaveConfirmTitle', { name: group.name })}
        message={t('privateGroups.leaveConfirmBody')}
        options={[{ label: t('privateGroups.leave'), destructive: true, onPress: leave }]}
        onClose={() => setConfirmLeave(false)}
      />
      <ActionSheet
        visible={!!selected}
        title={selected ? people.get(selected.sender_id)?.first_name : undefined}
        options={
          selected
            ? [
                { label: t('chats.reply'), onPress: () => setReplyTo(selected) },
                {
                  label: t('messages.viewProfile'),
                  onPress: () => openProfile(selected.sender_id),
                },
                {
                  label: t('report.reportMessage'),
                  destructive: true,
                  onPress: () => reportMessage(selected),
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
  centerText: {
    textAlign: 'center',
  },
  // The original message, for a moment after tapping its quote.
  highlight: {
    boxShadow: '0 0 0 3px rgba(142, 106, 82, 0.45)',
  },
  headerButton: {
    paddingHorizontal: Spacing.two,
  },
  inviteBox: {
    width: '100%',
    maxWidth: 440,
    alignItems: 'center',
    gap: Spacing.three,
  },
  inviteTitle: {
    fontSize: 26,
    lineHeight: 32,
    textAlign: 'center',
  },
  inviteButtons: {
    flexDirection: 'row',
    gap: Spacing.two,
    alignSelf: 'stretch',
    marginTop: Spacing.two,
  },
  inviteButton: {
    flex: 1,
    height: 48,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginHorizontal: Spacing.three,
    marginTop: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 12,
    borderWidth: 1,
  },
  requestsDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  flex: {
    flex: 1,
  },
  eventRow: {
    alignSelf: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    maxWidth: '85%',
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
    borderColor: '#EFE7DE',
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
  bold: {
    fontWeight: 700,
  },
  pressed: {
    opacity: 0.6,
  },
});
