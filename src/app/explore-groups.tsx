import { Link, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { GroupTile } from '@/components/group-tile';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { usePlaces } from '@/hooks/use-places';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { fetchGroups, fetchMyGroupIds, joinGroup } from '@/lib/chat';
import type { ChatGroup } from '@/types/chat';

/**
 * The district group chats of the current city you haven't joined yet, plus the way to
 * ask for new ones. This is where exploring other cities will also live.
 */
export default function ExploreGroupsScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { session } = useSession();
  const userId = session?.user.id;
  const { city } = usePlaces();

  const [groups, setGroups] = useState<ChatGroup[] | null>(null);
  const [myGroupIds, setMyGroupIds] = useState<Set<string>>(new Set());
  const [joining, setJoining] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const [all, mine] = await Promise.all([fetchGroups(), fetchMyGroupIds(userId)]);
      setGroups(all);
      setMyGroupIds(mine);
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

  const cityGroups = (groups ?? []).filter((g) => g.city_id === city?.id);

  return (
    <ThemedView style={styles.screen}>
      <Stack.Screen options={{ title: t('chats.exploreTitle', { city: city?.name ?? '' }) }} />
      <ScrollView>
        <View style={styles.content}>
          <ThemedText themeColor="textSecondary" style={styles.intro}>
            {t('chats.exploreIntro')}
          </ThemedText>

          {error && (
            <ThemedText type="small" style={{ color: theme.danger }}>
              {t('chats.loadError')}
            </ThemedText>
          )}
          {!groups && !error && <ActivityIndicator color={theme.primary} />}

          {cityGroups.map((group) => {
            const joined = myGroupIds.has(group.id);
            return (
              <View key={group.id} style={styles.row}>
                <Link href={{ pathname: '/group/[slug]', params: { slug: group.slug } }} asChild>
                  <Pressable
                    accessibilityRole="link"
                    style={({ pressed }) => [styles.rowLink, pressed && styles.pressed]}>
                    <GroupTile group={group} />
                    <View style={styles.rowText}>
                      <ThemedText style={styles.bold}>{group.name}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {group.is_city_wide ? t('chats.cityWide') : t('chats.districtGroup')}
                      </ThemedText>
                    </View>
                  </Pressable>
                </Link>
                {joined ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('chats.joined')}
                  </ThemedText>
                ) : (
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
                )}
              </View>
            );
          })}

          <Link href="/suggest-area" asChild>
            <Pressable
              accessibilityRole="link"
              style={({ pressed }) => [
                styles.suggestBox,
                { borderColor: theme.border, backgroundColor: theme.backgroundElement },
                pressed && styles.pressed,
              ]}>
              <View style={styles.rowText}>
                <ThemedText style={styles.bold}>{t('chats.suggestTitle')}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {t('chats.suggestHint')}
                </ThemedText>
              </View>
              <ThemedText themeColor="textSecondary">›</ThemedText>
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
    gap: Spacing.two,
  },
  intro: {
    lineHeight: 22,
    marginBottom: Spacing.two,
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
  bold: {
    fontWeight: 700,
  },
  joinButton: {
    height: 36,
    paddingHorizontal: Spacing.three,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
  },
  suggestBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: Spacing.four,
  },
  pressed: {
    opacity: 0.7,
  },
});
