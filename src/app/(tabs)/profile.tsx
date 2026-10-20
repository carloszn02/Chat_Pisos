import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableLink } from '@/components/pressable-link';
import { Button, IconButton } from '@/components/button';
import { ListingCard } from '@/components/listing-card';
import { ProfileSummary } from '@/components/profile-summary';
import { ScreenHeader } from '@/components/screen-header';
import { SegmentedControl } from '@/components/segmented-control';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';
import { ageFromBirthDate } from '@/lib/age';
import { fetchMyListings } from '@/lib/listings';
import type { Listing } from '@/types/listing';

type Section = 'about' | 'listings';

/** Your profile in two parts, "About me" and your listings, with Settings at the top. */
export default function ProfileScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { profile } = useProfile();
  const [myListings, setMyListings] = useState<Listing[] | null>(null);
  const [section, setSection] = useState<Section>('about');
  const userId = profile?.id;

  // Refresh every time the tab is shown (e.g. after creating or editing a listing).
  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      let cancelled = false;
      fetchMyListings(userId)
        .then((found) => {
          if (!cancelled) setMyListings(found);
        })
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }, [userId])
  );

  if (!profile) return null;

  const summary = { ...profile, age: ageFromBirthDate(profile.birth_date) };
  const hasDetails =
    !!profile.about || !!(profile.schedule || profile.tidiness || profile.smoking || profile.pets);
  const listingCount = myListings?.length ?? 0;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.content}>
            <ScreenHeader
              title={t('profileTab.title')}
              actions={
                <IconButton
                  icon="settings"
                  label={t('settings.title')}
                  onPress={() => router.push('/settings')}
                />
              }
            />

            <ProfileSummary profile={summary} part="identity" />

            <Button
              label={t('profileTab.editProfile')}
              variant="secondary"
              onPress={() => router.push('/edit-profile')}
            />

            <SegmentedControl
              segments={[
                { key: 'about', label: t('profileTab.aboutTab') },
                {
                  key: 'listings',
                  label:
                    listingCount > 0
                      ? `${t('profileTab.listingsTab')} · ${listingCount}`
                      : t('profileTab.listingsTab'),
                },
              ]}
              selected={section}
              onChange={setSection}
            />

            {section === 'about' ? (
              hasDetails ? (
                <ProfileSummary profile={summary} part="details" />
              ) : (
                <View style={[styles.emptyBox, { backgroundColor: theme.backgroundSelected }]}>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
                    {t('profileTab.emptyAbout')}
                  </ThemedText>
                  <PressableLink href="/edit-profile" accessibilityRole="link" hitSlop={8}>
                    <ThemedText type="smallBold" style={{ color: theme.primary }}>
                      {t('profileTab.addAbout')}
                    </ThemedText>
                  </PressableLink>
                </View>
              )
            ) : (
              <View style={styles.section}>
                <Button
                  label={t('listings.new')}
                  icon="plus"
                  variant="secondary"
                  onPress={() => router.push('/publish')}
                />
                {myListings && myListings.length === 0 ? (
                  <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
                    {t('listings.mineEmpty')}
                  </ThemedText>
                ) : (
                  myListings?.map((listing) => <ListingCard key={listing.id} listing={listing} />)
                )}
              </View>
            )}
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
    gap: Spacing.four,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gearFallback: {
    fontSize: 20,
    lineHeight: 24,
  },
  outlineButton: {
    height: 48,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dashed: {
    borderStyle: 'dashed',
    borderWidth: 1.5,
  },
  section: {
    gap: Spacing.three,
  },
  emptyBox: {
    borderRadius: 14,
    padding: Spacing.four,
    alignItems: 'center',
    gap: Spacing.two,
  },
  centerText: {
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});
