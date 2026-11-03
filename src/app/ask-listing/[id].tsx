import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ConnectionPicker } from '@/components/connection-picker';
import { FormScrollView } from '@/components/form-scroll-view';
import { ListingCard } from '@/components/listing-card';
import { DetailSkeleton } from '@/components/skeleton';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { fetchPublicProfile } from '@/lib/chat';
import {
  askAboutListing,
  askErrorKey,
  fetchFlatmateCandidates,
  MAX_FLATMATES,
  type AskErrorKey,
} from '@/lib/listing-sharing';
import { fetchListing } from '@/lib/listings';
import type { PublicProfile } from '@/types/chat';
import type { Listing } from '@/types/listing';

/**
 * "Ask with my flatmates": choose the people you're flat-hunting with, and a group about this
 * listing is created. The publisher gets an invitation they can accept or decline.
 */
export default function AskListingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const theme = useTheme();
  const { session } = useSession();
  const userId = session?.user.id;
  const [listing, setListing] = useState<Listing | null>(null);
  const [publisher, setPublisher] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [flatmates, setFlatmates] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AskErrorKey | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    void (async () => {
      try {
        const found = await fetchListing(id);
        const owner = found ? await fetchPublicProfile(found.user_id) : null;
        if (cancelled) return;
        setListing(found);
        setPublisher(owner);
      } catch {
        if (!cancelled) setError('generic');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const loadPeople = useCallback(
    () => (userId ? fetchFlatmateCandidates(userId) : Promise.resolve([])),
    [userId]
  );

  async function create() {
    if (!listing) return;
    setBusy(true);
    setError(null);
    try {
      const groupId = await askAboutListing(listing.id, flatmates);
      router.replace({ pathname: '/private-group/[id]', params: { id: groupId } });
    } catch (askError) {
      setError(askErrorKey(askError));
      setBusy(false);
    }
  }

  const name = publisher?.first_name ?? '';

  return (
    <ThemedView style={styles.screen}>
      <Stack.Screen options={{ title: t('listingChats.askTitle') }} />
      <FormScrollView bottomInset>
        <View style={styles.content}>
          {loading ? (
            <DetailSkeleton />
          ) : !listing || listing.status !== 'active' ? (
            <ThemedText themeColor="textSecondary">
              {t('listingChats.errors.listingUnavailable')}
            </ThemedText>
          ) : (
            <>
              <ListingCard listing={listing} owner={publisher ?? undefined} compact />
              <ThemedText themeColor="textSecondary" style={styles.intro}>
                {t('listingChats.askIntro', { name })}
              </ThemedText>

              <View style={styles.field}>
                <ThemedText type="smallBold">
                  {t('listingChats.askPeopleLabel', { count: flatmates.length })}
                </ThemedText>
                <ConnectionPicker
                  selected={flatmates}
                  onChange={setFlatmates}
                  maxSelected={MAX_FLATMATES}
                  excludeIds={[listing.user_id]}
                  loadPeople={loadPeople}
                  emptyText={t('listingChats.askNoPeople', { name })}
                />
              </View>

              {error && (
                <ThemedText
                  type="small"
                  style={{ color: theme.danger }}
                  accessibilityLiveRegion="polite">
                  {t(`listingChats.errors.${error}`, { name, max: MAX_FLATMATES })}
                </ThemedText>
              )}

              <Button
                label={t('listingChats.askCreate', { name })}
                icon="users"
                loading={busy}
                onPress={create}
              />
            </>
          )}
        </View>
      </FormScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    padding: Spacing.four,
    gap: Spacing.four,
  },
  intro: {
    lineHeight: 22,
  },
  field: {
    gap: Spacing.two,
  },
});
