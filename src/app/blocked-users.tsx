import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { RowsSkeleton } from '@/components/skeleton';
import { Avatar } from '@/components/avatar';
import { ScreenScrollView } from '@/components/screen-scroll-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useBlocks } from '@/hooks/use-blocks';
import { useTheme } from '@/hooks/use-theme';
import { fetchAuthors } from '@/lib/chat';
import type { PublicProfile } from '@/types/chat';

export default function BlockedUsersScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { blockedIds, unblock } = useBlocks();

  const [users, setUsers] = useState<Map<string, PublicProfile> | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchAuthors([...blockedIds])
      .then((found) => {
        if (!cancelled) setUsers(found);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [blockedIds]);

  async function handleUnblock(userId: string) {
    setBusyId(userId);
    setError(false);
    try {
      await unblock(userId);
    } catch {
      setError(true);
    } finally {
      setBusyId(null);
    }
  }

  const ids = [...blockedIds];

  return (
    <ThemedView style={styles.screen}>
      <Stack.Screen options={{ title: t('blocked.title') }} />
      <ScreenScrollView>
        <View style={styles.content}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.intro}>
            {t('blocked.intro')}
          </ThemedText>

          {error && (
            <ThemedText type="small" style={{ color: theme.danger }}>
              {t('messages.actionError')}
            </ThemedText>
          )}

          {ids.length === 0 ? (
            <ThemedText themeColor="textSecondary">{t('blocked.empty')}</ThemedText>
          ) : !users ? (
            <RowsSkeleton count={Math.min(ids.length, 5)} />
          ) : (
            ids.map((id) => {
              const user = users.get(id);
              return (
                <View key={id} style={styles.row}>
                  <Avatar uri={user?.avatar_url ?? null} name={user?.first_name ?? '?'} size={44} />
                  <ThemedText style={styles.name}>
                    {user ? `${user.first_name}, ${user.age}` : '…'}
                  </ThemedText>
                  <Pressable
                    accessibilityRole="button"
                    disabled={busyId === id}
                    onPress={() => handleUnblock(id)}
                    style={({ pressed }) => [
                      styles.unblockButton,
                      { borderColor: theme.border },
                      (pressed || busyId === id) && styles.pressed,
                    ]}>
                    <ThemedText type="smallBold">{t('blocked.unblock')}</ThemedText>
                  </Pressable>
                </View>
              );
            })
          )}
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
  intro: {
    lineHeight: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  name: {
    flex: 1,
    fontWeight: 700,
  },
  unblockButton: {
    height: 36,
    paddingHorizontal: Spacing.three,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
});
