import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
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

/** Sign-up: the profile form in three steps (the form shows the progress and titles). */
export default function CreateProfileScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { session } = useSession();
  const { refresh } = useProfile();
  const scrollRef = useRef<ScrollView>(null);

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
          <ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled">
            <View style={styles.content}>
              <ProfileForm
                submitLabel={t('profileSetup.submit')}
                onSubmit={save}
                onStepChange={() => scrollRef.current?.scrollTo({ y: 0, animated: false })}
              />

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
  signOutRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
});
