import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ActionSheet } from '@/components/action-sheet';
import { Avatar } from '@/components/avatar';
import { ConnectionPicker } from '@/components/connection-picker';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { fetchAuthors } from '@/lib/chat';
import {
  fetchPrivateGroupMembers,
  inviteErrorKey,
  inviteToPrivateGroup,
  PRIVATE_GROUP_MAX_PEOPLE,
  removeFromPrivateGroup,
} from '@/lib/private-groups';
import type { PrivateGroupMember, PublicProfile } from '@/types/chat';

/** Members of a private group, pending invitations, removing people and inviting more. */
export default function PrivateGroupMembersScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const theme = useTheme();
  const { session } = useSession();
  const userId = session?.user.id;

  const [members, setMembers] = useState<PrivateGroupMember[] | null>(null);
  const [people, setPeople] = useState<Map<string, PublicProfile>>(new Map());
  const [toInvite, setToInvite] = useState<string[]>([]);
  const [toRemove, setToRemove] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<'notConnected' | 'groupFull' | 'generic' | null>(null);
  const [invited, setInvited] = useState(false);

  // Applies a loaded result, unless the screen has moved on (`isCurrent` returns false).
  const load = useCallback(
    async (isCurrent: () => boolean = () => true) => {
      if (!id) return;
      try {
        const list = await fetchPrivateGroupMembers(id);
        const found = await fetchAuthors(list.map((m) => m.user_id));
        if (!isCurrent()) return;
        setMembers(list);
        setPeople(found);
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

  const isOwner = members?.some((m) => m.user_id === userId && m.role === 'owner') ?? false;
  const freePlaces = PRIVATE_GROUP_MAX_PEOPLE - (members?.length ?? 0);

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

  if (!members) {
    return (
      <ThemedView style={[styles.screen, styles.centered]}>
        <Stack.Screen options={{ title: t('privateGroups.members') }} />
        <ActivityIndicator color={theme.primary} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.screen}>
      <Stack.Screen options={{ title: t('privateGroups.members') }} />
      <ScrollView>
        <View style={styles.content}>
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

          {freePlaces > 0 && (
            <View style={styles.inviteSection}>
              <ThemedText style={styles.sectionTitle}>{t('privateGroups.inviteMore')}</ThemedText>
              <ConnectionPicker
                selected={toInvite}
                onChange={setToInvite}
                excludeIds={members.map((m) => m.user_id)}
                maxSelected={freePlaces}
              />
              {error && (
                <ThemedText
                  type="small"
                  style={{ color: theme.danger }}
                  accessibilityLiveRegion="polite">
                  {t(`privateGroups.errors.${error}`)}
                </ThemedText>
              )}
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
      </ScrollView>

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
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    padding: Spacing.four,
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
  },
  flex: {
    flex: 1,
  },
  bold: {
    fontWeight: 700,
  },
  inviteSection: {
    gap: Spacing.three,
    marginTop: Spacing.three,
  },
  sectionTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: 700,
  },
  primaryButton: {
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});
