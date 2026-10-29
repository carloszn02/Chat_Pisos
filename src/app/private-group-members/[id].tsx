import * as ImagePicker from 'expo-image-picker';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Switch, View } from 'react-native';

import { RowsSkeleton } from '@/components/skeleton';
import { ActionSheet } from '@/components/action-sheet';
import { Avatar } from '@/components/avatar';
import { ConnectionPicker } from '@/components/connection-picker';
import { PrivateGroupBadge } from '@/components/private-group-row';
import { ScreenScrollView } from '@/components/screen-scroll-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useSession } from '@/hooks/use-session';
import { useShare } from '@/hooks/use-share';
import { useTheme } from '@/hooks/use-theme';
import { fetchAuthors } from '@/lib/chat';
import { appUrl } from '@/lib/links';
import {
  changePrivateGroupPhoto,
  fetchJoinRequests,
  fetchPrivateGroup,
  fetchPrivateGroupMembers,
  getPrivateGroupLink,
  inviteErrorKey,
  inviteToPrivateGroup,
  PRIVATE_GROUP_MAX_PEOPLE,
  removeFromPrivateGroup,
  respondToJoinRequest,
  setPrivateGroupLink,
} from '@/lib/private-groups';
import { supabase } from '@/lib/supabase';
import type { JoinRequest, PrivateGroup, PrivateGroupMember, PublicProfile } from '@/types/chat';

type Loaded = {
  group: PrivateGroup | null;
  members: PrivateGroupMember[];
  requests: JoinRequest[];
  people: Map<string, PublicProfile>;
};

/**
 * Members of a private group, join requests from the invite link, the link itself,
 * removing people and inviting more.
 */
export default function PrivateGroupMembersScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const theme = useTheme();
  const { session } = useSession();
  const userId = session?.user.id;
  const { share, toast } = useShare();

  const [data, setData] = useState<Loaded | null>(null);
  const [toInvite, setToInvite] = useState<string[]>([]);
  const [toRemove, setToRemove] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [answering, setAnswering] = useState<string | null>(null);
  const [linkBusy, setLinkBusy] = useState(false);
  const [error, setError] = useState<'notConnected' | 'groupFull' | 'generic' | null>(null);
  const [invited, setInvited] = useState(false);
  const [photoMenu, setPhotoMenu] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState(false);

  // Applies a loaded result, unless the screen has moved on (`isCurrent` returns false).
  const load = useCallback(
    async (isCurrent: () => boolean = () => true) => {
      if (!id) return;
      try {
        const [group, members, requests] = await Promise.all([
          fetchPrivateGroup(id),
          fetchPrivateGroupMembers(id),
          fetchJoinRequests(id),
        ]);
        const people = await fetchAuthors([
          ...members.map((m) => m.user_id),
          ...requests.map((r) => r.user_id),
        ]);
        if (!isCurrent()) return;
        setData({ group, members, requests, people });
      } catch {
        if (isCurrent()) setError('generic');
      }
    },
    [id]
  );

  useEffect(() => {
    let current = true;
    void (async () => {
      await load(() => current);
    })();
    return () => {
      current = false;
    };
  }, [load]);

  // Someone else accepting a request, joining or leaving updates the lists.
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`private-group-members:${id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'private_group_members',
          filter: `group_id=eq.${id}`,
        },
        () => {
          void load();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, load]);

  const members = data?.members ?? [];
  const requests = data?.requests ?? [];
  const people = data?.people ?? new Map<string, PublicProfile>();
  const group = data?.group;
  const isOwner = members.some((m) => m.user_id === userId && m.role === 'owner');
  const freePlaces = PRIVATE_GROUP_MAX_PEOPLE - members.length;

  const isMember = members.some((m) => m.user_id === userId && m.status === 'member');

  async function changePhoto(pick: boolean) {
    if (!group) return;
    let asset: ImagePicker.ImagePickerAsset | null = null;
    if (pick) {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      if (result.canceled) return;
      asset = result.assets[0];
    }
    setPhotoBusy(true);
    setPhotoError(false);
    try {
      await changePrivateGroupPhoto(group, asset);
      await load();
    } catch {
      setPhotoError(true);
    } finally {
      setPhotoBusy(false);
    }
  }

  async function invite() {
    if (!id || toInvite.length === 0) return;
    setBusy(true);
    setError(null);
    setInvited(false);
    try {
      await inviteToPrivateGroup(id, toInvite);
      setToInvite([]);
      setInvited(true);
      await load();
    } catch (inviteError) {
      setError(inviteErrorKey(inviteError));
    } finally {
      setBusy(false);
    }
  }

  async function remove(memberId: string) {
    if (!id) return;
    setError(null);
    try {
      await removeFromPrivateGroup(id, memberId);
      await load();
    } catch {
      setError('generic');
    }
  }

  async function answer(personId: string, accept: boolean) {
    if (!id) return;
    setAnswering(personId);
    setError(null);
    try {
      await respondToJoinRequest(id, personId, accept);
      await load();
    } catch (answerError) {
      setError(inviteErrorKey(answerError));
      await load();
    } finally {
      setAnswering(null);
    }
  }

  async function shareInviteLink() {
    if (!id || !group) return;
    setLinkBusy(true);
    setError(null);
    try {
      const token = await getPrivateGroupLink(id);
      await share(t('share.privateGroupMessage', { name: group.name }), appUrl(`/join/${token}`));
    } catch {
      setError('generic');
    } finally {
      setLinkBusy(false);
    }
  }

  /** Turn the link on/off. `renew` turns it off and on again, so the old link stops working. */
  async function changeLink(enabled: boolean, renew = false) {
    if (!id) return;
    setLinkBusy(true);
    setError(null);
    try {
      if (renew) await setPrivateGroupLink(id, false);
      await setPrivateGroupLink(id, enabled);
      await load();
    } catch {
      setError('generic');
    } finally {
      setLinkBusy(false);
    }
  }

  if (!data) {
    return (
      <ThemedView style={[styles.screen, styles.centered]}>
        <Stack.Screen options={{ title: t('privateGroups.members') }} />
        {error ? (
          <ThemedText themeColor="textSecondary">{t('privateGroups.errors.generic')}</ThemedText>
        ) : (
          <View style={styles.skeleton}>
            <RowsSkeleton count={4} />
          </View>
        )}
      </ThemedView>
    );
  }

  const linkEnabled = group?.invite_link_enabled ?? false;

  return (
    <ThemedView style={styles.screen}>
      <Stack.Screen options={{ title: t('privateGroups.members') }} />
      <ScreenScrollView>
        <View style={styles.content}>
          {group && (
            <View style={styles.groupHeader}>
              <PrivateGroupBadge name={group.name} photoUrl={group.photo_url} size={96} zoomable />
              <ThemedText type="subtitle" style={styles.groupName}>
                {group.name}
              </ThemedText>
              {isMember && (
                <>
                  <Pressable
                    accessibilityRole="button"
                    disabled={photoBusy}
                    onPress={() => (group.photo_url ? setPhotoMenu(true) : changePhoto(true))}
                    hitSlop={8}
                    style={({ pressed }) => (pressed || photoBusy) && styles.pressed}>
                    {photoBusy ? (
                      <ActivityIndicator color={theme.primary} />
                    ) : (
                      <ThemedText type="smallBold" style={{ color: theme.primary }}>
                        {group.photo_url
                          ? t('privateGroups.groupPhoto.change')
                          : t('privateGroups.groupPhoto.add')}
                      </ThemedText>
                    )}
                  </Pressable>
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('privateGroups.groupPhoto.hint')}
                  </ThemedText>
                </>
              )}
              {photoError && (
                <ThemedText type="small" style={{ color: theme.danger }}>
                  {t('privateGroups.groupPhoto.error')}
                </ThemedText>
              )}
            </View>
          )}

          {error && (
            <ThemedText
              type="small"
              style={{ color: theme.danger }}
              accessibilityLiveRegion="polite">
              {t(`privateGroups.errors.${error}`)}
            </ThemedText>
          )}

          {requests.length > 0 && (
            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>
                {t('privateGroups.requestsTitle', { count: requests.length })}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {t('privateGroups.requestsHint')}
              </ThemedText>
              <View style={[styles.list, { borderColor: theme.border }]}>
                {requests.map((request, index) => {
                  const person = people.get(request.user_id);
                  const isBusy = answering === request.user_id;
                  return (
                    <View
                      key={request.user_id}
                      style={[
                        styles.row,
                        { backgroundColor: theme.backgroundElement },
                        index > 0 && { borderTopWidth: 1, borderTopColor: theme.border },
                      ]}>
                      <Pressable
                        accessibilityRole="link"
                        onPress={() =>
                          router.push({ pathname: '/user/[id]', params: { id: request.user_id } })
                        }
                        style={styles.person}>
                        <Avatar
                          uri={person?.avatar_url ?? null}
                          name={person?.first_name ?? '?'}
                          size={40}
                        />
                        <View style={styles.flex}>
                          <ThemedText style={styles.bold}>
                            {person ? `${person.first_name}, ${person.age}` : '…'}
                          </ThemedText>
                          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                            {person?.occupation || t('privateGroups.seeProfile')}
                          </ThemedText>
                        </View>
                      </Pressable>
                      {isBusy ? (
                        <ActivityIndicator color={theme.primary} />
                      ) : (
                        <View style={styles.answerButtons}>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`${t('messages.decline')} ${person?.first_name ?? ''}`}
                            onPress={() => answer(request.user_id, false)}
                            hitSlop={6}
                            style={({ pressed }) => [
                              styles.smallButton,
                              { borderColor: theme.border, borderWidth: 1 },
                              pressed && styles.pressed,
                            ]}>
                            <ThemedText type="smallBold">{t('messages.decline')}</ThemedText>
                          </Pressable>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`${t('privateGroups.accept')} ${person?.first_name ?? ''}`}
                            onPress={() => answer(request.user_id, true)}
                            hitSlop={6}
                            style={({ pressed }) => [
                              styles.smallButton,
                              { backgroundColor: theme.primary },
                              pressed && styles.pressed,
                            ]}>
                            <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
                              {t('privateGroups.accept')}
                            </ThemedText>
                          </Pressable>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          <View style={styles.section}>
            <ThemedText type="small" themeColor="textSecondary">
              {t('privateGroups.peopleCount', {
                count: members.length,
                max: PRIVATE_GROUP_MAX_PEOPLE,
              })}
            </ThemedText>

            <View style={[styles.list, { borderColor: theme.border }]}>
              {members.map((member, index) => {
                const person = people.get(member.user_id);
                const isMe = member.user_id === userId;
                return (
                  <View
                    key={member.user_id}
                    style={[
                      styles.row,
                      { backgroundColor: theme.backgroundElement },
                      index > 0 && { borderTopWidth: 1, borderTopColor: theme.border },
                    ]}>
                    <Pressable
                      accessibilityRole="link"
                      disabled={isMe}
                      onPress={() =>
                        router.push({ pathname: '/user/[id]', params: { id: member.user_id } })
                      }
                      style={styles.person}>
                      <Avatar
                        uri={person?.avatar_url ?? null}
                        name={person?.first_name ?? '?'}
                        size={40}
                      />
                      <View style={styles.flex}>
                        <ThemedText style={styles.bold}>
                          {isMe
                            ? t('chats.you')
                            : person
                              ? `${person.first_name}, ${person.age}`
                              : '…'}
                        </ThemedText>
                        <ThemedText type="small" themeColor="textSecondary">
                          {member.status === 'invited'
                            ? t('privateGroups.pendingInvite')
                            : member.role === 'owner'
                              ? t('privateGroups.creator')
                              : t('privateGroups.member')}
                        </ThemedText>
                      </View>
                    </Pressable>
                    {isOwner && !isMe && (
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => setToRemove(member.user_id)}
                        hitSlop={8}>
                        <ThemedText type="small" style={{ color: theme.danger }}>
                          {t('privateGroups.remove')}
                        </ThemedText>
                      </Pressable>
                    )}
                  </View>
                );
              })}
            </View>
          </View>

          <View
            style={[
              styles.linkCard,
              { backgroundColor: theme.backgroundElement, borderColor: theme.border },
            ]}>
            <View style={styles.linkHeader}>
              <View style={styles.flex}>
                <ThemedText style={styles.bold}>{t('privateGroups.linkTitle')}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {linkEnabled ? t('privateGroups.linkHint') : t('privateGroups.linkOff')}
                </ThemedText>
              </View>
              {isOwner && (
                <Switch
                  accessibilityLabel={t('privateGroups.linkTitle')}
                  value={linkEnabled}
                  disabled={linkBusy}
                  onValueChange={(value) => changeLink(value)}
                  trackColor={{ true: theme.primary, false: theme.border }}
                  thumbColor="#FFFFFF"
                />
              )}
            </View>
            {linkEnabled && freePlaces > 0 && (
              <Pressable
                accessibilityRole="button"
                disabled={linkBusy}
                onPress={shareInviteLink}
                style={({ pressed }) => [
                  styles.primaryButton,
                  { backgroundColor: theme.primary },
                  (pressed || linkBusy) && styles.pressed,
                ]}>
                {linkBusy ? (
                  <ActivityIndicator color={theme.onPrimary} />
                ) : (
                  <ThemedText style={[styles.bold, { color: theme.onPrimary }]}>
                    {t('privateGroups.shareLink')}
                  </ThemedText>
                )}
              </Pressable>
            )}
            {isOwner && linkEnabled && (
              <Pressable
                accessibilityRole="button"
                disabled={linkBusy}
                onPress={() => changeLink(true, true)}
                hitSlop={8}
                style={styles.renew}>
                <ThemedText type="small" themeColor="textSecondary">
                  {t('privateGroups.renewLink')}
                </ThemedText>
              </Pressable>
            )}
          </View>

          {freePlaces > 0 && (
            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>{t('privateGroups.inviteMore')}</ThemedText>
              <ConnectionPicker
                selected={toInvite}
                onChange={setToInvite}
                excludeIds={[...members.map((m) => m.user_id), ...requests.map((r) => r.user_id)]}
                maxSelected={freePlaces}
              />
              {invited && (
                <ThemedText
                  type="small"
                  style={{ color: theme.primary }}
                  accessibilityLiveRegion="polite">
                  {t('privateGroups.invitationsSent')}
                </ThemedText>
              )}
              {toInvite.length > 0 && (
                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={invite}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    { backgroundColor: theme.primary },
                    (pressed || busy) && styles.pressed,
                  ]}>
                  {busy ? (
                    <ActivityIndicator color={theme.onPrimary} />
                  ) : (
                    <ThemedText style={[styles.bold, { color: theme.onPrimary }]}>
                      {t('privateGroups.sendInvites', { count: toInvite.length })}
                    </ThemedText>
                  )}
                </Pressable>
              )}
            </View>
          )}
        </View>
      </ScreenScrollView>

      <ActionSheet
        visible={!!toRemove}
        title={t('privateGroups.removeConfirm', {
          name: people.get(toRemove ?? '')?.first_name ?? '',
        })}
        options={
          toRemove
            ? [
                {
                  label: t('privateGroups.remove'),
                  destructive: true,
                  onPress: () => remove(toRemove),
                },
              ]
            : []
        }
        onClose={() => setToRemove(null)}
      />
      <ActionSheet
        visible={photoMenu}
        title={t('privateGroups.groupPhoto.title')}
        options={[
          { label: t('privateGroups.groupPhoto.choose'), onPress: () => changePhoto(true) },
          {
            label: t('privateGroups.groupPhoto.remove'),
            destructive: true,
            onPress: () => changePhoto(false),
          },
        ]}
        onClose={() => setPhotoMenu(false)}
      />
      {toast}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  groupHeader: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  groupName: {
    fontSize: 24,
    lineHeight: 30,
    textAlign: 'center',
  },
  screen: {
    flex: 1,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  skeleton: {
    alignSelf: 'stretch',
    width: '100%',
    maxWidth: MaxContentWidth,
    marginHorizontal: 'auto',
    padding: Spacing.four,
    flex: 1,
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    padding: Spacing.four,
    gap: Spacing.four,
  },
  section: {
    gap: Spacing.three,
  },
  list: {
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  person: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minWidth: 0,
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  bold: {
    fontWeight: 700,
  },
  answerButtons: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  smallButton: {
    height: 34,
    paddingHorizontal: Spacing.three,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  linkHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  renew: {
    alignSelf: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: 700,
  },
  primaryButton: {
    height: 48,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});
