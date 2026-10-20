import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { TileInitials, useGroupTint } from '@/components/group-tile';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { usePlaces } from '@/hooks/use-places';
import { useTheme } from '@/hooks/use-theme';
import type { ChatGroup, GroupStats } from '@/types/chat';

type DistrictCardProps = {
  group: ChatGroup;
  stats: GroupStats | undefined;
  joined: boolean;
  joining: boolean;
  onJoin: () => void;
  width: number;
};

/**
 * A district group to discover: its colour and initials, where it is, how many people
 * are in it and how lively it is, with a Join button. Tapping the card opens the chat
 * (you can read before joining).
 */
export function DistrictCard({ group, stats, joined, joining, onJoin, width }: DistrictCardProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const tint = useGroupTint(group);
  const { areaById } = usePlaces();

  const area = group.area_id ? areaById(group.area_id) : undefined;
  const parent = area?.parent_id ? areaById(area.parent_id) : undefined;
  const where = group.is_city_wide
    ? t('chats.cityWide')
    : parent
      ? parent.name
      : t('chats.district');

  const activeToday = stats?.active_today ?? false;
  const weekly = stats?.messages_this_week ?? 0;
  const activity = activeToday
    ? t('chats.activeToday')
    : weekly > 0
      ? t('chats.activeThisWeek')
      : t('chats.quiet');

  return (
    <View
      style={[
        styles.card,
        { width, backgroundColor: theme.backgroundElement, borderColor: theme.border },
      ]}>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`${group.name}, ${where}`}
        onPress={() => router.push({ pathname: '/group/[slug]', params: { slug: group.slug } })}
        style={({ pressed }) => pressed && styles.pressed}>
        <View style={[styles.band, { backgroundColor: tint.background }]}>
          <TileInitials text={group.short_code} color={tint.text} size={24} />
          {stats && stats.member_count > 0 && (
            <View style={[styles.members, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText style={[styles.membersText, { color: tint.text }]}>
                {t('chats.memberCount', { count: stats.member_count })}
              </ThemedText>
            </View>
          )}
        </View>

        <View style={styles.body}>
          <ThemedText style={styles.name} numberOfLines={1}>
            {group.name}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {where}
          </ThemedText>
          <View style={styles.activityRow}>
            <View
              style={[
                styles.dot,
                {
                  backgroundColor: activeToday
                    ? '#2E9D6A'
                    : weekly > 0
                      ? '#D9A441'
                      : theme.borderStrong,
                },
              ]}
            />
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {activity}
            </ThemedText>
          </View>
        </View>
      </Pressable>

      <View style={styles.footer}>
        {joined ? (
          <View style={[styles.joined, { backgroundColor: theme.tile }]}>
            <Icon name="check" size={16} color={theme.onTile} strokeWidth={2.2} />
            <ThemedText type="smallBold" style={{ color: theme.onTile }}>
              {t('chats.joined')}
            </ThemedText>
          </View>
        ) : (
          <Button
            label={t('chats.join')}
            accessibilityLabel={`${t('chats.join')} ${group.name}`}
            variant="secondary"
            size="small"
            loading={joining}
            onPress={onJoin}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  band: {
    height: 64,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    justifyContent: 'flex-start',
  },
  members: {
    position: 'absolute',
    top: Spacing.three,
    right: Spacing.two,
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
  },
  membersText: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: 700,
  },
  body: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    gap: 2,
  },
  footer: {
    padding: Spacing.three,
    paddingTop: Spacing.two,
  },
  name: {
    fontWeight: 700,
    fontSize: 16,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.one,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  joined: {
    minHeight: 36,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
  },
  pressed: {
    opacity: 0.7,
  },
});
