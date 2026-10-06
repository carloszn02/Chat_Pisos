import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { districtNames } from '@/hooks/use-districts';
import { useTheme } from '@/hooks/use-theme';
import { formatDate, formatPrice } from '@/lib/format';
import type { ChatGroup, PublicProfile } from '@/types/chat';
import { LISTING_TYPE_COLORS, type Listing, type ListingType } from '@/types/listing';

/** The small colored label: "Offering room", "Looking for room" or "Whole flat". */
export function ListingTypeTag({ type }: { type: ListingType }) {
  const { t } = useTranslation();
  const colors = LISTING_TYPE_COLORS[type];
  return (
    <View style={[styles.tag, { backgroundColor: colors.background }]}>
      <ThemedText style={[styles.tagText, { color: colors.text }]}>{t(`listings.types.${type}`)}</ThemedText>
    </View>
  );
}

/** "€620 /month" for rooms and flats, "Up to €550" for people looking. */
export function ListingPrice({ listing, large = false }: { listing: Listing; large?: boolean }) {
  const { t, i18n } = useTranslation();
  const price = formatPrice(listing.price_eur, i18n.language);
  const size = large ? styles.priceLarge : styles.price;
  if (listing.type === 'seeking_room') {
    return <ThemedText style={size}>{t('listings.budgetUpTo', { price })}</ThemedText>;
  }
  return (
    <ThemedText style={size}>
      {price}
      <ThemedText type="small" themeColor="textSecondary">
        {' '}
        {t('listings.perMonth')}
      </ThemedText>
    </ThemedText>
  );
}

type ListingCardProps = {
  listing: Listing;
  districts: ChatGroup[];
  owner?: PublicProfile;
  /** Smaller version without the photo, for group chats. */
  compact?: boolean;
};

export function ListingCard({ listing, districts, owner, compact = false }: ListingCardProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const photo = listing.photo_urls[0];

  const details = [
    districtNames(listing.district_ids, districts),
    t('listings.fromDate', { date: formatDate(listing.available_from, i18n.language) }),
    owner && `${owner.first_name}, ${owner.age}`,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Link href={{ pathname: '/listing/[id]', params: { id: listing.id } }} asChild>
      <Pressable
        accessibilityRole="link"
        style={({ pressed }) => [
          styles.card,
          compact && styles.compactCard,
          { borderColor: theme.border, backgroundColor: compact ? theme.background : theme.backgroundElement },
          pressed && styles.pressed,
        ]}>
        {!compact && photo && <Image source={{ uri: photo }} style={styles.photo} contentFit="cover" />}
        <View style={styles.headerRow}>
          <ListingTypeTag type={listing.type} />
          {listing.status === 'closed' && (
            <ThemedText type="small" themeColor="textSecondary">
              {t('listings.closed')}
            </ThemedText>
          )}
        </View>
        <ThemedText style={styles.title} numberOfLines={2}>
          {listing.title}
        </ThemedText>
        <ListingPrice listing={listing} />
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
          {details}
        </ThemedText>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  compactCard: {
    padding: Spacing.two,
    gap: Spacing.one,
    marginTop: Spacing.one,
  },
  photo: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
  },
  tagText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: 700,
  },
  title: {
    fontWeight: 700,
    fontSize: 16,
    lineHeight: 22,
  },
  price: {
    fontWeight: 700,
    fontSize: 16,
    lineHeight: 22,
  },
  priceLarge: {
    fontWeight: 700,
    fontSize: 24,
    lineHeight: 30,
  },
  pressed: {
    opacity: 0.7,
  },
});
