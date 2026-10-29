import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { ChipRow, type Chip } from '@/components/filter-chips';
import { ListingCardsSkeleton } from '@/components/skeleton';
import { SortSheet } from '@/components/sort-sheet';
import { PressableLink } from '@/components/pressable-link';
import { ListingCard } from '@/components/listing-card';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';
import { fetchAuthors } from '@/lib/chat';
import { sortListings, type ListingSort } from '@/lib/listing-sort';
import { fetchListings } from '@/lib/listings';
import type { ChatGroup, PublicProfile } from '@/types/chat';
import { LISTING_TYPES, type Listing, type ListingType } from '@/types/listing';

/**
 * The "Listings" tab inside a group chat: every active listing for the group's place
 * (or the whole city for the city-wide group), so they don't get lost in the chat.
 * Chips separate rooms, people looking and whole flats; "Sort" changes the order.
 */
export function GroupListings({ group }: { group: ChatGroup }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [listings, setListings] = useState<Listing[] | null>(null);
  const [owners, setOwners] = useState<Map<string, PublicProfile>>(new Map());
  const [loadError, setLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [type, setType] = useState<ListingType | null>(null);
  const [sort, setSort] = useState<ListingSort>('recommended');
  const [sortOpen, setSortOpen] = useState(false);
  const { profile: me } = useProfile();

  const { city_id: cityId, area_id: areaId } = group;

  // Applies a loaded result, unless the screen has moved on (`isCurrent` returns false).
  const load = useCallback(
    async (isCurrent: () => boolean = () => true) => {
      try {
        const found = await fetchListings({ cityId, type: null, areaId, maxPrice: null, sort });
        const foundOwners = await fetchAuthors(found.map((listing) => listing.user_id));
        if (!isCurrent()) return;
        setOwners(foundOwners);
        setListings(found);
        setLoadError(false);
      } catch {
        if (isCurrent()) setLoadError(true);
      }
    },
    [cityId, areaId, sort]
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

  const shown = useMemo(
    () =>
      listings
        ? sortListings(
            type ? listings.filter((listing) => listing.type === type) : listings,
            sort,
            { me, owners }
          )
        : null,
    [listings, type, sort, me, owners]
  );

  const chips: Chip[] = [
    {
      key: 'sort',
      label: t(`listings.sort.options.${sort}`),
      icon: 'sort',
      selected: sort !== 'recommended',
      outlined: true,
      onPress: () => setSortOpen(true),
    },
    {
      key: 'all',
      label: t('listings.filters.all'),
      selected: type === null,
      onPress: () => setType(null),
    },
    ...LISTING_TYPES.map((option) => ({
      key: option,
      label: t(`listings.filters.types.${option}`),
      selected: type === option,
      onPress: () => setType(option),
    })),
  ];

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
      {listings && listings.length > 0 && <ChipRow chips={chips} />}
      {!listings && !loadError && <ListingCardsSkeleton count={2} />}
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
          <PressableLink href="/publish" accessibilityRole="link" hitSlop={8}>
            <ThemedText type="smallBold" style={{ color: theme.primary }}>
              + {t('tabs.publish')}
            </ThemedText>
          </PressableLink>
        </View>
      )}
      {listings && listings.length > 0 && shown?.length === 0 && (
        <ThemedText themeColor="textSecondary" style={[styles.centered, styles.noneOfType]}>
          {t('listings.empty')}
        </ThemedText>
      )}
      {shown?.map((listing) => (
        <ListingCard key={listing.id} listing={listing} owner={owners.get(listing.user_id)} />
      ))}
      <SortSheet
        visible={sortOpen}
        value={sort}
        onChange={setSort}
        onClose={() => setSortOpen(false)}
      />
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
  noneOfType: {
    paddingVertical: Spacing.four,
  },
});
