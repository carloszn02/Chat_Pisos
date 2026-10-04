import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ProfileSummary } from '@/components/profile-summary';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
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

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState(false);

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

            {!isMe && (
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
          </View>
        </ScrollView>
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
  pressed: {
    opacity: 0.7,
  },
});
