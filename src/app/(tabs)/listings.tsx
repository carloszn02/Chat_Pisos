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

import { ListingCard } from '@/components/listing-card';
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
import type { ListingPin } from '@/lib/map';
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

const MAP_HEIGHT = 440;

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
        : { cityId, type, areaId, maxPrice },
    [savedOnly, savedKey, cityId, type, areaId, maxPrice]
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

  function chooseDistrict(id: string | null) {
    setDistrictId(id);
    setNeighbourhoodId(null);
  }

  function applyMaxPrice() {
    const value = Number(maxPriceText.trim());
    setMaxPrice(maxPriceText.trim() && Number.isInteger(value) && value > 0 ? value : null);
  }

  const typeChips: Chip[] = [
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

            {!listings && !loadError && (
              <ActivityIndicator color={theme.primary} style={styles.loader} />
            )}

            {loadError && (
              <ThemedText type="small" style={{ color: theme.danger }}>
                {t('listings.loadError')}
              </ThemedText>
            )}

            {listings && shown.length === 0 && (
              <ThemedText themeColor="textSecondary" style={styles.empty}>
                {savedOnly ? t('listings.savedEmpty') : t('listings.empty')}
              </ThemedText>
            )}

            {listings && shown.length > 0 && view === 'map' && (
              <>
                <ListingsMap
                  pins={pins}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  height={MAP_HEIGHT}
                />
                {withoutLocation > 0 && (
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('listings.withoutLocation', { count: withoutLocation })}
                  </ThemedText>
                )}
                {selected ? (
                  <ListingCard listing={selected} owner={owners.get(selected.user_id)} />
                ) : (
                  pins.length > 0 && (
                    <ThemedText type="small" themeColor="textSecondary" style={styles.mapHint}>
                      {t('listings.mapHint')}
                    </ThemedText>
                  )
                )}
              </>
            )}

            {view === 'list' &&
              shown.map((listing) => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  owner={owners.get(listing.user_id)}
                />
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
  mapHint: {
    textAlign: 'center',
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
