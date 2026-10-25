import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { ActionSheet } from '@/components/action-sheet';
import { GroupParticipants } from '@/components/group-participants';
import { GroupTile } from '@/components/group-tile';
import { MuteSheet, useMuteLabel } from '@/components/mute-sheet';
import { DetailSkeleton } from '@/components/skeleton';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { usePlaces } from '@/hooks/use-places';
import { useSession } from '@/hooks/use-session';
import { useShare } from '@/hooks/use-share';
import { useTheme } from '@/hooks/use-theme';
import {
  fetchGroupBySlug,
  fetchGroupStats,
  fetchMyGroupIds,
  joinGroup,
  leaveGroup,
} from '@/lib/chat';
import { appUrl } from '@/lib/links';
import type { ChatGroup, GroupStats } from '@/types/chat';

/**
 * A district group's page (opened by tapping its name at the top of the chat): where it
 * is, how many people are in it, how lively it is, and share / mute / leave or join.
 */
export default function GroupInfoScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { t } = useTranslation();
  const theme = useTheme();
  const { session } = useSession();
  const userId = session?.user.id;
  const { areaById } = usePlaces();
  const { share, toast } = useShare();

  const [group, setGroup] = useState<ChatGroup | null | undefined>(undefined);
  const [stats, setStats] = useState<GroupStats | undefined>(undefined);
  const [isMember, setIsMember] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [muteOpen, setMuteOpen] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const muteLabel = useMuteLabel('group', group?.id);

  const load = useCallback(
    async (isCurrent: () => boolean = () => true) => {
      if (!slug || !userId) return;
      try {
        const found = await fetchGroupBySlug(slug);
        const [mine, allStats] = await Promise.all([
          fetchMyGroupIds(userId),
          fetchGroupStats().catch(() => new Map<string, GroupStats>()),
        ]);
        if (!isCurrent()) return;
        setGroup(found);
        setIsMember(!!found && mine.has(found.id));
        setStats(found ? allStats.get(found.id) : undefined);
      } catch {
        if (isCurrent()) setGroup(null);
      }
    },
    [slug, userId]
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

  async function join() {
    if (!group) return;
    setBusy(true);
    setError(false);
    try {
      await joinGroup(group.id);
      setIsMember(true);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  async function leave() {
    if (!group || !userId) return;
    setError(false);
    try {
      await leaveGroup(group.id, userId);
      // Back to the Chats tab: the group's chat is no longer yours.
      router.replace('/');
    } catch {
      setError(true);
    }
  }

  const title = <Stack.Screen options={{ title: t('chats.groupInfo') }} />;

  if (group === undefined) {
    return (
      <ThemedView style={styles.screen}>
        {title}
        <DetailSkeleton photo={false} />
      </ThemedView>
    );
  }

  if (group === null) {
    return (
      <ThemedView style={[styles.screen, styles.centered]}>
        {title}
        <ThemedText themeColor="textSecondary">{t('chats.loadError')}</ThemedText>
      </ThemedView>
    );
  }

  const area = group.area_id ? areaById(group.area_id) : undefined;
  const parent = area?.parent_id ? areaById(area.parent_id) : undefined;
  const where = group.is_city_wide
    ? t('chats.cityWide')
    : parent
      ? `${t('chats.districtGroup')} · ${parent.name}`
      : t('chats.districtGroup');
  const activity = stats?.active_today
    ? t('chats.activeToday')
    : (stats?.messages_this_week ?? 0) > 0
      ? t('chats.activeThisWeek')
      : t('chats.quiet');

  return (
    <ThemedView style={styles.screen}>
      {title}
      <ScrollView>
        <View style={styles.content}>
          <View style={styles.hero}>
            <GroupTile group={group} size={88} />
            <ThemedText type="subtitle" style={styles.name}>
              {group.name}
            </ThemedText>
            <ThemedText themeColor="textSecondary">{where}</ThemedText>
          </View>

          <View style={[styles.stats, { borderColor: theme.border }]}>
            <View style={styles.stat}>
              <ThemedText style={styles.statValue}>{stats?.member_count ?? '–'}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {t('chats.members')}
              </ThemedText>
            </View>
            <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
            <View style={styles.stat}>
              <ThemedText style={styles.statValue}>{activity}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {t('chats.activity')}
              </ThemedText>
            </View>
          </View>

          {error && (
            <ThemedText type="small" style={{ color: theme.danger }}>
              {t('messages.actionError')}
            </ThemedText>
          )}

          <View style={[styles.list, { borderColor: theme.border }]}>
            <Row
              first
              label={t('share.shareGroup')}
              onPress={() =>
                share(t('share.groupMessage', { name: group.name }), appUrl(`/group/${group.slug}`))
              }
            />
            {isMember && <Row label={muteLabel} onPress={() => setMuteOpen(true)} />}
            {isMember ? (
              <Row label={t('chats.leave')} danger onPress={() => setConfirmLeave(true)} />
            ) : (
              <Row label={t('chats.joinGroup')} accent disabled={busy} onPress={join} />
            )}
          </View>

          {userId && (
            <GroupParticipants
              groupId={group.id}
              memberCount={stats?.member_count}
              myUserId={userId}
              isMember={isMember}
            />
          )}
        </View>
      </ScrollView>

      <MuteSheet
        visible={muteOpen}
        kind="group"
        chatId={group.id}
        onClose={() => setMuteOpen(false)}
        onError={() => setError(true)}
      />
      <ActionSheet
        visible={confirmLeave}
        title={t('chats.leaveConfirmTitle', { name: group.name })}
        message={t('chats.leaveConfirmBody')}
        options={[{ label: t('chats.leave'), destructive: true, onPress: leave }]}
        onClose={() => setConfirmLeave(false)}
      />
      {toast}
    </ThemedView>
  );
}

function Row({
  label,
  onPress,
  first = false,
  danger = false,
  accent = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  first?: boolean;
  danger?: boolean;
  accent?: boolean;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: theme.backgroundElement },
        !first && { borderTopWidth: 1, borderTopColor: theme.border },
        (pressed || disabled) && styles.pressed,
      ]}>
      <ThemedText
        style={[
          danger && { color: theme.danger },
          accent && { color: theme.primary, fontWeight: 700 },
        ]}>
        {label}
      </ThemedText>
      {!danger && !accent && <Icon name="chevron-right" size={18} color={theme.textSecondary} />}
    </Pressable>
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
    gap: Spacing.four,
  },
  hero: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  name: {
    marginTop: Spacing.two,
    textAlign: 'center',
  },
  stats: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: Spacing.three,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    fontWeight: 700,
    fontSize: 16,
  },
  statDivider: {
    width: 1,
  },
  list: {
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  row: {
    minHeight: 50,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pressed: {
    opacity: 0.7,
  },
});
