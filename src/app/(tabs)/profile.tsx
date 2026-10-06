import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ListingCard } from '@/components/listing-card';
import { ProfileSummary } from '@/components/profile-summary';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useDistricts } from '@/hooks/use-districts';
import { useProfile } from '@/hooks/use-profile';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { SUPPORTED_LANGUAGES } from '@/i18n';
import { ageFromBirthDate } from '@/lib/age';
import { fetchMyListings } from '@/lib/listings';
import { supabase } from '@/lib/supabase';
import type { Listing } from '@/types/listing';

export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const { session } = useSession();
  const { profile } = useProfile();
  const districts = useDistricts();
  const [myListings, setMyListings] = useState<Listing[]>([]);
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

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.content}>
            <ProfileSummary profile={{ ...profile, age: ageFromBirthDate(profile.birth_date) }} />

            <Link href="/edit-profile" asChild>
              <Pressable
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.outlineButton,
                  { borderColor: theme.border, backgroundColor: theme.backgroundElement },
                  pressed && styles.pressed,
                ]}>
                <ThemedText type="smallBold">{t('profileTab.editProfile')}</ThemedText>
              </Pressable>
            </Link>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  {t('listings.mine')}
                </ThemedText>
                <Link href="/publish" asChild>
                  <Pressable accessibilityRole="button" hitSlop={8}>
                    <ThemedText type="smallBold" style={{ color: theme.primary }}>
                      + {t('listings.new')}
                    </ThemedText>
                  </Pressable>
                </Link>
              </View>
              {myListings.length === 0 ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {t('listings.mineEmpty')}
                </ThemedText>
              ) : (
                myListings.map((listing) => <ListingCard key={listing.id} listing={listing} districts={districts} />)
              )}
            </View>

            <View style={styles.section}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                {t('settings.language')}
              </ThemedText>
              <View style={[styles.list, { borderColor: theme.border }]}>
                {SUPPORTED_LANGUAGES.map((lang, index) => {
                  const selected = i18n.language === lang;
                  return (
                    <Pressable
                      key={lang}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      onPress={() => i18n.changeLanguage(lang)}
                      style={({ pressed }) => [
                        styles.row,
                        { backgroundColor: theme.backgroundElement },
                        index > 0 && { borderTopWidth: 1, borderTopColor: theme.border },
                        pressed && styles.pressed,
                      ]}>
                      <ThemedText>{t(`languages.${lang}`)}</ThemedText>
                      {selected && <ThemedText style={{ color: theme.primary }}>✓</ThemedText>}
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.section}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                {t('settings.account')}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {t('settings.signedInAs', { email: session?.user.email ?? '' })}
              </ThemedText>
              <View style={[styles.list, { borderColor: theme.border }]}>
                <Link href="/blocked-users" asChild>
                  <Pressable
                    accessibilityRole="link"
                    style={({ pressed }) => [
                      styles.row,
                      { backgroundColor: theme.backgroundElement },
                      pressed && styles.pressed,
                    ]}>
                    <ThemedText>{t('blocked.title')}</ThemedText>
                    <ThemedText themeColor="textSecondary">›</ThemedText>
                  </Pressable>
                </Link>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => supabase.auth.signOut()}
                  style={({ pressed }) => [
                    styles.row,
                    { backgroundColor: theme.backgroundElement, borderTopWidth: 1, borderTopColor: theme.border },
                    pressed && styles.pressed,
                  ]}>
                  <ThemedText style={{ color: theme.danger }}>{t('settings.signOut')}</ThemedText>
                </Pressable>
              </View>
            </View>
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
  outlineButton: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  section: {
    gap: Spacing.two,
  },
  list: {
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  row: {
    minHeight: 48,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pressed: {
    opacity: 0.7,
  },
});
