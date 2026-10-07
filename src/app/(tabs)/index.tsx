import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GroupTile } from '@/components/group-tile';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import {
  fetchAuthors,
  fetchGroups,
  fetchGroupUnreadCounts,
  fetchLastMessages,
  fetchMyGroupIds,
  joinGroup,
} from '@/lib/chat';
import { formatShortTime } from '@/lib/format';
import type { ChatGroup, GroupMessage, PublicProfile } from '@/types/chat';

type ChatsData = {
  groups: ChatGroup[];
  myGroupIds: Set<string>;
  lastMessages: Map<string, GroupMessage>;
  authors: Map<string, PublicProfile>;
  unread: Map<string, number>;
};

export default function ChatsScreen() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const { session } = useSession();
  const userId = session?.user.id;

  const [data, setData] = useState<ChatsData | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [joining, setJoining] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const [groups, myGroupIds, unread] = await Promise.all([
        fetchGroups(),
        fetchMyGroupIds(userId),
        fetchGroupUnreadCounts(),
      ]);
      const lastMessages = await fetchLastMessages([...myGroupIds]);
      const authors = await fetchAuthors([...lastMessages.values()].map((m) => m.user_id));
      setData({ groups, myGroupIds, lastMessages, authors, unread });
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

  const myGroups = data?.groups.filter((g) => data.myGroupIds.has(g.id)) ?? [];
  const otherGroups = data?.groups.filter((g) => !data.myGroupIds.has(g.id)) ?? [];

  function preview(group: ChatGroup): string {
    const last = data?.lastMessages.get(group.id);
    if (!last) return t('chats.noMessagesYet');
    const author =
      last.user_id === userId ? t('chats.you') : (data?.authors.get(last.user_id)?.first_name ?? '');
    return author ? `${author}: ${last.body}` : last.body;
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.primary} />}>
          <View style={styles.content}>
            <View style={styles.header}>
              <ThemedText type="subtitle">{t('chats.title')}</ThemedText>
              <View style={[styles.cityPill, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
                <ThemedText type="smallBold">{t('chats.city')}</ThemedText>
              </View>
            </View>

            {!data && !loadError && <ActivityIndicator color={theme.primary} style={styles.loader} />}

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
                      return (
                        <Link key={group.id} href={{ pathname: '/group/[slug]', params: { slug: group.slug } }} asChild>
                          <Pressable accessibilityRole="link" style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
                            <GroupTile group={group} />
                            <View style={styles.rowText}>
                              <ThemedText style={styles.groupName}>{group.name}</ThemedText>
                              <ThemedText
                                type={unread > 0 ? 'smallBold' : 'small'}
                                themeColor={unread > 0 ? 'text' : 'textSecondary'}
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
                                <View style={[styles.badge, { backgroundColor: theme.primary }]}>
                                  <ThemedText style={[styles.badgeText, { color: theme.onPrimary }]}>
                                    {unread > 99 ? '99+' : unread}
                                  </ThemedText>
                                </View>
                              )}
                            </View>
                          </Pressable>
                        </Link>
                      );
                    })}
                  </View>
                )}

                {otherGroups.length > 0 && (
                  <>
                    <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
                      {t('chats.popularDistricts')}
                    </ThemedText>
                    <View style={styles.list}>
                      {otherGroups.map((group) => (
                        <View key={group.id} style={styles.row}>
                          <Link href={{ pathname: '/group/[slug]', params: { slug: group.slug } }} asChild>
                            <Pressable accessibilityRole="link" style={({ pressed }) => [styles.rowLink, pressed && styles.pressed]}>
                              <GroupTile group={group} />
                              <View style={styles.rowText}>
                                <ThemedText style={styles.groupName}>{group.name}</ThemedText>
                                <ThemedText type="small" themeColor="textSecondary">
                                  {group.is_city_wide ? t('chats.cityWide') : t('chats.districtGroup')}
                                </ThemedText>
                              </View>
                            </Pressable>
                          </Link>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`${t('chats.join')} ${group.name}`}
                            disabled={joining === group.id}
                            onPress={() => join(group)}
                            style={({ pressed }) => [
                              styles.joinButton,
                              { borderColor: theme.primary },
                              (pressed || joining === group.id) && styles.pressed,
                            ]}>
                            <ThemedText type="smallBold" style={{ color: theme.primary }}>
                              {t('chats.join')}
                            </ThemedText>
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  </>
                )}
              </>
            )}
          </View>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.two,
  },
  cityPill: {
    height: 36,
    paddingHorizontal: Spacing.three,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
  },
  loader: {
    marginTop: Spacing.five,
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
  rowLink: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  groupName: {
    fontWeight: 700,
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
  joinButton: {
    height: 36,
    paddingHorizontal: Spacing.three,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});
