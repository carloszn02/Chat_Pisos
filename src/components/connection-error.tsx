import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

/** Full-screen "No connection" message with a retry button. */
export function ConnectionError({ onRetry }: { onRetry: () => Promise<void> }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [retrying, setRetrying] = useState(false);

  async function retry() {
    setRetrying(true);
    await onRetry();
    setRetrying(false);
  }

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.screen}>
        <View style={styles.content}>
          <ThemedText type="subtitle" style={styles.centered}>
            {t('connection.title')}
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={[styles.centered, styles.body]}>
            {t('connection.body')}
          </ThemedText>
          <Pressable
            accessibilityRole="button"
            disabled={retrying}
            onPress={retry}
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: theme.primary },
              (pressed || retrying) && styles.pressed,
            ]}>
            {retrying ? (
              <ActivityIndicator color={theme.onPrimary} />
            ) : (
              <ThemedText style={[styles.buttonText, { color: theme.onPrimary }]}>
                {t('connection.retry')}
              </ThemedText>
            )}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => supabase.auth.signOut()}
            hitSlop={12}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
              {t('settings.signOut')}
            </ThemedText>
          </Pressable>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
    gap: Spacing.three,
  },
  centered: {
    textAlign: 'center',
  },
  body: {
    lineHeight: 24,
  },
  button: {
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.two,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 700,
  },
  pressed: {
    opacity: 0.7,
  },
});
