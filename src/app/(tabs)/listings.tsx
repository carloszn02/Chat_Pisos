import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, IconButton } from '@/components/button';
import { ChipRow, ChipWrap, type Chip } from '@/components/filter-chips';
import { ScreenHeader } from '@/components/screen-header';
import { ListingCardsSkeleton } from '@/components/skeleton';
import { ListingCard, ListingMiniCard } from '@/components/listing-card';
import { ListingsMap } from '@/components/listings-map';
import { SortSheet } from '@/components/sort-sheet';
import { metroLineLabel, MetroLinePicker } from '@/components/metro-badge';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AppFonts, BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { usePlaces } from '@/hooks/use-places';
import { useProfile } from '@/hooks/use-profile';
import { useSaved } from '@/hooks/use-saved';
import { useTheme } from '@/hooks/use-theme';
import { fetchAuthors } from '@/lib/chat';
import { formatPrice } from '@/lib/format';
import { sortListings, type ListingSort } from '@/lib/listing-sort';
import { fetchListings, fetchListingsByIds, type ListingFilters } from '@/lib/listings';
import type { ListingPin, MapBounds } from '@/lib/map';
import type { PublicProfile } from '@/types/chat';
import { LISTING_TYPES, type Listing, type ListingType, type MetroLine } from '@/types/listing';

export default function ListingsScreen() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const { city, districts, neighbourhoodsOf } = usePlaces();
  const { savedIds } = useSaved();
  const { profile: me } = useProfile();
  const [sort, setSort] = useState<ListingSort>('recommended');
  const [sortOpen, setSortOpen] = useState(false);
  const cityId = city?.id ?? null;

  const [view, setView] = useState<'list' | 'map'>('list');
  // The panel with districts, neighbourhoods and price.
  const [filtersOpen, setFiltersOpen] = useState(false);
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
  const [gender, setGender] = useState<'female' | 'male' | null>(null);
  const [petsAllowed, setPetsAllowed] = useState(false);
  const [registrationAllowed, setRegistrationAllowed] = useState(false);
  const [metroLine, setMetroLine] = useState<MetroLine | null>(null);
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
        : {
            cityId,
            type,
            areaId,
            maxPrice,
            bounds: areaBounds,
            gender,
            petsAllowed,
            registrationAllowed,
            metroLine,
            sort,
          },
    [
      savedOnly,
      savedKey,
      cityId,
      type,
      areaId,
      maxPrice,
      areaBounds,
      gender,
      petsAllowed,
      registrationAllowed,
      metroLine,
      sort,
    ]
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

  const shown = useMemo(() => {
    const visible = savedOnly
      ? (listings ?? []).filter((listing) => savedIds.includes(listing.id))
      : (listings ?? []);
    return sortListings(visible, sort, { me, owners });
  }, [savedOnly, listings, savedIds, sort, me, owners]);

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

  // How many filters from the panel are on.
  const panelFilterCount = [
    districtId,
    maxPrice,
    gender,
    petsAllowed,
    registrationAllowed,
    metroLine,
  ].filter(Boolean).length;
  const typeChips: Chip[] = savedOnly
    ? [
        // Showing saved listings: one chip to go back to all of them.
        {
          key: 'saved',
          label: `${t('listings.saved')} · ${savedIds.length}`,
          icon: 'heart',
          selected: true,
          removable: true,
          onPress: () => setSavedOnly(false),
        },
      ]
    : [
        {
          key: 'filters',
          label:
            panelFilterCount > 0
              ? `${t('listings.filters.title')} · ${panelFilterCount}`
              : t('listings.filters.title'),
          icon: 'filters',
          selected: panelFilterCount > 0,
          outlined: true,
          onPress: () => setFiltersOpen(true),
        },
        {
          key: 'sort',
          label: t(`listings.sort.options.${sort}`),
          icon: 'sort',
          selected: sort !== 'recommended',
          outlined: true,
          onPress: () => setSortOpen(true),
        },
        // While searching a map area, a chip shows it and clears it.
        ...(areaBounds
          ? [
              {
                key: 'area',
                label: t('listings.mapArea'),
                icon: 'map-pin' as const,
                selected: true,
                removable: true,
                onPress: clearArea,
              },
            ]
          : []),
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

  const genderChips: Chip[] = (['all', 'female', 'male'] as const).map((option) => ({
    key: option,
    label: t(`listings.filters.genders.${option}`),
    selected: (gender ?? 'all') === option,
    onPress: () => setGender(option === 'all' ? null : option),
  }));
  const extraChips: Chip[] = [
    {
      key: 'pets',
      label: t('listings.filters.petsAllowed'),
      selected: petsAllowed,
      onPress: () => setPetsAllowed((current) => !current),
    },
    {
      key: 'registration',
      label: t('listings.filters.registrationAllowed'),
      selected: registrationAllowed,
      onPress: () => setRegistrationAllowed((current) => !current),
    },
  ];

  // "24 listings · Malasaña · Up to 700 €"
  const placeName = neighbourhoodId
    ? neighbourhoodsOf(districtId ?? '').find((h) => h.id === neighbourhoodId)?.name
    : districts.find((d) => d.id === districtId)?.name;
  const summary = [
    listings ? t('listings.count', { count: shown.length }) : null,
    !savedOnly ? placeName : null,
    !savedOnly && maxPrice
      ? t('listings.filters.upTo', { price: formatPrice(maxPrice, i18n.language) })
      : null,
    !savedOnly && gender ? t(`listings.filters.genders.${gender}`) : null,
    !savedOnly && metroLine
      ? t('listings.filters.metroLine', { line: metroLineLabel(metroLine) })
      : null,
    !savedOnly && petsAllowed ? t('listings.filters.petsAllowed') : null,
    !savedOnly && registrationAllowed ? t('listings.filters.registrationAllowed') : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const filtersBlock = (
    <>
      <ScreenHeader
        title={t('listings.title')}
        actions={
          <>
            <IconButton
              icon={view === 'list' ? 'map' : 'list'}
              label={view === 'list' ? t('listings.viewMap') : t('listings.viewList')}
              onPress={() => setView(view === 'list' ? 'map' : 'list')}
            />
            <IconButton
              icon="heart"
              label={t('listings.saved')}
              variant={savedOnly ? 'filled' : 'outlined'}
              badge={savedOnly ? undefined : savedIds.length}
              onPress={() => setSavedOnly((current) => !current)}
            />
          </>
        }
      />

      <ChipRow chips={typeChips} />
      {summary ? (
        <ThemedText type="small" themeColor="textSecondary">
          {summary}
        </ThemedText>
      ) : null}

      {loadError && (
        <ThemedText type="small" style={{ color: theme.danger }}>
          {t('listings.loadError')}
        </ThemedText>
      )}

      <SortSheet
        visible={sortOpen}
        value={sort}
        onChange={setSort}
        onClose={() => setSortOpen(false)}
      />
      <FiltersPanel
        visible={filtersOpen}
        onClose={() => {
          applyMaxPrice();
          setFiltersOpen(false);
        }}
        onClear={() => {
          chooseDistrict(null);
          setMaxPriceText('');
          setMaxPrice(null);
          setGender(null);
          setPetsAllowed(false);
          setRegistrationAllowed(false);
          setMetroLine(null);
        }}
        districtChips={districtChips}
        genderChips={genderChips}
        extraChips={extraChips}
        metroLine={metroLine}
        onMetroLine={(line) => setMetroLine(metroLine === line ? null : line)}
        neighbourhoodChips={neighbourhoodChips}
        maxPriceText={maxPriceText}
        onChangeMaxPrice={setMaxPriceText}
        onSubmitMaxPrice={applyMaxPrice}
      />
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

            {!listings && !loadError && <ListingCardsSkeleton />}

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

type FiltersPanelProps = {
  visible: boolean;
  onClose: () => void;
  onClear: () => void;
  districtChips: Chip[];
  neighbourhoodChips: Chip[];
  maxPriceText: string;
  onChangeMaxPrice: (text: string) => void;
  onSubmitMaxPrice: () => void;
  genderChips: Chip[];
  extraChips: Chip[];
  metroLine: MetroLine | null;
  onMetroLine: (line: MetroLine) => void;
};

/** Districts, neighbourhoods, price and the other filters, in a panel that slides up. */
function FiltersPanel({
  visible,
  onClose,
  onClear,
  districtChips,
  neighbourhoodChips,
  maxPriceText,
  onChangeMaxPrice,
  onSubmitMaxPrice,
  genderChips,
  extraChips,
  metroLine,
  onMetroLine,
}: FiltersPanelProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('common.close')}
        style={styles.backdrop}
        onPress={onClose}
      />
      <View
        style={[
          styles.panel,
          {
            backgroundColor: theme.background,
            paddingBottom: Math.max(insets.bottom, Spacing.three),
          },
        ]}>
        <View style={styles.panelHeader}>
          <ThemedText type="subtitle" style={styles.panelTitle}>
            {t('listings.filters.title')}
          </ThemedText>
          <IconButton icon="close" label={t('common.close')} variant="plain" onPress={onClose} />
        </View>
        <ScrollView contentContainerStyle={styles.panelContent} keyboardShouldPersistTaps="handled">
          <ThemedText style={styles.panelSection}>{t('listings.filters.where')}</ThemedText>
          <ChipWrap chips={districtChips} />
          {neighbourhoodChips.length > 0 && (
            <>
              <ThemedText style={styles.panelSection}>
                {t('listings.filters.neighbourhood')}
              </ThemedText>
              <ChipWrap chips={neighbourhoodChips} />
            </>
          )}
          <ThemedText style={styles.panelSection}>{t('listings.filters.maxPrice')}</ThemedText>
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
            onChangeText={onChangeMaxPrice}
            onBlur={onSubmitMaxPrice}
            onSubmitEditing={onSubmitMaxPrice}
            placeholder="€"
            placeholderTextColor={theme.textSecondary}
            keyboardType="number-pad"
            inputMode="numeric"
            returnKeyType="done"
            maxLength={5}
            accessibilityLabel={t('listings.filters.maxPrice')}
          />
          <ThemedText style={styles.panelSection}>{t('listings.filters.forWho')}</ThemedText>
          <ChipWrap chips={genderChips} />
          <ThemedText style={styles.panelSection}>{t('listings.filters.metro')}</ThemedText>
          <MetroLinePicker value={metroLine ? [metroLine] : []} onToggle={onMetroLine} />
          <ThemedText style={styles.panelSection}>{t('listings.filters.more')}</ThemedText>
          <ChipWrap chips={extraChips} />
        </ScrollView>
        <View style={[styles.panelFooter, { borderTopColor: theme.border }]}>
          <Button label={t('listings.filters.clear')} variant="text" onPress={onClear} />
          <Button label={t('listings.filters.show')} onPress={onClose} style={styles.panelShow} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  panel: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '80%',
    alignSelf: 'center',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: Spacing.three,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
  },
  panelTitle: {
    fontSize: 22,
    lineHeight: 28,
  },
  panelContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.three,
    gap: Spacing.two,
  },
  panelSection: {
    fontWeight: 700,
    marginTop: Spacing.three,
  },
  panelFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    borderTopWidth: 1,
  },
  panelShow: {
    flex: 1,
  },
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
  priceInput: {
    fontFamily: AppFonts.regular,
    width: 110,
    height: 40,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 15,
  },
  empty: {
    marginTop: Spacing.three,
    lineHeight: 22,
  },
  pressed: {
    opacity: 0.7,
  },
});
