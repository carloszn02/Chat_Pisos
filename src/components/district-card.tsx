import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { useGroupTint } from '@/components/group-tile';
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
          <ThemedText style={[styles.bandCode, { color: tint.text }]}>
            {group.short_code}
          </ThemedText>
          {stats && stats.member_count > 0 && (
            <View style={styles.members}>
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
                  backgroundColor: activeToday ? '#2E9D6A' : weekly > 0 ? '#D9A441' : theme.border,
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
          <View style={[styles.joinButton, { backgroundColor: theme.backgroundSelected }]}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              ✓ {t('chats.joined')}
            </ThemedText>
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${t('chats.join')} ${group.name}`}
            disabled={joining}
            onPress={onJoin}
            style={({ pressed }) => [
              styles.joinButton,
              { backgroundColor: theme.primary },
              (pressed || joining) && styles.pressed,
            ]}>
            {joining ? (
              <ActivityIndicator color={theme.onPrimary} size="small" />
            ) : (
              <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
                {t('chats.join')}
              </ThemedText>
            )}
          </Pressable>
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
    height: 72,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.one,
    justifyContent: 'flex-end',
  },
  bandCode: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: 700,
    letterSpacing: 0.5,
  },
  members: {
    position: 'absolute',
    top: Spacing.two,
    right: Spacing.two,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
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
  joinButton: {
    height: 34,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});
