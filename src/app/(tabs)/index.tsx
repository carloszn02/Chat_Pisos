import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RowsSkeleton } from '@/components/skeleton';
import { PressableLink } from '@/components/pressable-link';
import { CityBanner } from '@/components/city-banner';
import { DistrictCard } from '@/components/district-card';
import { GroupTile } from '@/components/group-tile';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useMutes } from '@/hooks/use-mutes';
import { usePlaces } from '@/hooks/use-places';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import {
  byActivity,
  fetchAuthors,
  fetchGroupPreviews,
  fetchGroups,
  fetchGroupStats,
  joinGroup,
} from '@/lib/chat';
import { formatShortTime } from '@/lib/format';
import type { ChatGroup, GroupMessage, GroupStats, PublicProfile } from '@/types/chat';

// How many districts to suggest in the "Discover" row before "See all".
const DISCOVER_COUNT = 8;
const CARD_WIDTH = 168;

type ChatsData = {
  groups: ChatGroup[];
  myGroupIds: Set<string>;
  lastMessages: Map<string, GroupMessage>;
  authors: Map<string, PublicProfile>;
  unread: Map<string, number>;
  stats: Map<string, GroupStats>;
};

export default function ChatsScreen() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const { session } = useSession();
  const userId = session?.user.id;
  const { city } = usePlaces();
  const { isMuted } = useMutes();

  const [data, setData] = useState<ChatsData | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [joining, setJoining] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const [groups, { myGroupIds, unread, lastMessages }, stats] = await Promise.all([
        fetchGroups(),
        fetchGroupPreviews(userId),
        // The numbers on the Discover cards are a nice-to-have.
        fetchGroupStats().catch(() => new Map<string, GroupStats>()),
      ]);
      const authors = await fetchAuthors([...lastMessages.values()].map((m) => m.user_id));
      setData({ groups, myGroupIds, lastMessages, authors, unread, stats });
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, [userId]);

  // Reload every time the tab is shown, so previews are fresh after visiting a chat.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function join(group: ChatGroup) {
    setJoining(group.id);
    try {
      await joinGroup(group.id);
      await load();
    } catch {
      setLoadError(true);
    } finally {
      setJoining(null);
    }
  }

  const cityGroups = data?.groups.filter((g) => g.city_id === city?.id) ?? [];
  const myGroups = cityGroups.filter((g) => data?.myGroupIds.has(g.id));
  const otherGroups = data
    ? cityGroups.filter((g) => !data.myGroupIds.has(g.id)).sort(byActivity(data.stats))
    : [];
  const discover = otherGroups.slice(0, DISCOVER_COUNT);

  function preview(group: ChatGroup): string {
    const last = data?.lastMessages.get(group.id);
    if (!last) return t('chats.noMessagesYet');
    if (last.deleted_at) return t('chats.messageDeleted');
    const author =
      last.user_id === userId
        ? t('chats.you')
        : (data?.authors.get(last.user_id)?.first_name ?? '');
    // A photo sent without text shows as "📷 Photo".
    const text = last.body || t('chats.photoPreview');
    return author ? `${author}: ${text}` : text;
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.primary} />
          }>
          <View style={styles.content}>
            <ThemedText type="subtitle" style={styles.header}>
              {t('chats.title')}
            </ThemedText>
            {city && <CityBanner city={city} subtitle={t('chats.citySubtitle')} />}

            {!data && !loadError && <RowsSkeleton count={3} shape="square" />}

            {loadError && (
              <View style={styles.errorBox}>
                <ThemedText type="small" style={{ color: theme.danger }}>
                  {t('chats.loadError')}
                </ThemedText>
                <Pressable accessibilityRole="button" onPress={load} hitSlop={12}>
                  <ThemedText type="smallBold" style={{ color: theme.primary }}>
                    {t('chats.retry')}
                  </ThemedText>
                </Pressable>
              </View>
            )}

            {data && (
              <>
                <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
                  {t('chats.yourGroups')}
                </ThemedText>
                {myGroups.length === 0 ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('chats.noGroupsYet')}
                  </ThemedText>
                ) : (
                  <View style={styles.list}>
                    {myGroups.map((group) => {
                      const last = data.lastMessages.get(group.id);
                      const unread = data.unread.get(group.id) ?? 0;
                      const muted = isMuted('group', group.id);
                      const highlight = unread > 0 && !muted;
                      return (
                        <PressableLink
                          key={group.id}
                          href={{ pathname: '/group/[slug]', params: { slug: group.slug } }}
                          accessibilityRole="link"
                          style={[styles.row]}>
                          <GroupTile group={group} />
                          <View style={styles.rowText}>
                            <ThemedText style={styles.groupName} numberOfLines={1}>
                              {group.name}
                              {muted ? <ThemedText style={styles.mutedIcon}> 🔕</ThemedText> : null}
                            </ThemedText>
                            <ThemedText
                              type={highlight ? 'smallBold' : 'small'}
                              themeColor={highlight ? 'text' : 'textSecondary'}
                              numberOfLines={1}>
                              {preview(group)}
                            </ThemedText>
                          </View>
                          <View style={styles.meta}>
                            {last && (
                              <ThemedText type="small" themeColor="textSecondary">
                                {formatShortTime(last.created_at, i18n.language)}
                              </ThemedText>
                            )}
                            {unread > 0 && (
                              <View
                                style={[
                                  styles.badge,
                                  {
                                    backgroundColor: muted
                                      ? theme.backgroundSelected
                                      : theme.primary,
                                  },
                                ]}>
                                <ThemedText
                                  style={[
                                    styles.badgeText,
                                    { color: muted ? theme.textSecondary : theme.onPrimary },
                                  ]}>
                                  {unread > 99 ? '99+' : unread}
                                </ThemedText>
                              </View>
                            )}
                          </View>
                        </PressableLink>
                      );
                    })}
                  </View>
                )}

                <View style={styles.discoverHeader}>
                  <View style={styles.rowText}>
                    <ThemedText style={styles.discoverTitle}>{t('chats.discoverTitle')}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {otherGroups.length > 0
                        ? t('chats.discoverHint', { city: city?.name ?? '' })
                        : t('chats.allJoined')}
                    </ThemedText>
                  </View>
                  <PressableLink href="/explore-groups" accessibilityRole="link" hitSlop={10}>
                    <ThemedText type="smallBold" style={{ color: theme.primary }}>
                      {t('chats.seeAll')} ›
                    </ThemedText>
                  </PressableLink>
                </View>
              </>
            )}
          </View>

          {/* Full-width row that scrolls sideways, lined up with the content above. */}
          {data && discover.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.carousel}
              contentContainerStyle={styles.carouselContent}>
              {discover.map((group) => (
                <DistrictCard
                  key={group.id}
                  group={group}
                  stats={data.stats.get(group.id)}
                  joined={false}
                  joining={joining === group.id}
                  onJoin={() => join(group)}
                  width={CARD_WIDTH}
                />
              ))}
              <PressableLink
                href="/explore-groups"
                accessibilityRole="link"
                style={[
                  styles.seeAllCard,
                  { borderColor: theme.border, backgroundColor: theme.backgroundSelected },
                ]}>
                <View style={[styles.seeAllCircle, { backgroundColor: theme.backgroundElement }]}>
                  <ThemedText style={[styles.seeAllArrow, { color: theme.primary }]}>→</ThemedText>
                </View>
                <ThemedText type="smallBold" style={styles.seeAllText}>
                  {t('chats.exploreTitle', { city: city?.name ?? '' })}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.seeAllText}>
                  {t('chats.exploreHint', { count: otherGroups.length })}
                </ThemedText>
              </PressableLink>
            </ScrollView>
          )}

          {data && (
            <View style={styles.footer}>
              <PressableLink
                href="/suggest-area"
                accessibilityRole="link"
                style={[styles.suggestRow]}>
                <ThemedText type="small" themeColor="textSecondary">
                  {t('chats.suggestTitle')}{' '}
                  <ThemedText type="smallBold" style={{ color: theme.primary }}>
                    {t('chats.suggestHint')}
                  </ThemedText>
                </ThemedText>
              </PressableLink>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scroll: {
    paddingBottom: BottomTabInset + Spacing.four,
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.six,
    gap: Spacing.two,
  },
  header: {
    marginBottom: Spacing.one,
  },
  errorBox: {
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'center',
  },
  sectionTitle: {
    marginTop: Spacing.three,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontSize: 12,
  },
  list: {
    gap: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  groupName: {
    fontWeight: 700,
  },
  mutedIcon: {
    fontSize: 12,
  },
  meta: {
    alignSelf: 'flex-start',
    alignItems: 'flex-end',
    gap: Spacing.one,
    paddingTop: 2,
  },
  badge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: 700,
  },
  discoverHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.three,
    marginTop: Spacing.four,
  },
  discoverTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: 700,
  },
  carousel: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    marginTop: Spacing.three,
  },
  carouselContent: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  seeAllCard: {
    width: CARD_WIDTH,
    borderRadius: 18,
    borderWidth: 1,
    borderStyle: 'dashed',
    padding: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
  },
  seeAllCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },
  seeAllArrow: {
    fontSize: 22,
    lineHeight: 26,
    fontWeight: 700,
  },
  seeAllText: {
    textAlign: 'center',
  },
  footer: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
  },
  suggestRow: {
    paddingVertical: Spacing.two,
  },
  pressed: {
    opacity: 0.7,
  },
});
