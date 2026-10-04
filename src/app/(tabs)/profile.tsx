import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProfileSummary } from '@/components/profile-summary';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useProfile } from '@/hooks/use-profile';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { SUPPORTED_LANGUAGES } from '@/i18n';
import { ageFromBirthDate } from '@/lib/age';
import { supabase } from '@/lib/supabase';

export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const { session } = useSession();
  const { profile } = useProfile();

  if (!profile) return null;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.content}>
            <ProfileSummary profile={{ ...profile, age: ageFromBirthDate(profile.birth_date) }} />

            <Link href="/edit-profile" asChild>
              <Pressable
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.outlineButton,
                  { borderColor: theme.border, backgroundColor: theme.backgroundElement },
                  pressed && styles.pressed,
                ]}>
                <ThemedText type="smallBold">{t('profileTab.editProfile')}</ThemedText>
              </Pressable>
            </Link>

            <View style={styles.section}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                {t('settings.language')}
              </ThemedText>
              <View style={[styles.list, { borderColor: theme.border }]}>
                {SUPPORTED_LANGUAGES.map((lang, index) => {
                  const selected = i18n.language === lang;
                  return (
                    <Pressable
                      key={lang}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      onPress={() => i18n.changeLanguage(lang)}
                      style={({ pressed }) => [
                        styles.row,
                        { backgroundColor: theme.backgroundElement },
                        index > 0 && { borderTopWidth: 1, borderTopColor: theme.border },
                        pressed && styles.pressed,
                      ]}>
                      <ThemedText>{t(`languages.${lang}`)}</ThemedText>
                      {selected && <ThemedText style={{ color: theme.primary }}>✓</ThemedText>}
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.section}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                {t('settings.account')}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {t('settings.signedInAs', { email: session?.user.email ?? '' })}
              </ThemedText>
              <View style={[styles.list, { borderColor: theme.border }]}>
                <Link href="/blocked-users" asChild>
                  <Pressable
                    accessibilityRole="link"
                    style={({ pressed }) => [
                      styles.row,
                      { backgroundColor: theme.backgroundElement },
                      pressed && styles.pressed,
                    ]}>
                    <ThemedText>{t('blocked.title')}</ThemedText>
                    <ThemedText themeColor="textSecondary">›</ThemedText>
                  </Pressable>
                </Link>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => supabase.auth.signOut()}
                  style={({ pressed }) => [
                    styles.row,
                    { backgroundColor: theme.backgroundElement, borderTopWidth: 1, borderTopColor: theme.border },
                    pressed && styles.pressed,
                  ]}>
                  <ThemedText style={{ color: theme.danger }}>{t('settings.signOut')}</ThemedText>
                </Pressable>
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scroll: {
    paddingBottom: BottomTabInset + Spacing.four,
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.six,
    gap: Spacing.four,
  },
  outlineButton: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    gap: Spacing.two,
  },
  list: {
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  row: {
    minHeight: 48,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pressed: {
    opacity: 0.7,
  },
});
