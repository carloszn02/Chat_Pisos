import { Image } from 'expo-image';
import { Link, router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import { ActionSheet } from '@/components/action-sheet';
import { Avatar } from '@/components/avatar';
import { ListingPrice, ListingTypeTag } from '@/components/listing-card';
import { LocationMap } from '@/components/location-map';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { districtNames, useDistricts } from '@/hooks/use-districts';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';
import { fetchPublicProfile } from '@/lib/chat';
import { startConversation } from '@/lib/direct-messages';
import { formatDate } from '@/lib/format';
import { deleteListing, fetchListing, setListingStatus } from '@/lib/listings';
import type { PublicProfile } from '@/types/chat';
import type { Listing } from '@/types/listing';
import { SPOKEN_LANGUAGES } from '@/types/profile';

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const districts = useDistricts();
  const { profile: me } = useProfile();

  const [listing, setListing] = useState<Listing | null>(null);
  const [owner, setOwner] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

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
      router.push({ pathname: '/conversation/[id]', params: { id: conversationId } });
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
      params: { userId: listing.user_id, name: owner?.first_name ?? '', listingId: listing.id, snapshot: listing.title },
    });
  }

  if (loading || !listing) {
    return (
      <ThemedView style={[styles.screen, styles.centered]}>
        <Stack.Screen options={{ title: '' }} />
        {loading ? (
          <ActivityIndicator color={theme.primary} />
        ) : (
          <ThemedText themeColor="textSecondary">{t('listings.notFound')}</ThemedText>
        )}
      </ThemedView>
    );
  }

  const yesNo = (value: boolean | null) => (value === null ? null : t(value ? 'listings.yes' : 'listings.no'));
  const facts = [
    [t('listings.facts.availableFrom'), formatDate(listing.available_from, i18n.language)],
    [t('listings.facts.minStay'), listing.min_stay_months && t('listings.months', { count: listing.min_stay_months })],
    [t('listings.facts.billsIncluded'), yesNo(listing.bills_included)],
    [t('listings.facts.furnished'), yesNo(listing.furnished)],
    [t('listings.facts.roomSize'), listing.room_size_m2 && `${listing.room_size_m2} m²`],
    [t('listings.facts.flatmates'), listing.flatmates != null ? String(listing.flatmates) : null],
    [t('listings.facts.bedrooms'), listing.bedrooms && String(listing.bedrooms)],
  ].filter((fact): fact is [string, string] => !!fact[1]);

  // Habits both people chose the same answer for.
  const inCommon: string[] = [];
  if (me && owner && !isOwner) {
    if (me.schedule && me.schedule === owner.schedule) {
      inCommon.push(t(`profileSetup.options.schedule.${me.schedule}`));
    }
    if (me.tidiness && me.tidiness === owner.tidiness) {
      inCommon.push(t(`profileSetup.options.tidiness.${me.tidiness}`));
    }
    if (me.smoking && me.smoking === owner.smoking) {
      inCommon.push(t(`profileSetup.options.smoking.${me.smoking}`));
    }
    if (me.pets && me.pets === owner.pets) {
      inCommon.push(t(`profileSetup.options.pets.${me.pets}`));
    }
  }

  const photoWidth = Math.min(width, MaxContentWidth);

  return (
    <ThemedView style={styles.screen}>
      <Stack.Screen options={{ title: t(`listings.types.${listing.type}`) }} />
      <ScrollView>
        {listing.photo_urls.length > 0 && (
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={styles.gallery}>
            {listing.photo_urls.map((url) => (
              <Image key={url} source={{ uri: url }} style={{ width: photoWidth, height: photoWidth * 0.66 }} contentFit="cover" />
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
            {districtNames(listing.district_ids, districts)}
          </ThemedText>
          <ListingPrice listing={listing} large />

          {facts.length > 0 && (
            <View style={styles.facts}>
              {facts.map(([label, value]) => (
                <View key={label} style={[styles.fact, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
                  <ThemedText type="small" themeColor="textSecondary">
                    {label}
                  </ThemedText>
                  <ThemedText style={styles.bold}>{value}</ThemedText>
                </View>
              ))}
            </View>
          )}

          {listing.description ? <ThemedText style={styles.description}>{listing.description}</ThemedText> : null}

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
            <View style={[styles.ownerCard, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
              <Link href={{ pathname: '/user/[id]', params: { id: owner.id } }} asChild>
                <Pressable accessibilityRole="link" style={({ pressed }) => [styles.ownerRow, pressed && styles.pressed]}>
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
                  <ThemedText themeColor="textSecondary">›</ThemedText>
                </Pressable>
              </Link>
              {inCommon.length > 0 && (
                <>
                  <ThemedText type="smallBold" themeColor="textSecondary">
                    {t('listings.inCommon')}
                  </ThemedText>
                  <View style={styles.pills}>
                    {inCommon.map((habit) => (
                      <View key={habit} style={[styles.pill, { backgroundColor: theme.backgroundSelected }]}>
                        <ThemedText type="small">{habit}</ThemedText>
                      </View>
                    ))}
                  </View>
                </>
              )}
            </View>
          )}

          {actionError && (
            <ThemedText type="small" style={{ color: theme.danger }}>
              {t('messages.actionError')}
            </ThemedText>
          )}

          {isOwner ? (
            <View style={styles.actions}>
              <Link href={{ pathname: '/edit-listing/[id]', params: { id: listing.id } }} asChild>
                <Pressable
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.primaryButton, { backgroundColor: theme.primary }, pressed && styles.pressed]}>
                  <ThemedText style={[styles.primaryButtonText, { color: theme.onPrimary }]}>{t('listings.edit')}</ThemedText>
                </Pressable>
              </Link>
              <View style={styles.row}>
                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={toggleClosed}
                  style={({ pressed }) => [styles.secondaryButton, { borderColor: theme.border }, (pressed || busy) && styles.pressed]}>
                  <ThemedText type="smallBold">
                    {listing.status === 'active' ? t('listings.markClosed') : t('listings.reopen')}
                  </ThemedText>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={() => setConfirmDelete(true)}
                  style={({ pressed }) => [styles.secondaryButton, { borderColor: theme.border }, (pressed || busy) && styles.pressed]}>
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
                style={({ pressed }) => [styles.primaryButton, { backgroundColor: theme.primary }, (pressed || busy) && styles.pressed]}>
                {busy ? (
                  <ActivityIndicator color={theme.onPrimary} />
                ) : (
                  <ThemedText style={[styles.primaryButtonText, { color: theme.onPrimary }]}>
                    {t('messages.sendMessage', { name: owner?.first_name ?? '' })}
                  </ThemedText>
                )}
              </Pressable>
              <Pressable accessibilityRole="button" onPress={report} hitSlop={8} style={styles.reportLink}>
                <ThemedText type="small" style={{ color: theme.danger }}>
                  {t('listings.report')}
                </ThemedText>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>

      <ActionSheet
        visible={confirmDelete}
        title={t('listings.deleteConfirmTitle')}
        message={t('listings.deleteConfirmBody')}
        options={[{ label: t('listings.delete'), destructive: true, onPress: remove }]}
        onClose={() => setConfirmDelete(false)}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
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
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: 700,
  },
  secondaryButton: {
    flex: 1,
    height: 44,
    borderRadius: 12,
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
