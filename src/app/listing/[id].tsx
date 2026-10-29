import { Image } from 'expo-image';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';

import { Icon } from '@/components/icon';
import { DetailSkeleton } from '@/components/skeleton';
import { PressableLink } from '@/components/pressable-link';
import { ActionSheet } from '@/components/action-sheet';
import { Avatar } from '@/components/avatar';
import { CompatibilityBox } from '@/components/compatibility-box';
import { ListingPrice, ListingTypeTag } from '@/components/listing-card';
import { ListingContactCard } from '@/components/listing-contact';
import { MetroBadge } from '@/components/metro-badge';
import { LocationMap } from '@/components/location-map';
import { SaveButton } from '@/components/save-button';
import { ScreenScrollView } from '@/components/screen-scroll-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { usePlaces } from '@/hooks/use-places';
import { useProfile } from '@/hooks/use-profile';
import { useShare } from '@/hooks/use-share';
import { useTheme } from '@/hooks/use-theme';
import { fetchPublicProfile } from '@/lib/chat';
import { startConversation } from '@/lib/direct-messages';
import { formatDate, formatPrice } from '@/lib/format';
import { appUrl } from '@/lib/links';
import {
  daysUntilExpiry,
  deleteListing,
  fetchListing,
  renewListing,
  setListingStatus,
} from '@/lib/listings';
import type { PublicProfile } from '@/types/chat';
import type { Listing } from '@/types/listing';
import { SPOKEN_LANGUAGES } from '@/types/profile';

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const { placeLabel } = usePlaces();
  const { profile: me } = useProfile();

  const [listing, setListing] = useState<Listing | null>(null);
  const [owner, setOwner] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { share, toast } = useShare();

  // Reload when coming back from editing.
  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      let cancelled = false;
      (async () => {
        try {
          const found = await fetchListing(id);
          const foundOwner = found ? await fetchPublicProfile(found.user_id) : null;
          if (cancelled) return;
          setListing(found);
          setOwner(foundOwner);
        } catch {
          if (!cancelled) setListing(null);
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [id])
  );

  const isOwner = !!listing && listing.user_id === me?.id;

  async function message() {
    if (!listing) return;
    setBusy(true);
    setActionError(false);
    try {
      const conversationId = await startConversation(listing.user_id);
      // Opening the chat with the listing attached shows "Talking about: …" above the message box.
      router.push({
        pathname: '/conversation/[id]',
        params: { id: conversationId, listingId: listing.id },
      });
    } catch {
      setActionError(true);
    } finally {
      setBusy(false);
    }
  }

  async function toggleClosed() {
    if (!listing) return;
    const status = listing.status === 'active' ? 'closed' : 'active';
    setBusy(true);
    setActionError(false);
    try {
      await setListingStatus(listing.id, status);
      setListing({ ...listing, status });
    } catch {
      setActionError(true);
    } finally {
      setBusy(false);
    }
  }

  async function renew() {
    if (!listing) return;
    setBusy(true);
    setActionError(false);
    try {
      await renewListing(listing.id);
      const updated = await fetchListing(listing.id);
      if (updated) setListing(updated);
    } catch {
      setActionError(true);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!listing) return;
    setBusy(true);
    setActionError(false);
    try {
      await deleteListing(listing);
      if (router.canGoBack()) router.back();
      else router.replace('/listings');
    } catch {
      setActionError(true);
      setBusy(false);
    }
  }

  function report() {
    if (!listing) return;
    router.push({
      pathname: '/report',
      params: {
        userId: listing.user_id,
        name: owner?.first_name ?? '',
        listingId: listing.id,
        snapshot: listing.title,
      },
    });
  }

  if (loading || !listing) {
    return (
      <ThemedView style={[styles.screen, styles.centered]}>
        <Stack.Screen options={{ title: '' }} />
        {loading ? (
          <DetailSkeleton />
        ) : (
          <ThemedText themeColor="textSecondary">{t('listings.notFound')}</ThemedText>
        )}
      </ThemedView>
    );
  }

  const yesNo = (value: boolean | null) =>
    value === null ? null : t(value ? 'listings.yes' : 'listings.no');
  const genderText =
    listing.gender === null
      ? null
      : listing.type === 'seeking_room'
        ? listing.gender !== 'any' && t(`listings.seekerGenders.${listing.gender}`)
        : t(`listings.genderTags.${listing.gender}`);
  const facts = [
    [
      listing.type === 'seeking_room'
        ? t('listings.detail.whoIsLooking')
        : t('listings.detail.forWho'),
      genderText,
    ],
    [t('listings.facts.availableFrom'), formatDate(listing.available_from, i18n.language)],
    [
      t('listings.facts.minStay'),
      listing.min_stay_months && t('listings.months', { count: listing.min_stay_months }),
    ],
    [t('listings.facts.billsIncluded'), yesNo(listing.bills_included)],
    [t('listings.facts.furnished'), yesNo(listing.furnished)],
    [
      t('listings.facts.billsEstimate'),
      listing.bills_estimate_eur &&
        t('listings.facts.billsPerMonth', {
          price: formatPrice(listing.bills_estimate_eur, i18n.language),
        }),
    ],
    [
      t('listings.facts.deposit'),
      listing.deposit_months === null
        ? null
        : listing.deposit_months === 0
          ? t('listings.facts.noDeposit')
          : t('listings.months', { count: listing.deposit_months }),
    ],
    [
      listing.type === 'whole_flat' ? t('listings.facts.flatSize') : t('listings.facts.roomSize'),
      listing.room_size_m2 && `${listing.room_size_m2} m²`,
    ],
    [t('listings.facts.bedrooms'), listing.bedrooms && String(listing.bedrooms)],
    [t('listings.facts.bathrooms'), listing.bathrooms && String(listing.bathrooms)],
    [t('listings.facts.flatmates'), listing.flatmates != null ? String(listing.flatmates) : null],
    [
      t('listings.facts.floor'),
      listing.floor === null
        ? null
        : listing.floor === 0
          ? t('listings.facts.groundFloor')
          : t('listings.facts.floorNumber', { floor: listing.floor }),
    ],
  ].filter((fact): fact is [string, string] => !!fact[1]);

  const yesNoRule = (
    value: boolean | null,
    rule: 'registration' | 'pets' | 'smoking' | 'couples'
  ) => (value === null ? null : t(`listings.rules.${rule}_${value ? 'yes' : 'no'}`));
  const rules = [
    yesNoRule(listing.registration_allowed, 'registration'),
    yesNoRule(listing.pets_allowed, 'pets'),
    yesNoRule(listing.smoking_allowed, 'smoking'),
    yesNoRule(listing.couples_allowed, 'couples'),
  ].filter((rule): rule is string => !!rule);
  const ideal = [
    listing.age_min && listing.age_max
      ? t('listings.detail.ageRange', { min: listing.age_min, max: listing.age_max })
      : listing.age_min
        ? t('listings.detail.ageFrom', { min: listing.age_min })
        : listing.age_max
          ? t('listings.detail.ageTo', { max: listing.age_max })
          : null,
    listing.ideal_occupation && t(`listings.occupations.${listing.ideal_occupation}`),
  ].filter((item): item is string => !!item);
  const hasTransport =
    listing.metro_lines.length > 0 || !!listing.metro_station || !!listing.transport_notes;

  const photoWidth = Math.min(width, MaxContentWidth);

  return (
    <ThemedView style={styles.screen}>
      <Stack.Screen
        options={{
          title: t(`listings.types.${listing.type}`),
          headerRight: () =>
            listing.status === 'active' ? (
              <View style={styles.headerActions}>
                {!isOwner && <SaveButton listingId={listing.id} variant="plain" />}
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    share(
                      t('share.listingMessage', { title: listing.title }),
                      appUrl(`/listing/${listing.id}`)
                    )
                  }
                  hitSlop={10}
                  style={styles.headerButton}>
                  <ThemedText type="smallBold" style={{ color: theme.primary }}>
                    {t('share.share')}
                  </ThemedText>
                </Pressable>
              </View>
            ) : null,
        }}
      />
      <ScreenScrollView>
        {listing.photo_urls.length > 0 && (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            style={styles.gallery}>
            {listing.photo_urls.map((url) => (
              <Image
                key={url}
                source={{ uri: url }}
                style={{ width: photoWidth, height: photoWidth * 0.66 }}
                contentFit="cover"
              />
            ))}
          </ScrollView>
        )}

        <View style={styles.content}>
          <View style={styles.headerRow}>
            <ListingTypeTag type={listing.type} />
            {listing.status === 'closed' && (
              <ThemedText type="smallBold" themeColor="textSecondary">
                {t('listings.closed')}
              </ThemedText>
            )}
          </View>
          <ThemedText type="subtitle" style={styles.title}>
            {listing.title}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {placeLabel(listing.area_ids)}
          </ThemedText>
          <ListingPrice listing={listing} size="large" />

          {facts.length > 0 && (
            <View style={styles.facts}>
              {facts.map(([label, value]) => (
                <View
                  key={label}
                  style={[
                    styles.fact,
                    { borderColor: theme.border, backgroundColor: theme.backgroundElement },
                  ]}>
                  <ThemedText type="small" themeColor="textSecondary">
                    {label}
                  </ThemedText>
                  <ThemedText style={styles.bold}>{value}</ThemedText>
                </View>
              ))}
            </View>
          )}

          {listing.description ? (
            <ThemedText style={styles.description}>{listing.description}</ThemedText>
          ) : null}

          {listing.features.length > 0 && (
            <PillSection
              title={t('listings.detail.features')}
              items={listing.features.map((feature) => t(`listings.features.${feature}`))}
              check
            />
          )}
          {rules.length > 0 && <PillSection title={t('listings.detail.rules')} items={rules} />}
          {ideal.length > 0 && <PillSection title={t('listings.detail.ideal')} items={ideal} />}

          {hasTransport && (
            <View style={styles.locationSection}>
              <ThemedText style={styles.sectionTitle}>{t('listings.detail.transport')}</ThemedText>
              {(listing.metro_lines.length > 0 || listing.metro_station) && (
                <View style={styles.metroRow}>
                  <Icon name="metro" size={18} color={theme.textSecondary} />
                  {listing.metro_lines.map((line) => (
                    <MetroBadge key={line} line={line} size="small" />
                  ))}
                  {listing.metro_station ? (
                    <ThemedText style={styles.bold}>{listing.metro_station}</ThemedText>
                  ) : null}
                </View>
              )}
              {listing.transport_notes ? (
                <ThemedText themeColor="textSecondary">{listing.transport_notes}</ThemedText>
              ) : null}
            </View>
          )}

          {listing.latitude != null && listing.longitude != null && (
            <View style={styles.locationSection}>
              <ThemedText style={styles.sectionTitle}>{t('listings.location')}</ThemedText>
              <LocationMap
                center={{ latitude: listing.latitude, longitude: listing.longitude }}
                exact={listing.location_exact}
              />
              <ThemedText type="small" themeColor="textSecondary">
                {listing.location_exact ? (listing.address ?? '') : t('listings.approximateNote')}
              </ThemedText>
            </View>
          )}

          {owner && (
            <View
              style={[
                styles.ownerCard,
                { borderColor: theme.border, backgroundColor: theme.backgroundElement },
              ]}>
              <PressableLink
                href={{ pathname: '/user/[id]', params: { id: owner.id } }}
                accessibilityRole="link"
                style={[styles.ownerRow]}>
                <Avatar uri={owner.avatar_url} name={owner.first_name} size={48} />
                <View style={styles.flex}>
                  <ThemedText style={styles.bold}>
                    {owner.first_name}, {owner.age}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {[
                      owner.occupation && t(`profileSetup.options.occupation.${owner.occupation}`),
                      owner.languages.map((code) => SPOKEN_LANGUAGES[code]).join(', '),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </ThemedText>
                </View>
                <Icon name="chevron-right" size={18} color={theme.textSecondary} />
              </PressableLink>
              {me && !isOwner && <CompatibilityBox me={me} other={owner} bordered={false} />}
            </View>
          )}

          {listing.has_contact && <ListingContactCard listingId={listing.id} />}

          {actionError && (
            <ThemedText type="small" style={{ color: theme.danger }}>
              {t('messages.actionError')}
            </ThemedText>
          )}

          {isOwner ? (
            <View style={styles.actions}>
              {listing.status === 'active' && (
                <View
                  style={[
                    styles.expiryBox,
                    { borderColor: theme.border, backgroundColor: theme.backgroundSelected },
                  ]}>
                  <ThemedText type="small" style={styles.flex}>
                    {daysUntilExpiry(listing) > 0
                      ? t('listings.expiresIn', { count: daysUntilExpiry(listing) })
                      : t('listings.expiredNote')}
                  </ThemedText>
                  {daysUntilExpiry(listing) <= 14 && (
                    <Pressable
                      accessibilityRole="button"
                      disabled={busy}
                      onPress={renew}
                      hitSlop={8}
                      style={({ pressed }) => (pressed || busy) && styles.pressed}>
                      <ThemedText type="smallBold" style={{ color: theme.primary }}>
                        {t('listings.renew')}
                      </ThemedText>
                    </Pressable>
                  )}
                </View>
              )}
              <PressableLink
                href={{ pathname: '/edit-listing/[id]', params: { id: listing.id } }}
                accessibilityRole="button"
                style={[styles.primaryButton, { backgroundColor: theme.primary }]}>
                <ThemedText style={[styles.primaryButtonText, { color: theme.onPrimary }]}>
                  {t('listings.edit')}
                </ThemedText>
              </PressableLink>
              <View style={styles.row}>
                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={toggleClosed}
                  style={({ pressed }) => [
                    styles.secondaryButton,
                    { borderColor: theme.border },
                    (pressed || busy) && styles.pressed,
                  ]}>
                  <ThemedText type="smallBold">
                    {listing.status === 'active' ? t('listings.markClosed') : t('listings.reopen')}
                  </ThemedText>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={() => setConfirmDelete(true)}
                  style={({ pressed }) => [
                    styles.secondaryButton,
                    { borderColor: theme.border },
                    (pressed || busy) && styles.pressed,
                  ]}>
                  <ThemedText type="smallBold" style={{ color: theme.danger }}>
                    {t('listings.delete')}
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={message}
                style={({ pressed }) => [
                  styles.primaryButton,
                  { backgroundColor: theme.primary },
                  (pressed || busy) && styles.pressed,
                ]}>
                {busy ? (
                  <ActivityIndicator color={theme.onPrimary} />
                ) : (
                  <ThemedText style={[styles.primaryButtonText, { color: theme.onPrimary }]}>
                    {t('messages.sendMessage', { name: owner?.first_name ?? '' })}
                  </ThemedText>
                )}
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={report}
                hitSlop={8}
                style={styles.reportLink}>
                <ThemedText type="small" style={{ color: theme.danger }}>
                  {t('listings.report')}
                </ThemedText>
              </Pressable>
            </View>
          )}
        </View>
      </ScreenScrollView>

      <ActionSheet
        visible={confirmDelete}
        title={t('listings.deleteConfirmTitle')}
        message={t('listings.deleteConfirmBody')}
        options={[{ label: t('listings.delete'), destructive: true, onPress: remove }]}
        onClose={() => setConfirmDelete(false)}
      />
      {toast}
    </ThemedView>
  );
}

/** A titled group of small labels (what the flat has, house rules…). */
function PillSection({
  title,
  items,
  check = false,
}: {
  title: string;
  items: string[];
  check?: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={styles.locationSection}>
      <ThemedText style={styles.sectionTitle}>{title}</ThemedText>
      <View style={styles.pills}>
        {items.map((item) => (
          <View
            key={item}
            style={[styles.pill, styles.pillRow, { backgroundColor: theme.backgroundSelected }]}>
            {check && <Icon name="check" size={14} color={theme.primary} strokeWidth={2.4} />}
            <ThemedText type="small">{item}</ThemedText>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  metroRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  pillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerButton: {
    paddingHorizontal: Spacing.two,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  gallery: {
    alignSelf: 'center',
    maxWidth: MaxContentWidth,
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    padding: Spacing.four,
    gap: Spacing.three,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 26,
    lineHeight: 32,
  },
  facts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  fact: {
    flexGrow: 1,
    flexBasis: '45%',
    borderWidth: 1,
    borderRadius: 12,
    padding: Spacing.three,
    gap: 2,
  },
  description: {
    lineHeight: 24,
  },
  locationSection: {
    gap: Spacing.two,
  },
  sectionTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: 700,
  },
  ownerCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  ownerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  pill: {
    minHeight: 30,
    paddingHorizontal: 12,
    borderRadius: 999,
    justifyContent: 'center',
  },
  flex: {
    flex: 1,
  },
  bold: {
    fontWeight: 700,
  },
  actions: {
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  primaryButton: {
    height: 48,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: 700,
  },
  expiryBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: 12,
    padding: Spacing.three,
  },
  secondaryButton: {
    flex: 1,
    height: 48,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportLink: {
    alignSelf: 'center',
    paddingVertical: Spacing.two,
  },
  pressed: {
    opacity: 0.7,
  },
});
