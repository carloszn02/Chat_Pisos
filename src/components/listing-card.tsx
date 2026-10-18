import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { PressableLink } from '@/components/pressable-link';
import { SaveButton } from '@/components/save-button';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { usePlaces } from '@/hooks/use-places';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { formatDate, formatPrice } from '@/lib/format';
import type { PublicProfile } from '@/types/chat';
import { LISTING_TYPE_COLORS, type Listing, type ListingType } from '@/types/listing';

/** The small colored label: "Offering room", "Looking for room" or "Whole flat". */
export function ListingTypeTag({ type }: { type: ListingType }) {
  const { t } = useTranslation();
  const colors = LISTING_TYPE_COLORS[type];
  return (
    <View style={[styles.tag, { backgroundColor: colors.background }]}>
      <ThemedText style={[styles.tagText, { color: colors.text }]}>
        {t(`listings.types.${type}`)}
      </ThemedText>
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
  owner?: PublicProfile;
  /** Smaller version without the photo, for group chats. */
  compact?: boolean;
};

export function ListingCard({ listing, owner, compact = false }: ListingCardProps) {
  const { placeLabel } = usePlaces();
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const { session } = useSession();
  const photo = listing.photo_urls[0];
  // The heart, for other people's listings (not in the small chat version).
  const showSave = !compact && listing.user_id !== session?.user.id;

  const details = [
    placeLabel(listing.area_ids),
    t('listings.fromDate', { date: formatDate(listing.available_from, i18n.language) }),
    owner && `${owner.first_name}, ${owner.age}`,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View>
      <PressableLink
        href={{ pathname: '/listing/[id]', params: { id: listing.id } }}
        accessibilityRole="link"
        style={[
          styles.card,
          compact && styles.compactCard,
          {
            borderColor: theme.border,
            backgroundColor: compact ? theme.background : theme.backgroundElement,
          },
        ]}>
        {!compact && photo && (
          <Image source={{ uri: photo }} style={styles.photo} contentFit="cover" />
        )}
        <View style={[styles.headerRow, showSave && !photo && styles.headerWithHeart]}>
          <ListingTypeTag type={listing.type} />
          {listing.status === 'closed' ? (
            <ThemedText type="small" themeColor="textSecondary">
              {t('listings.closed')}
            </ThemedText>
          ) : (
            new Date(listing.expires_at) <= new Date() && (
              <ThemedText type="small" style={{ color: theme.danger }}>
                {t('listings.expired')}
              </ThemedText>
            )
          )}
        </View>
        <ThemedText
          style={[styles.title, showSave && !photo && styles.headerWithHeart]}
          numberOfLines={2}>
          {listing.title}
        </ThemedText>
        <ListingPrice listing={listing} />
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
          {details}
        </ThemedText>
      </PressableLink>
      {/* Next to the link rather than inside it, so tapping the heart doesn't open the listing. */}
      {showSave && (
        <View style={[styles.heart, photo ? styles.heartOnPhoto : styles.heartNoPhoto]}>
          <SaveButton listingId={listing.id} />
        </View>
      )}
    </View>
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
  headerWithHeart: {
    paddingRight: 40,
  },
  heart: {
    position: 'absolute',
  },
  // On top of the photo's corner.
  heartOnPhoto: {
    top: Spacing.three + Spacing.two,
    right: Spacing.three + Spacing.two,
  },
  // Level with the type label.
  heartNoPhoto: {
    top: 10,
    right: 10,
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

/**
 * A small card with a thumbnail, used at the bottom of the map when a price is tapped.
 * Tapping it opens the listing.
 */
export function ListingMiniCard({ listing, onClose }: { listing: Listing; onClose: () => void }) {
  const { placeLabel } = usePlaces();
  const { t } = useTranslation();
  const theme = useTheme();
  const { session } = useSession();
  const photo = listing.photo_urls[0];
  const isMine = listing.user_id === session?.user.id;

  return (
    <View
      style={[
        miniStyles.card,
        { backgroundColor: theme.backgroundElement, borderColor: theme.border },
      ]}>
      {/* A plain button (not <Link asChild>): on the web the link wrapper drops these styles. */}
      <Pressable
        accessibilityRole="link"
        onPress={() => router.push({ pathname: '/listing/[id]', params: { id: listing.id } })}
        style={[miniStyles.link]}>
        {photo ? (
          <Image source={{ uri: photo }} style={miniStyles.photo} contentFit="cover" />
        ) : (
          <View
            style={[
              miniStyles.photo,
              { backgroundColor: LISTING_TYPE_COLORS[listing.type].background },
            ]}
          />
        )}
        <View style={miniStyles.text}>
          <ListingTypeTag type={listing.type} />
          <ThemedText style={styles.title} numberOfLines={1}>
            {listing.title}
          </ThemedText>
          <ListingPrice listing={listing} />
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {placeLabel(listing.area_ids)}
          </ThemedText>
        </View>
      </Pressable>
      <View style={miniStyles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          onPress={onClose}
          hitSlop={10}
          style={miniStyles.close}>
          <ThemedText themeColor="textSecondary">✕</ThemedText>
        </Pressable>
        {!isMine && <SaveButton listingId={listing.id} variant="plain" />}
      </View>
    </View>
  );
}

const miniStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 16,
    padding: Spacing.two,
    gap: Spacing.two,
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12)',
  },
  link: {
    flex: 1,
    flexDirection: 'row',
    gap: Spacing.three,
    minWidth: 0,
  },
  photo: {
    width: 96,
    height: 96,
    borderRadius: 12,
  },
  text: {
    flex: 1,
    minWidth: 0,
    gap: 2,
    justifyContent: 'center',
  },
  actions: {
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  close: {
    width: 36,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
