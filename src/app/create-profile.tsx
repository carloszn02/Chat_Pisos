import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProfileForm } from '@/components/profile-form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useProfile } from '@/hooks/use-profile';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { createProfile, type ProfileFormValues } from '@/lib/profiles';
import { supabase } from '@/lib/supabase';

export default function CreateProfileScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { session } = useSession();
  const { refresh } = useProfile();

  async function save(values: ProfileFormValues) {
    if (!session) return 'generic' as const;
    const error = await createProfile(session.user.id, values);
    // Once the profile exists, the app moves on to the main screens by itself.
    if (!error) await refresh();
    return error;
  }

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.screen}>
        <KeyboardAvoidingView
          style={styles.screen}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <View style={styles.content}>
              <View style={styles.progress}>
                <View style={styles.progressLabels}>
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('profileSetup.progress')}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('profileSetup.duration')}
                  </ThemedText>
                </View>
                <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
                  <View style={[styles.progressFill, { backgroundColor: theme.primary }]} />
                </View>
              </View>

              <View style={styles.header}>
                <ThemedText type="subtitle" style={styles.title}>
                  {t('profileSetup.title')}
                </ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.bodyText}>
                  {t('profileSetup.intro')}
                </ThemedText>
              </View>

              <ProfileForm submitLabel={t('profileSetup.submit')} onSubmit={save} />

              <View style={styles.signOutRow}>
                <ThemedText type="small" themeColor="textSecondary">
                  {t('profileSetup.wrongAccount')}
                </ThemedText>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => supabase.auth.signOut()}
                  hitSlop={12}>
                  <ThemedText type="smallBold" style={{ color: theme.primary }}>
                    {t('profileSetup.signOut')}
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.four,
    gap: Spacing.four,
  },
  progress: {
    gap: Spacing.two,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressTrack: {
    height: 6,
    borderRadius: 999,
  },
  progressFill: {
    width: '60%',
    height: 6,
    borderRadius: 999,
  },
  header: {
    gap: Spacing.two,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
  },
  bodyText: {
    lineHeight: 24,
  },
  signOutRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
});
