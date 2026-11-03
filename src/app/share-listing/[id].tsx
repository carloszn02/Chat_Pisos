import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { GroupTile } from '@/components/group-tile';
import { Icon } from '@/components/icon';
import { ListingCard } from '@/components/listing-card';
import { PrivateGroupBadge } from '@/components/private-group-row';
import { ScreenScrollView } from '@/components/screen-scroll-view';
import { RowsSkeleton } from '@/components/skeleton';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useBlocks } from '@/hooks/use-blocks';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { fetchShareTargets, sendListingTo, type ShareTarget } from '@/lib/listing-sharing';
import { fetchListing } from '@/lib/listings';
import type { Listing } from '@/types/listing';

/** "Send to a chat": pick one of your chats, the listing goes there as a card. */
export default function ShareListingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const theme = useTheme();
  const { session } = useSession();
  const userId = session?.user.id;
  const { blockedIds } = useBlocks();
  const [listing, setListing] = useState<Listing | null>(null);
  const [targets, setTargets] = useState<ShareTarget[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [sendError, setSendError] = useState(false);

  useEffect(() => {
    if (!id || !userId) return;
    let cancelled = false;
    void (async () => {
      try {
        const [found, chats] = await Promise.all([fetchListing(id), fetchShareTargets(userId)]);
        if (cancelled) return;
        setListing(found);
        setTargets(chats);
      } catch {
        if (!cancelled) setLoadError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, userId]);

  async function send(target: ShareTarget) {
    if (!listing) return;
    setSendingTo(target.id);
    setSendError(false);
    try {
      await sendListingTo(target, listing);
      // Open the chat, so you see the card there and can add a message.
      if (target.kind === 'private_group') {
        router.replace({ pathname: '/private-group/[id]', params: { id: target.id } });
      } else if (target.kind === 'conversation') {
        router.replace({ pathname: '/conversation/[id]', params: { id: target.id } });
      } else {
        router.replace({ pathname: '/group/[slug]', params: { slug: target.group.slug } });
      }
    } catch {
      setSendError(true);
      setSendingTo(null);
    }
  }

  const visible = (targets ?? []).filter(
    (target) => target.kind !== 'conversation' || !blockedIds.has(target.personId)
  );
  const sections: { kind: ShareTarget['kind']; title: string }[] = [
    { kind: 'private_group', title: t('listingChats.privateGroups') },
    { kind: 'conversation', title: t('listingChats.conversations') },
    { kind: 'group', title: t('listingChats.districtGroups') },
  ];

  function nameOf(target: ShareTarget): string {
    if (target.kind === 'conversation') return target.person?.first_name ?? '…';
    return target.group.name;
  }

  function pictureOf(target: ShareTarget) {
    if (target.kind === 'private_group') {
      return (
        <PrivateGroupBadge name={target.group.name} photoUrl={target.group.photo_url} size={40} />
      );
    }
    if (target.kind === 'conversation') {
      return (
        <Avatar
          uri={target.person?.avatar_url ?? null}
          name={target.person?.first_name ?? '?'}
          size={40}
        />
      );
    }
    return <GroupTile group={target.group} size={40} />;
  }

  return (
    <ThemedView style={styles.screen}>
      <Stack.Screen options={{ title: t('listingChats.send') }} />
      <ScreenScrollView>
        <View style={styles.content}>
          {listing && <ListingCard listing={listing} compact />}
          <ThemedText themeColor="textSecondary">{t('listingChats.sendIntro')}</ThemedText>

          {sendError && (
            <ThemedText
              type="small"
              style={{ color: theme.danger }}
              accessibilityLiveRegion="polite">
              {t('listingChats.sendError')}
            </ThemedText>
          )}
          {loadError && (
            <ThemedText type="small" style={{ color: theme.danger }}>
              {t('messages.loadError')}
            </ThemedText>
          )}
          {!targets && !loadError && <RowsSkeleton count={4} />}
          {targets && visible.length === 0 && (
            <ThemedText themeColor="textSecondary">{t('listingChats.noChats')}</ThemedText>
          )}

          {sections.map(({ kind, title }) => {
            const rows = visible.filter((target) => target.kind === kind);
            if (rows.length === 0) return null;
            return (
              <View key={kind} style={styles.section}>
                <ThemedText style={styles.sectionTitle}>{title}</ThemedText>
                <View style={[styles.list, { borderColor: theme.border }]}>
                  {rows.map((target, index) => (
                    <Pressable
                      key={target.id}
                      accessibilityRole="button"
                      accessibilityLabel={`${t('listingChats.send')}: ${nameOf(target)}`}
                      disabled={sendingTo !== null}
                      onPress={() => send(target)}
                      style={({ pressed }) => [
                        styles.row,
                        { backgroundColor: theme.backgroundElement },
                        index > 0 && { borderTopWidth: 1, borderTopColor: theme.divider },
                        pressed && { backgroundColor: theme.backgroundSelected },
                      ]}>
                      {pictureOf(target)}
                      <ThemedText style={styles.name} numberOfLines={1}>
                        {nameOf(target)}
                      </ThemedText>
                      {sendingTo === target.id ? (
                        <ActivityIndicator color={theme.primary} />
                      ) : (
                        <Icon name="chevron-right" size={18} color={theme.textSecondary} />
                      )}
                    </Pressable>
                  ))}
                </View>
              </View>
            );
          })}
        </View>
      </ScreenScrollView>
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
    gap: Spacing.three,
  },
  section: {
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 700,
  },
  list: {
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 56,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  name: {
    flex: 1,
    fontWeight: 700,
  },
});
