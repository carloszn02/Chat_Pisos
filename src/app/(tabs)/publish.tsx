import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormScrollView } from '@/components/form-scroll-view';
import { HintCard } from '@/components/hint-card';
import { ListingForm, type ListingFormResult } from '@/components/listing-form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing, TabScreenEdges } from '@/constants/theme';
import { useHint } from '@/hooks/use-hint';
import { useSession } from '@/hooks/use-session';
import { isRateLimitError } from '@/lib/errors';
import { createListing, shareListingInGroups } from '@/lib/listings';

/** The Publish tab: a dedicated place to post a listing, like Instagram's "+" button. */
export default function PublishScreen() {
  const { t } = useTranslation();
  const { session } = useSession();
  const publishHint = useHint('publish');
  // Changing the key gives a fresh, empty form after each publication.
  const [formKey, setFormKey] = useState(0);

  async function publish({ values, newPhotos, shareInGroups, contact }: ListingFormResult) {
    if (!session) return 'generic' as const;
    let listing;
    try {
      listing = await createListing(session.user.id, values, newPhotos, contact);
    } catch (error) {
      return isRateLimitError(error) ? ('rateLimit' as const) : ('generic' as const);
    }
    if (shareInGroups) {
      try {
        await shareListingInGroups(listing);
      } catch {
        // The listing exists; failing to post it in the chat shouldn't lose it.
        console.warn('Could not share listing in groups');
      }
    }
    setFormKey((key) => key + 1);
    // The listing page then suggests sharing it.
    router.push({ pathname: '/listing/[id]', params: { id: listing.id, published: '1' } });
    return null;
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container} edges={TabScreenEdges}>
        <FormScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.content}>
            <View style={styles.header}>
              <ThemedText type="subtitle">{t('publish.title')}</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.intro}>
                {t('publish.intro')}
              </ThemedText>
            </View>
            {publishHint.visible && (
              <HintCard icon="house" body={t('hints.publish')} onDismiss={publishHint.dismiss} />
            )}
            <ListingForm
              key={formKey}
              draftKey="publish"
              submitLabel={t('listings.form.publish')}
              onSubmit={publish}
            />
          </View>
        </FormScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
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
    gap: Spacing.two,
  },
  intro: {
    lineHeight: 24,
  },
});
