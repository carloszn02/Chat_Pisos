import { Link } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { ListingCard } from '@/components/listing-card';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { fetchAuthors } from '@/lib/chat';
import { fetchListings } from '@/lib/listings';
import type { ChatGroup, PublicProfile } from '@/types/chat';
import type { Listing } from '@/types/listing';

/**
 * The "Listings" tab inside a group chat: every active listing for the group's place
 * (or the whole city for the city-wide group), so they don't get lost in the chat.
 */
export function GroupListings({ group }: { group: ChatGroup }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [listings, setListings] = useState<Listing[] | null>(null);
  const [owners, setOwners] = useState<Map<string, PublicProfile>>(new Map());
  const [loadError, setLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const { city_id: cityId, area_id: areaId } = group;

  // Applies a loaded result, unless the screen has moved on (`isCurrent` returns false).
  const load = useCallback(
    async (isCurrent: () => boolean = () => true) => {
      try {
        const found = await fetchListings({ cityId, type: null, areaId, maxPrice: null });
        const foundOwners = await fetchAuthors(found.map((listing) => listing.user_id));
        if (!isCurrent()) return;
        setOwners(foundOwners);
        setListings(found);
        setLoadError(false);
      } catch {
        if (isCurrent()) setLoadError(true);
      }
    },
    [cityId, areaId]
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

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.primary} />
      }>
      {!listings && !loadError && <ActivityIndicator color={theme.primary} />}
      {loadError && (
        <ThemedText type="small" style={{ color: theme.danger }}>
          {t('listings.loadError')}
        </ThemedText>
      )}
      {listings?.length === 0 && (
        <View style={styles.empty}>
          <ThemedText themeColor="textSecondary" style={styles.centered}>
            {t('chats.noListingsHere', { name: group.name })}
          </ThemedText>
          <Link href="/publish" asChild>
            <Pressable accessibilityRole="link" hitSlop={8}>
              <ThemedText type="smallBold" style={{ color: theme.primary }}>
                + {t('tabs.publish')}
              </ThemedText>
            </Pressable>
          </Link>
        </View>
      )}
      {listings?.map((listing) => (
        <ListingCard key={listing.id} listing={listing} owner={owners.get(listing.user_id)} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.three,
    gap: Spacing.three,
  },
  empty: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.five,
  },
  centered: {
    textAlign: 'center',
  },
});
