import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { ListingForm, type ListingFormResult } from '@/components/listing-form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { fetchListing, updateListing } from '@/lib/listings';
import type { Listing } from '@/types/listing';

export default function EditListingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const theme = useTheme();
  const { session } = useSession();

  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    fetchListing(id)
      .then((found) => {
        if (!cancelled) setListing(found);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function save({ values, keptPhotoUrls, newPhotos }: ListingFormResult) {
    if (!listing) return 'generic' as const;
    try {
      await updateListing(listing, values, keptPhotoUrls, newPhotos);
    } catch {
      return 'generic' as const;
    }
    if (router.canGoBack()) router.back();
    else router.replace({ pathname: '/listing/[id]', params: { id: listing.id } });
    return null;
  }

  const isOwner = listing && listing.user_id === session?.user.id;

  return (
    <ThemedView style={styles.screen}>
      <Stack.Screen options={{ title: t('listings.edit') }} />
      {loading ? (
        <View style={[styles.screen, styles.centered]}>
          <ActivityIndicator color={theme.primary} />
        </View>
      ) : !isOwner || !listing ? (
        <View style={[styles.screen, styles.centered]}>
          <ThemedText themeColor="textSecondary">{t('listings.notFound')}</ThemedText>
        </View>
      ) : (
        <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <View style={styles.content}>
              <ListingForm initial={listing} submitLabel={t('editProfile.save')} onSubmit={save} />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
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
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    padding: Spacing.four,
  },
});
