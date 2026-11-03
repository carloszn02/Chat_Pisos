import { router, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

/** Shown for an address that doesn't match any screen (e.g. a mistyped or old link). */
export default function NotFoundScreen() {
  const { t } = useTranslation();
  return (
    <ThemedView style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.screen}>
        <View style={styles.content}>
          <ThemedText type="subtitle" style={styles.centered}>
            {t('notFound.title')}
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.centered}>
            {t('notFound.body')}
          </ThemedText>
          <Button label={t('notFound.home')} onPress={() => router.replace('/')} />
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
    maxWidth: 420,
    alignSelf: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
  },
  centered: {
    textAlign: 'center',
  },
});
