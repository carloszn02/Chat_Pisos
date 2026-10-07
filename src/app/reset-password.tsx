import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AppFonts, Spacing } from '@/constants/theme';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

type ResetError = 'shortPassword' | 'mismatch' | 'samePassword' | 'generic';

/** Shown after opening a "reset your password" email link. */
export default function ResetPasswordScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { finishPasswordRecovery } = useSession();

  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<ResetError | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (password.length < 8) return setError('shortPassword');
    if (password !== confirmation) return setError('mismatch');
    setError(null);
    setBusy(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.code === 'same_password' ? 'samePassword' : 'generic');
        return;
      }
      // The person is now logged in with the new password; continue to the app.
      finishPasswordRecovery();
    } catch {
      setError('generic');
    } finally {
      setBusy(false);
    }
  }

  const inputStyle = [
    styles.input,
    { borderColor: theme.border, backgroundColor: theme.backgroundElement, color: theme.text },
  ];

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.screen}>
        <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <View style={styles.content}>
              <ThemedText type="subtitle">{t('auth.newPasswordTitle')}</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.bodyText}>
                {t('auth.newPasswordIntro')}
              </ThemedText>

              <View style={styles.field}>
                <ThemedText type="smallBold">{t('auth.newPassword')}</ThemedText>
                <TextInput
                  style={inputStyle}
                  value={password}
                  onChangeText={setPassword}
                  placeholder={t('auth.passwordPlaceholder')}
                  placeholderTextColor={theme.textSecondary}
                  secureTextEntry
                  autoComplete="new-password"
                  accessibilityLabel={t('auth.newPassword')}
                />
              </View>

              <View style={styles.field}>
                <ThemedText type="smallBold">{t('auth.repeatPassword')}</ThemedText>
                <TextInput
                  style={inputStyle}
                  value={confirmation}
                  onChangeText={setConfirmation}
                  secureTextEntry
                  autoComplete="new-password"
                  accessibilityLabel={t('auth.repeatPassword')}
                  onSubmitEditing={save}
                />
              </View>

              {error && (
                <ThemedText type="small" style={{ color: theme.danger }} accessibilityLiveRegion="polite">
                  {t(`auth.resetErrors.${error}`)}
                </ThemedText>
              )}

              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={save}
                style={({ pressed }) => [
                  styles.primaryButton,
                  { backgroundColor: theme.primary },
                  (pressed || busy) && styles.pressed,
                ]}>
                {busy ? (
                  <ActivityIndicator color={theme.onPrimary} />
                ) : (
                  <ThemedText style={[styles.primaryButtonText, { color: theme.onPrimary }]}>
                    {t('auth.saveNewPassword')}
                  </ThemedText>
                )}
              </Pressable>

              <Pressable
                accessibilityRole="button"
                onPress={() => supabase.auth.signOut()}
                hitSlop={12}
                style={styles.cancel}>
                <ThemedText type="small" themeColor="textSecondary">
                  {t('common.cancel')}
                </ThemedText>
              </Pressable>
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
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  content: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    padding: Spacing.four,
    gap: Spacing.three,
  },
  bodyText: {
    lineHeight: 24,
  },
  field: {
    gap: 6,
  },
  input: {
    fontFamily: AppFonts.regular,
    height: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  primaryButton: {
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.one,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: 700,
  },
  cancel: {
    alignSelf: 'center',
    paddingVertical: Spacing.two,
  },
  pressed: {
    opacity: 0.7,
  },
});
