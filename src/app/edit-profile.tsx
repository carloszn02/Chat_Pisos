import { router, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { ProfileForm } from '@/components/profile-form';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useProfile } from '@/hooks/use-profile';
import { forgetAuthor } from '@/lib/chat';
import { updateProfile, type ProfileFormValues } from '@/lib/profiles';

export default function EditProfileScreen() {
  const { t } = useTranslation();
  const { profile, refresh } = useProfile();

  async function save(values: ProfileFormValues) {
    if (!profile) return 'generic' as const;
    const error = await updateProfile(profile, values);
    if (!error) {
      forgetAuthor(profile.id); // so chats show the new name and photo
      await refresh();
      if (router.canGoBack()) router.back();
      else router.replace('/profile');
    }
    return error;
  }

  return (
    <ThemedView style={styles.screen}>
      <Stack.Screen options={{ title: t('editProfile.title') }} />
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled">
          <View style={styles.content}>
            {profile && (
              <ProfileForm initial={profile} submitLabel={t('editProfile.save')} onSubmit={save} />
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  },
});
