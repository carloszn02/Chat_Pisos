import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ListingCard } from '@/components/listing-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AppFonts, BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useDistricts } from '@/hooks/use-districts';
import { useTheme } from '@/hooks/use-theme';
import { fetchAuthors } from '@/lib/chat';
import { fetchListings, type ListingFilters } from '@/lib/listings';
import type { PublicProfile } from '@/types/chat';
import { LISTING_TYPES, type Listing, type ListingType } from '@/types/listing';

type Chip = { key: string; label: string; selected: boolean; onPress: () => void };

function ChipRow({ chips }: { chips: Chip[] }) {
  const theme = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
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
  const { t } = useTranslation();
  const theme = useTheme();
  const districts = useDistricts();

  const [type, setType] = useState<ListingType | null>(null);
  const [districtId, setDistrictId] = useState<string | null>(null);
  const [maxPriceText, setMaxPriceText] = useState('');
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [listings, setListings] = useState<Listing[] | null>(null);
  const [owners, setOwners] = useState<Map<string, PublicProfile>>(new Map());
  const [loadError, setLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (filters: ListingFilters) => {
    try {
      const found = await fetchListings(filters);
      const foundOwners = await fetchAuthors(found.map((l) => l.user_id));
      setListings(found);
      setOwners(foundOwners);
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, []);

  // Reload when the tab is shown and whenever a filter changes.
  useFocusEffect(
    useCallback(() => {
      load({ type, districtId, maxPrice });
    }, [load, type, districtId, maxPrice])
  );

  async function refresh() {
    setRefreshing(true);
    await load({ type, districtId, maxPrice });
    setRefreshing(false);
  }

  function applyMaxPrice() {
    const value = Number(maxPriceText.trim());
    setMaxPrice(maxPriceText.trim() && Number.isInteger(value) && value > 0 ? value : null);
  }

  const typeChips: Chip[] = [
    { key: 'all', label: t('listings.filters.all'), selected: type === null, onPress: () => setType(null) },
    ...LISTING_TYPES.map((option) => ({
      key: option,
      label: t(`listings.filters.types.${option}`),
      selected: type === option,
      onPress: () => setType(option),
    })),
  ];

  const districtChips: Chip[] = [
    {
      key: 'all',
      label: t('listings.filters.allDistricts'),
      selected: districtId === null,
      onPress: () => setDistrictId(null),
    },
    ...districts.map((district) => ({
      key: district.id,
      label: district.name,
      selected: districtId === district.id,
      onPress: () => setDistrictId(district.id),
    })),
  ];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.primary} />}>
          <View style={styles.content}>
            <View style={styles.header}>
              <ThemedText type="subtitle">{t('listings.title')}</ThemedText>
            </View>

            <ChipRow chips={typeChips} />
            <ChipRow chips={districtChips} />

            <View style={styles.priceRow}>
              <ThemedText type="small" themeColor="textSecondary">
                {t('listings.filters.maxPrice')}
              </ThemedText>
              <TextInput
                style={[styles.priceInput, { borderColor: theme.border, backgroundColor: theme.backgroundElement, color: theme.text }]}
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

            {!listings && !loadError && <ActivityIndicator color={theme.primary} style={styles.loader} />}

            {loadError && (
              <ThemedText type="small" style={{ color: theme.danger }}>
                {t('listings.loadError')}
              </ThemedText>
            )}

            {listings && listings.length === 0 && (
              <ThemedText themeColor="textSecondary" style={styles.empty}>
                {t('listings.empty')}
              </ThemedText>
            )}

            {listings?.map((listing) => (
              <ListingCard key={listing.id} listing={listing} districts={districts} owner={owners.get(listing.user_id)} />
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
