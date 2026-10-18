import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ListingCard, ListingMiniCard } from '@/components/listing-card';
import { ListingsMap } from '@/components/listings-map';
import { SegmentedControl } from '@/components/segmented-control';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AppFonts, BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { usePlaces } from '@/hooks/use-places';
import { useSaved } from '@/hooks/use-saved';
import { useTheme } from '@/hooks/use-theme';
import { fetchAuthors } from '@/lib/chat';
import { formatPrice } from '@/lib/format';
import { fetchListings, fetchListingsByIds, type ListingFilters } from '@/lib/listings';
import type { ListingPin, MapBounds } from '@/lib/map';
import type { PublicProfile } from '@/types/chat';
import { LISTING_TYPES, type Listing, type ListingType } from '@/types/listing';

type Chip = { key: string; label: string; selected: boolean; onPress: () => void };

function ChipRow({ chips }: { chips: Chip[] }) {
  const theme = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipRow}>
      {chips.map((chip) => (
        <Pressable
          key={chip.key}
          accessibilityRole="button"
          accessibilityState={{ selected: chip.selected }}
          onPress={chip.onPress}
          style={({ pressed }) => [
            styles.chip,
            {
              borderColor: chip.selected ? theme.text : theme.border,
              backgroundColor: chip.selected ? theme.text : theme.backgroundElement,
            },
            pressed && styles.pressed,
          ]}>
          <ThemedText type="small" style={{ color: chip.selected ? theme.background : theme.text }}>
            {chip.label}
          </ThemedText>
        </Pressable>
      ))}
    </ScrollView>
  );
}

export default function ListingsScreen() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const { city, districts, neighbourhoodsOf } = usePlaces();
  const { savedIds } = useSaved();
  const cityId = city?.id ?? null;

  const [view, setView] = useState<'list' | 'map'>('list');
  // "Saved" shows only the listings you gave a heart (the other filters are hidden).
  const [savedOnly, setSavedOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // "Search this area": the area being searched, and where the person has moved the map to.
  const [areaBounds, setAreaBounds] = useState<MapBounds | null>(null);
  const [movedBounds, setMovedBounds] = useState<MapBounds | null>(null);
  const [loading, setLoading] = useState(false);

  const [type, setType] = useState<ListingType | null>(null);
  const [districtId, setDistrictId] = useState<string | null>(null);
  const [neighbourhoodId, setNeighbourhoodId] = useState<string | null>(null);
  const [maxPriceText, setMaxPriceText] = useState('');
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [listings, setListings] = useState<Listing[] | null>(null);
  const [owners, setOwners] = useState<Map<string, PublicProfile>>(new Map());
  const [loadError, setLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (filters: ListingFilters | { savedIds: string[] }) => {
    setLoading(true);
    try {
      const found =
        'savedIds' in filters
          ? // In the order you saved them; listings that were closed or removed don't come back.
            await fetchListingsByIds(filters.savedIds).then((byId) =>
              filters.savedIds.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []))
            )
          : await fetchListings(filters);
      const foundOwners = await fetchAuthors(found.map((l) => l.user_id));
      setListings(found);
      setOwners(foundOwners);
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // The most specific place chosen: a neighbourhood, otherwise a district.
  const areaId = neighbourhoodId ?? districtId;

  // Saved listings are fetched once per set of hearts; un-saving hides a card straight away.
  const savedKey = savedOnly ? savedIds.join(',') : '';
  const filters = useMemo(
    () =>
      savedOnly
        ? { savedIds: savedKey ? savedKey.split(',') : [] }
        : { cityId, type, areaId, maxPrice, bounds: areaBounds },
    [savedOnly, savedKey, cityId, type, areaId, maxPrice, areaBounds]
  );

  // Reload when the tab is shown and whenever a filter changes.
  useFocusEffect(
    useCallback(() => {
      if (cityId) load(filters);
    }, [load, cityId, filters])
  );

  async function refresh() {
    setRefreshing(true);
    await load(filters);
    setRefreshing(false);
  }

  const shown = useMemo(
    () =>
      savedOnly
        ? (listings ?? []).filter((listing) => savedIds.includes(listing.id))
        : (listings ?? []),
    [savedOnly, listings, savedIds]
  );

  // Map pins: only listings with a location (people looking for a room usually have none).
  const pins: ListingPin[] = useMemo(
    () =>
      shown.flatMap((listing) =>
        listing.latitude != null && listing.longitude != null
          ? [
              {
                id: listing.id,
                latitude: listing.latitude,
                longitude: listing.longitude,
                label: formatPrice(listing.price_eur, i18n.language),
              },
            ]
          : []
      ),
    [shown, i18n.language]
  );
  const withoutLocation = shown.length - pins.length;
  const selected = shown.find((listing) => listing.id === selectedId);

  function searchThisArea() {
    if (!movedBounds) return;
    setAreaBounds(movedBounds);
    setMovedBounds(null);
    setSelectedId(null);
  }

  function clearArea() {
    setAreaBounds(null);
    setMovedBounds(null);
  }

  function chooseDistrict(id: string | null) {
    setDistrictId(id);
    setNeighbourhoodId(null);
  }

  function applyMaxPrice() {
    const value = Number(maxPriceText.trim());
    setMaxPrice(maxPriceText.trim() && Number.isInteger(value) && value > 0 ? value : null);
  }

  const typeChips: Chip[] = [
    // While searching a map area, a chip shows it and clears it.
    ...(areaBounds && !savedOnly
      ? [
          {
            key: 'area',
            label: `📍 ${t('listings.mapArea')}  ✕`,
            selected: true,
            onPress: clearArea,
          },
        ]
      : []),
    {
      key: 'saved',
      label:
        savedIds.length > 0
          ? `♥ ${t('listings.saved')} · ${savedIds.length}`
          : `♡ ${t('listings.saved')}`,
      selected: savedOnly,
      onPress: () => setSavedOnly((current) => !current),
    },
    {
      key: 'all',
      label: t('listings.filters.all'),
      selected: !savedOnly && type === null,
      onPress: () => {
        setSavedOnly(false);
        setType(null);
      },
    },
    ...LISTING_TYPES.map((option) => ({
      key: option,
      label: t(`listings.filters.types.${option}`),
      selected: !savedOnly && type === option,
      onPress: () => {
        setSavedOnly(false);
        setType(option);
      },
    })),
  ];

  const districtChips: Chip[] = [
    {
      key: 'all',
      label: t('listings.filters.allDistricts'),
      selected: districtId === null,
      onPress: () => chooseDistrict(null),
    },
    ...districts.map((district) => ({
      key: district.id,
      label: district.name,
      selected: districtId === district.id,
      onPress: () => chooseDistrict(district.id),
    })),
  ];

  // Once a district is chosen, its neighbourhoods appear as a second row.
  const neighbourhoodChips: Chip[] = districtId
    ? [
        {
          key: 'all',
          label: t('listings.filters.wholeDistrict'),
          selected: neighbourhoodId === null,
          onPress: () => setNeighbourhoodId(null),
        },
        ...neighbourhoodsOf(districtId).map((hood) => ({
          key: hood.id,
          label: hood.name,
          selected: neighbourhoodId === hood.id,
          onPress: () => setNeighbourhoodId(hood.id),
        })),
      ]
    : [];

  const filtersBlock = (
    <>
      <View style={styles.header}>
        <ThemedText type="subtitle">{t('listings.title')}</ThemedText>
        <View style={styles.viewSwitch}>
          <SegmentedControl
            segments={[
              { key: 'list', label: t('listings.viewList') },
              { key: 'map', label: t('listings.viewMap') },
            ]}
            selected={view}
            onChange={setView}
          />
        </View>
      </View>

      <ChipRow chips={typeChips} />
      {!savedOnly && <ChipRow chips={districtChips} />}
      {!savedOnly && neighbourhoodChips.length > 0 && <ChipRow chips={neighbourhoodChips} />}

      {!savedOnly && (
        <View style={styles.priceRow}>
          <ThemedText type="small" themeColor="textSecondary">
            {t('listings.filters.maxPrice')}
          </ThemedText>
          <TextInput
            style={[
              styles.priceInput,
              {
                borderColor: theme.border,
                backgroundColor: theme.backgroundElement,
                color: theme.text,
              },
            ]}
            value={maxPriceText}
            onChangeText={setMaxPriceText}
            onBlur={applyMaxPrice}
            onSubmitEditing={applyMaxPrice}
            placeholder="€"
            placeholderTextColor={theme.textSecondary}
            keyboardType="number-pad"
            inputMode="numeric"
            returnKeyType="search"
            maxLength={5}
            accessibilityLabel={t('listings.filters.maxPrice')}
          />
        </View>
      )}

      {loadError && (
        <ThemedText type="small" style={{ color: theme.danger }}>
          {t('listings.loadError')}
        </ThemedText>
      )}
    </>
  );

  // The map fills the screen; the search button floats on top, the chosen listing at the bottom.
  if (view === 'map') {
    const mapNote = !listings
      ? null
      : shown.length === 0
        ? areaBounds
          ? t('listings.noneInArea')
          : savedOnly
            ? t('listings.savedEmpty')
            : t('listings.empty')
        : withoutLocation > 0
          ? t('listings.withoutLocation', { count: withoutLocation })
          : null;

    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.mapScreen}>
            <View style={[styles.content, styles.mapFilters]}>{filtersBlock}</View>
            <View style={styles.mapArea}>
              <ListingsMap
                pins={pins}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onMove={setMovedBounds}
                fitToPins={!areaBounds}
                style={styles.mapFill}
              />

              {(movedBounds || loading) && !savedOnly && (
                <View style={styles.searchHereWrap} pointerEvents="box-none">
                  <Pressable
                    accessibilityRole="button"
                    disabled={loading}
                    onPress={searchThisArea}
                    style={({ pressed }) => [
                      styles.searchHere,
                      { backgroundColor: theme.text },
                      pressed && styles.pressed,
                    ]}>
                    {loading ? (
                      <ActivityIndicator color={theme.background} size="small" />
                    ) : (
                      <ThemedText type="smallBold" style={{ color: theme.background }}>
                        {t('listings.searchThisArea')}
                      </ThemedText>
                    )}
                  </Pressable>
                </View>
              )}

              <View style={styles.mapBottom} pointerEvents="box-none">
                {selected ? (
                  <ListingMiniCard listing={selected} onClose={() => setSelectedId(null)} />
                ) : (
                  mapNote && (
                    <View
                      style={[styles.mapNote, { backgroundColor: theme.backgroundElement }]}
                      pointerEvents="none">
                      <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
                        {mapNote}
                      </ThemedText>
                    </View>
                  )
                )}
              </View>
            </View>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.primary} />
          }>
          <View style={styles.content}>
            {filtersBlock}

            {!listings && !loadError && (
              <ActivityIndicator color={theme.primary} style={styles.loader} />
            )}

            {listings && shown.length === 0 && (
              <ThemedText themeColor="textSecondary" style={styles.empty}>
                {savedOnly
                  ? t('listings.savedEmpty')
                  : areaBounds
                    ? t('listings.noneInArea')
                    : t('listings.empty')}
              </ThemedText>
            )}

            {shown.map((listing) => (
              <ListingCard key={listing.id} listing={listing} owner={owners.get(listing.user_id)} />
            ))}
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
    gap: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  viewSwitch: {
    width: 170,
  },
  center: {
    textAlign: 'center',
  },
  mapScreen: {
    flex: 1,
    paddingBottom: BottomTabInset + Spacing.two,
  },
  mapFilters: {
    paddingTop: Spacing.four,
    paddingBottom: Spacing.three,
  },
  mapArea: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
  },
  mapFill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: Spacing.four,
    right: Spacing.four,
  },
  searchHereWrap: {
    position: 'absolute',
    top: Spacing.three,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  searchHere: {
    minWidth: 170,
    height: 40,
    paddingHorizontal: Spacing.three,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.2)',
  },
  mapBottom: {
    position: 'absolute',
    left: Spacing.four + Spacing.two,
    right: Spacing.four + Spacing.two,
    bottom: Spacing.two,
  },
  mapNote: {
    alignSelf: 'center',
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    boxShadow: '0 1px 6px rgba(0, 0, 0, 0.12)',
  },
  chipRow: {
    gap: Spacing.two,
  },
  chip: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  priceInput: {
    fontFamily: AppFonts.regular,
    width: 110,
    height: 40,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 15,
  },
  loader: {
    marginTop: Spacing.five,
  },
  empty: {
    marginTop: Spacing.three,
    lineHeight: 22,
  },
  pressed: {
    opacity: 0.7,
  },
});
