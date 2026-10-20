import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
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
export function ListingTypeTag({
  type,
  onPhoto = false,
}: {
  type: ListingType;
  onPhoto?: boolean;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const colors = LISTING_TYPE_COLORS[type];
  return (
    <View
      style={[
        styles.tag,
        // On a photo: a white label so it stays readable on any picture.
        { backgroundColor: onPhoto ? theme.backgroundElement : colors.background },
      ]}>
      <ThemedText style={[styles.tagText, { color: colors.text }]}>
        {t(`listings.types.${type}`)}
      </ThemedText>
    </View>
  );
}

/**
 * "€620 /month" for rooms and flats, "Up to €550" for people looking.
 * 'card' and 'large' use the heading font, for listing cards and the listing page.
 */
export function ListingPrice({
  listing,
  size = 'regular',
}: {
  listing: Listing;
  size?: 'regular' | 'card' | 'large';
}) {
  const { t, i18n } = useTranslation();
  const price = formatPrice(listing.price_eur, i18n.language);
  const heading = size !== 'regular';
  const style =
    size === 'large' ? styles.priceLarge : size === 'card' ? styles.priceCard : styles.price;
  if (listing.type === 'seeking_room') {
    return (
      <ThemedText type={heading ? 'subtitle' : 'default'} style={style}>
        {t('listings.budgetUpTo', { price })}
      </ThemedText>
    );
  }
  return (
    <ThemedText type={heading ? 'subtitle' : 'default'} style={style}>
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

  const status =
    listing.status === 'closed' ? (
      <ThemedText type="smallBold" themeColor="textSecondary">
        {t('listings.closed')}
      </ThemedText>
    ) : new Date(listing.expires_at) <= new Date() ? (
      <ThemedText type="smallBold" style={{ color: theme.danger }}>
        {t('listings.expired')}
      </ThemedText>
    ) : null;

  if (compact) {
    return (
      <PressableLink
        href={{ pathname: '/listing/[id]', params: { id: listing.id } }}
        accessibilityRole="link"
        style={[
          styles.compactCard,
          { borderColor: theme.border, backgroundColor: theme.background },
        ]}>
        <View style={styles.tagRow}>
          <ListingTypeTag type={listing.type} />
          {status}
        </View>
        <ThemedText style={styles.title} numberOfLines={2}>
          {listing.title}
        </ThemedText>
        <ListingPrice listing={listing} />
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {placeLabel(listing.area_ids)}
        </ThemedText>
      </PressableLink>
    );
  }

  return (
    <View>
      <PressableLink
        href={{ pathname: '/listing/[id]', params: { id: listing.id } }}
        accessibilityRole="link"
        style={[
          styles.card,
          { borderColor: theme.border, backgroundColor: theme.backgroundElement },
        ]}>
        {photo && (
          <View>
            <Image source={{ uri: photo }} style={styles.photo} contentFit="cover" />
            <View style={styles.tagOnPhoto}>
              <ListingTypeTag type={listing.type} onPhoto />
            </View>
          </View>
        )}
        <View style={[styles.body, showSave && !photo && styles.bodyWithHeart]}>
          {!photo && <ListingTypeTag type={listing.type} />}
          <View style={styles.tagRow}>
            <ListingPrice listing={listing} size="card" />
            {status}
          </View>
          <ThemedText style={styles.title} numberOfLines={2}>
            {listing.title}
          </ThemedText>
          <View style={styles.details}>
            <Icon name="map-pin" size={14} color={theme.textSecondary} strokeWidth={2} />
            <ThemedText
              type="small"
              themeColor="textSecondary"
              numberOfLines={1}
              style={styles.flex}>
              {details}
            </ThemedText>
          </View>
        </View>
      </PressableLink>
      {/* Next to the link rather than inside it, so tapping the heart doesn't open the listing. */}
      {showSave && (
        <View style={styles.heart}>
          <SaveButton listingId={listing.id} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 18,
    overflow: 'hidden',
  },
  compactCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: Spacing.two,
    gap: Spacing.one,
    marginTop: Spacing.one,
  },
  photo: {
    width: '100%',
    aspectRatio: 16 / 10,
  },
  tagOnPhoto: {
    position: 'absolute',
    left: Spacing.three - 4,
    top: Spacing.three - 4,
  },
  body: {
    padding: Spacing.three,
    paddingTop: Spacing.three - 2,
    gap: 4,
  },
  // Room for the heart in the top corner when there's no photo.
  bodyWithHeart: {
    paddingRight: 56,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  details: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  flex: {
    flex: 1,
  },
  heart: {
    position: 'absolute',
    top: Spacing.three - 4,
    right: Spacing.three - 4,
  },
  tag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    height: 26,
    borderRadius: 13,
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
  priceCard: {
    fontSize: 22,
    lineHeight: 28,
  },
  priceLarge: {
    fontSize: 28,
    lineHeight: 34,
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
          <Icon name="close" size={18} color={theme.textSecondary} />
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
