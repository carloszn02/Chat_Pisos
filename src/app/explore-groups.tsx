import { Link, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import { DistrictCard } from '@/components/district-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { usePlaces } from '@/hooks/use-places';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { byActivity, fetchGroups, fetchGroupStats, fetchMyGroupIds, joinGroup } from '@/lib/chat';
import type { ChatGroup, GroupStats } from '@/types/chat';

const GAP = Spacing.three;

/** "Lavapiés" and "lavapies" match. */
function simplify(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/**
 * All the district group chats of the current city, busiest first, with a search box,
 * plus the way to ask for new ones. This is where exploring other cities will also live.
 */
export default function ExploreGroupsScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const { session } = useSession();
  const userId = session?.user.id;
  const { city, areaById } = usePlaces();

  const [groups, setGroups] = useState<ChatGroup[] | null>(null);
  const [myGroupIds, setMyGroupIds] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState<Map<string, GroupStats>>(new Map());
  const [joining, setJoining] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const [all, mine, numbers] = await Promise.all([
        fetchGroups(),
        fetchMyGroupIds(userId),
        fetchGroupStats().catch(() => new Map<string, GroupStats>()),
      ]);
      setGroups(all);
      setMyGroupIds(mine);
      setStats(numbers);
      setError(false);
    } catch {
      setError(true);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function join(group: ChatGroup) {
    setJoining(group.id);
    try {
      await joinGroup(group.id);
      setMyGroupIds((current) => new Set([...current, group.id]));
    } catch {
      setError(true);
    } finally {
      setJoining(null);
    }
  }

  // Two cards per row on phones, three on wider screens.
  const contentWidth = Math.min(width, MaxContentWidth) - Spacing.four * 2;
  const columns = contentWidth >= 560 ? 3 : 2;
  const cardWidth = Math.floor((contentWidth - GAP * (columns - 1)) / columns);

  // Search by the group's name, the official name and the district it belongs to.
  const query = simplify(search);
  const cityGroups = (groups ?? [])
    .filter((g) => g.city_id === city?.id)
    .filter((g) => {
      if (!query) return true;
      const area = g.area_id ? areaById(g.area_id) : undefined;
      const parent = area?.parent_id ? areaById(area.parent_id) : undefined;
      return [g.name, area?.official_name, parent?.name].some(
        (text) => !!text && simplify(text).includes(query)
      );
    })
    .sort(byActivity(stats));

  return (
    <ThemedView style={styles.screen}>
      <Stack.Screen options={{ title: t('chats.exploreTitle', { city: city?.name ?? '' }) }} />
      <ScrollView keyboardShouldPersistTaps="handled">
        <View style={styles.content}>
          <ThemedText themeColor="textSecondary" style={styles.intro}>
            {t('chats.exploreIntro')}
          </ThemedText>

          <View
            style={[
              styles.searchBox,
              { borderColor: theme.border, backgroundColor: theme.backgroundElement },
            ]}>
            <ThemedText themeColor="textSecondary">⌕</ThemedText>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={t('chats.searchPlaceholder')}
              placeholderTextColor={theme.textSecondary}
              accessibilityLabel={t('chats.searchPlaceholder')}
              autoCorrect={false}
              returnKeyType="search"
              style={[styles.searchInput, { color: theme.text }]}
            />
            {search !== '' && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('chats.clearSearch')}
                onPress={() => setSearch('')}
                hitSlop={10}>
                <ThemedText themeColor="textSecondary">✕</ThemedText>
              </Pressable>
            )}
          </View>

          {error && (
            <ThemedText type="small" style={{ color: theme.danger }}>
              {t('chats.loadError')}
            </ThemedText>
          )}
          {!groups && !error && <ActivityIndicator color={theme.primary} />}

          {groups && cityGroups.length === 0 && (
            <ThemedText themeColor="textSecondary" style={styles.noResults}>
              {t('chats.noResults', { search })}
            </ThemedText>
          )}

          <View style={styles.grid}>
            {cityGroups.map((group) => (
              <DistrictCard
                key={group.id}
                group={group}
                stats={stats.get(group.id)}
                joined={myGroupIds.has(group.id)}
                joining={joining === group.id}
                onJoin={() => join(group)}
                width={cardWidth}
              />
            ))}
          </View>

          <Link href="/suggest-area" asChild>
            <Pressable
              accessibilityRole="link"
              style={({ pressed }) => [
                styles.suggestBox,
                { borderColor: theme.border, backgroundColor: theme.backgroundSelected },
                pressed && styles.pressed,
              ]}>
              <View style={styles.flex}>
                <ThemedText style={styles.bold}>{t('chats.suggestTitle')}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {t('chats.suggestHint')}
                </ThemedText>
              </View>
              <ThemedText style={{ color: theme.primary }}>›</ThemedText>
            </Pressable>
          </Link>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    padding: Spacing.four,
    gap: Spacing.three,
  },
  intro: {
    lineHeight: 22,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    height: 46,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    fontSize: 16,
  },
  noResults: {
    textAlign: 'center',
    marginVertical: Spacing.four,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
  },
  flex: {
    flex: 1,
  },
  bold: {
    fontWeight: 700,
  },
  suggestBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginTop: Spacing.two,
  },
  pressed: {
    opacity: 0.7,
  },
});
