import { Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';
import { deleteMyAccount } from '@/lib/account';

/** Permanently deletes the account after explaining what will be lost. */
export default function DeleteAccountScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { profile } = useProfile();

  const [understood, setUnderstood] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function confirmDelete() {
    if (!profile || !understood) return;
    setBusy(true);
    setError(false);
    try {
      // After this the user is logged out and the app returns to the sign-up screen.
      await deleteMyAccount(profile);
    } catch {
      setError(true);
      setBusy(false);
    }
  }

  const items = [
    t('deleteAccount.items.profile'),
    t('deleteAccount.items.listings'),
    t('deleteAccount.items.messages'),
    t('deleteAccount.items.groups'),
  ];

  return (
    <ThemedView style={styles.screen}>
      <Stack.Screen options={{ title: t('deleteAccount.title') }} />
      <ScrollView>
        <View style={styles.content}>
          <ThemedText type="subtitle" style={styles.title}>
            {t('deleteAccount.heading')}
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.bodyText}>
            {t('deleteAccount.intro')}
          </ThemedText>

          <View style={[styles.box, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
            {items.map((item) => (
              <ThemedText key={item} style={styles.bodyText}>
                • {item}
              </ThemedText>
            ))}
          </View>

          <ThemedText type="small" themeColor="textSecondary" style={styles.bodyText}>
            {t('deleteAccount.reportsNote')}
          </ThemedText>

          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: understood }}
            onPress={() => setUnderstood(!understood)}
            style={styles.checkboxRow}>
            <View
              style={[
                styles.checkbox,
                { borderColor: understood ? theme.danger : theme.border },
                understood && { backgroundColor: theme.danger },
              ]}>
              {understood && (
                <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
                  ✓
                </ThemedText>
              )}
            </View>
            <ThemedText style={styles.flex}>{t('deleteAccount.confirmCheckbox')}</ThemedText>
          </Pressable>

          {error && (
            <ThemedText type="small" style={{ color: theme.danger }} accessibilityLiveRegion="polite">
              {t('deleteAccount.error')}
            </ThemedText>
          )}

          <Pressable
            accessibilityRole="button"
            disabled={!understood || busy}
            onPress={confirmDelete}
            style={({ pressed }) => [
              styles.deleteButton,
              { backgroundColor: theme.danger },
              (!understood || busy || pressed) && styles.dimmed,
            ]}>
            {busy ? (
              <ActivityIndicator color={theme.onPrimary} />
            ) : (
              <ThemedText style={[styles.deleteButtonText, { color: theme.onPrimary }]}>
                {t('deleteAccount.button')}
              </ThemedText>
            )}
          </Pressable>
        </View>
      </ScrollView>
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
  title: {
    fontSize: 26,
    lineHeight: 32,
  },
  bodyText: {
    lineHeight: 22,
  },
  box: {
    borderWidth: 1,
    borderRadius: 14,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  flex: {
    flex: 1,
  },
  deleteButton: {
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.two,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: 700,
  },
  dimmed: {
    opacity: 0.5,
  },
});
