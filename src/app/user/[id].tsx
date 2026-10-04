import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ActionSheet } from '@/components/action-sheet';
import { ProfileSummary } from '@/components/profile-summary';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useBlocks } from '@/hooks/use-blocks';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { fetchPublicProfile } from '@/lib/chat';
import { startConversation } from '@/lib/direct-messages';
import type { PublicProfile } from '@/types/chat';

/** Another user's public profile, with a button to message them. */
export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const theme = useTheme();
  const { session } = useSession();
  const { blockedIds, block, unblock } = useBlocks();

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    fetchPublicProfile(id)
      .then((found) => {
        if (!cancelled) setProfile(found);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function message() {
    if (!profile) return;
    setStarting(true);
    setError(false);
    try {
      const conversationId = await startConversation(profile.id);
      router.push({ pathname: '/conversation/[id]', params: { id: conversationId } });
    } catch {
      setError(true);
    } finally {
      setStarting(false);
    }
  }

  const isMe = profile?.id === session?.user.id;
  const isBlocked = !!profile && blockedIds.has(profile.id);

  async function toggleBlock() {
    if (!profile) return;
    setError(false);
    try {
      if (isBlocked) await unblock(profile.id);
      else await block(profile.id);
    } catch {
      setError(true);
    }
  }

  function report() {
    if (!profile) return;
    router.push({ pathname: '/report', params: { userId: profile.id, name: profile.first_name } });
  }

  return (
    <ThemedView style={styles.screen}>
      <Stack.Screen options={{ title: profile?.first_name ?? '' }} />
      {loading ? (
        <View style={[styles.screen, styles.centered]}>
          <ActivityIndicator color={theme.primary} />
        </View>
      ) : !profile ? (
        <View style={[styles.screen, styles.centered]}>
          <ThemedText themeColor="textSecondary">{t('messages.userNotFound')}</ThemedText>
        </View>
      ) : (
        <ScrollView>
          <View style={styles.content}>
            <ProfileSummary profile={profile} />

            {error && (
              <ThemedText type="small" style={{ color: theme.danger }}>
                {t('messages.actionError')}
              </ThemedText>
            )}

            {isBlocked && (
              <ThemedText type="small" themeColor="textSecondary">
                {t('blocked.youBlocked', { name: profile.first_name })}
              </ThemedText>
            )}

            {!isMe && !isBlocked && (
              <Pressable
                accessibilityRole="button"
                disabled={starting}
                onPress={message}
                style={({ pressed }) => [
                  styles.primaryButton,
                  { backgroundColor: theme.primary },
                  (pressed || starting) && styles.pressed,
                ]}>
                {starting ? (
                  <ActivityIndicator color={theme.onPrimary} />
                ) : (
                  <ThemedText style={[styles.primaryButtonText, { color: theme.onPrimary }]}>
                    {t('messages.sendMessage', { name: profile.first_name })}
                  </ThemedText>
                )}
              </Pressable>
            )}
            {!isMe && (
              <View style={styles.secondaryRow}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => (isBlocked ? toggleBlock() : setConfirmBlock(true))}
                  style={({ pressed }) => [styles.secondaryButton, { borderColor: theme.border }, pressed && styles.pressed]}>
                  <ThemedText type="smallBold">
                    {isBlocked ? t('blocked.unblock') : t('blocked.block')}
                  </ThemedText>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={report}
                  style={({ pressed }) => [styles.secondaryButton, { borderColor: theme.border }, pressed && styles.pressed]}>
                  <ThemedText type="smallBold" style={{ color: theme.danger }}>
                    {t('report.action')}
                  </ThemedText>
                </Pressable>
              </View>
            )}
          </View>
        </ScrollView>
      )}
      {profile && (
        <ActionSheet
          visible={confirmBlock}
          title={t('blocked.confirmTitle', { name: profile.first_name })}
          message={t('blocked.confirmBody')}
          options={[{ label: t('blocked.block'), destructive: true, onPress: toggleBlock }]}
          onClose={() => setConfirmBlock(false)}
        />
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
    gap: Spacing.four,
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
  secondaryRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  secondaryButton: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});
