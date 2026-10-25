import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Icon } from '@/components/icon';
import { RowsSkeleton } from '@/components/skeleton';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  fetchAuthors,
  fetchGroupParticipants,
  setGroupVisibility,
  type GroupParticipant,
} from '@/lib/chat';
import type { PublicProfile } from '@/types/chat';

/** How many people show before "See all". */
const FIRST_SHOWN = 10;

/**
 * The people in a district group who chose to appear, and (for members) the switch to
 * appear or not. People who hide still count in the number of members.
 */
export function GroupParticipants({
  groupId,
  memberCount,
  myUserId,
  isMember,
}: {
  groupId: string;
  memberCount: number | undefined;
  myUserId: string;
  isMember: boolean;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [participants, setParticipants] = useState<GroupParticipant[] | null>(null);
  const [people, setPeople] = useState<Map<string, PublicProfile>>(new Map());
  const [showAll, setShowAll] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(
    async (isCurrent: () => boolean = () => true) => {
      try {
        const found = await fetchGroupParticipants(groupId);
        const profiles = await fetchAuthors(found.map((p) => p.user_id));
        if (!isCurrent()) return;
        setParticipants(found);
        setPeople(profiles);
      } catch {
        if (isCurrent()) setError(true);
      }
    },
    [groupId]
  );

  // Reload when you join or leave (you appear in or disappear from the list).
  useEffect(() => {
    let current = true;
    void (async () => {
      await load(() => current);
    })();
    return () => {
      current = false;
    };
  }, [load, isMember]);

  const me = participants?.find((p) => p.user_id === myUserId);
  const visibleToOthers = me?.show_in_members ?? true;
  // Everyone in the list except you if you're hidden; the rest prefer not to appear.
  const shownCount = (participants ?? []).filter(
    (p) => p.user_id !== myUserId || p.show_in_members
  ).length;
  const hiddenCount = Math.max(0, (memberCount ?? 0) - shownCount);

  async function toggleVisible(visible: boolean) {
    setSaving(true);
    setError(false);
    try {
      await setGroupVisibility(groupId, visible);
      await load();
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  const list = participants ?? [];
  const shown = showAll ? list : list.slice(0, FIRST_SHOWN);

  return (
    <View style={styles.section}>
      <ThemedText style={styles.title}>{t('participants.title')}</ThemedText>

      {isMember && (
        <View
          style={[
            styles.toggleRow,
            { borderColor: theme.border, backgroundColor: theme.backgroundElement },
          ]}>
          <View style={styles.flex}>
            <ThemedText style={styles.bold}>{t('participants.showMe')}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {visibleToOthers ? t('participants.showMeOn') : t('participants.showMeOff')}
            </ThemedText>
          </View>
          <Switch
            value={visibleToOthers}
            disabled={saving || !participants}
            onValueChange={toggleVisible}
            trackColor={{ true: theme.primary, false: theme.borderStrong }}
            thumbColor="#FFFFFF"
            accessibilityLabel={t('participants.showMe')}
          />
        </View>
      )}

      {error && (
        <ThemedText type="small" style={{ color: theme.danger }}>
          {t('messages.actionError')}
        </ThemedText>
      )}

      {!participants && !error ? (
        <RowsSkeleton count={3} />
      ) : list.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          {t('participants.empty')}
        </ThemedText>
      ) : (
        <View style={[styles.list, { borderColor: theme.border }]}>
          {shown.map((participant, index) => {
            const person = people.get(participant.user_id);
            const isMe = participant.user_id === myUserId;
            return (
              <Pressable
                key={participant.user_id}
                accessibilityRole="link"
                onPress={() =>
                  router.push({ pathname: '/user/[id]', params: { id: participant.user_id } })
                }
                style={({ pressed }) => [
                  styles.row,
                  { backgroundColor: theme.backgroundElement },
                  index > 0 && { borderTopWidth: 1, borderTopColor: theme.border },
                  pressed && styles.pressed,
                ]}>
                <Avatar
                  uri={person?.avatar_url ?? null}
                  name={person?.first_name ?? '?'}
                  size={40}
                />
                <View style={styles.flex}>
                  <ThemedText style={styles.bold} numberOfLines={1}>
                    {isMe ? t('participants.you') : (person?.first_name ?? '…')}
                    {person && !isMe ? `, ${person.age}` : ''}
                  </ThemedText>
                  {isMe && !participant.show_in_members ? (
                    <ThemedText type="small" themeColor="textSecondary">
                      {t('participants.hiddenYou')}
                    </ThemedText>
                  ) : person?.occupation ? (
                    <ThemedText type="small" themeColor="textSecondary">
                      {t(`profileSetup.options.occupation.${person.occupation}`)}
                    </ThemedText>
                  ) : null}
                </View>
                <Icon name="chevron-right" size={18} color={theme.textSecondary} />
              </Pressable>
            );
          })}
        </View>
      )}

      {!showAll && list.length > FIRST_SHOWN && (
        <Pressable
          accessibilityRole="button"
          onPress={() => setShowAll(true)}
          hitSlop={8}
          style={styles.link}>
          <ThemedText type="smallBold" style={{ color: theme.primary }}>
            {t('participants.seeAll', { count: list.length })}
          </ThemedText>
        </Pressable>
      )}
      {hiddenCount > 0 && participants && (
        <ThemedText type="small" themeColor="textSecondary">
          {t('participants.hidden', { count: hiddenCount })}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.two,
  },
  title: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: 700,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderWidth: 1,
    borderRadius: 14,
    padding: Spacing.three,
  },
  list: {
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  flex: {
    flex: 1,
  },
  bold: {
    fontWeight: 700,
  },
  link: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.one,
  },
  pressed: {
    opacity: 0.7,
  },
});
