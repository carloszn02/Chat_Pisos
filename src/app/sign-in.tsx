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
import { useTheme } from '@/hooks/use-theme';
import { SUPPORTED_LANGUAGES } from '@/i18n';
import type es from '@/i18n/locales/es';
import { supabase } from '@/lib/supabase';

type Mode = 'signUp' | 'signIn' | 'forgot';
type ErrorKey = keyof typeof es.auth.errors;

// Supabase error codes -> our translated messages.
function errorKeyFromCode(code?: string): ErrorKey {
  switch (code) {
    case 'invalid_credentials':
      return 'invalidCredentials';
    case 'email_not_confirmed':
      return 'emailNotConfirmed';
    case 'user_already_exists':
    case 'email_exists':
      return 'userExists';
    case 'weak_password':
      return 'weakPassword';
    case 'email_address_invalid':
      return 'invalidEmail';
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return 'rateLimit';
    default:
      return 'generic';
  }
}

export default function SignInScreen() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();

  const [mode, setMode] = useState<Mode>('signUp');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<ErrorKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [sentKind, setSentKind] = useState<'confirm' | 'reset'>('confirm');

  const isSignUp = mode === 'signUp';
  const isForgot = mode === 'forgot';
  const redirectTo = Platform.OS === 'web' ? window.location.origin : undefined;

  async function submit() {
    const trimmedEmail = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(trimmedEmail)) return setError('invalidEmail');
    if (isForgot) return sendResetLink(trimmedEmail);
    if (password.length < 8) return setError('shortPassword');
    if (isSignUp && !accepted) return setError('mustAcceptTerms');

    setError(null);
    setBusy(true);
    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
          options: { emailRedirectTo: redirectTo },
        });
        if (error) setError(errorKeyFromCode(error.code));
        else if (!data.session) {
          setSentKind('confirm');
          setSentTo(trimmedEmail);
        }
      } else {
        // On success the session changes and the app switches screens by itself.
        const { error } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        });
        if (error) setError(errorKeyFromCode(error.code));
      }
    } catch {
      setError('generic');
    } finally {
      setBusy(false);
    }
  }

  // Sends a "reset your password" email. For privacy, Supabase answers the same way
  // whether or not an account exists for that email.
  async function sendResetLink(trimmedEmail: string) {
    setError(null);
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, { redirectTo });
      if (error) setError(errorKeyFromCode(error.code));
      else {
        setSentKind('reset');
        setSentTo(trimmedEmail);
      }
    } catch {
      setError('generic');
    } finally {
      setBusy(false);
    }
  }

  // For people who lost (or never got) the confirmation email after signing up.
  async function resendConfirmation() {
    const trimmedEmail = email.trim();
    setError(null);
    setBusy(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: trimmedEmail,
        options: { emailRedirectTo: redirectTo },
      });
      if (error) setError(errorKeyFromCode(error.code));
      else {
        setSentKind('confirm');
        setSentTo(trimmedEmail);
      }
    } catch {
      setError('generic');
    } finally {
      setBusy(false);
    }
  }

  function changeMode(next: Mode) {
    setMode(next);
    setError(null);
  }

  function switchMode() {
    changeMode(isSignUp ? 'signIn' : 'signUp');
  }

  const inputStyle = [
    styles.input,
    { borderColor: theme.border, backgroundColor: theme.backgroundElement, color: theme.text },
  ];

  if (sentTo) {
    return (
      <ThemedView style={styles.screen}>
        <SafeAreaView style={styles.safeArea}>
          <View style={[styles.content, styles.centered]}>
            <ThemedText type="subtitle">{t('auth.checkEmailTitle')}</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.bodyText}>
              {sentKind === 'reset'
                ? t('auth.resetEmailBody', { email: sentTo })
                : t('auth.checkEmailBody', { email: sentTo })}
            </ThemedText>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setSentTo(null);
                setMode('signIn');
              }}
              style={({ pressed }) => [
                styles.primaryButton,
                { backgroundColor: theme.primary },
                pressed && styles.pressed,
              ]}>
              <ThemedText style={[styles.primaryButtonText, { color: theme.onPrimary }]}>
                {t('auth.backToSignIn')}
              </ThemedText>
            </Pressable>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <View style={styles.content}>
              <View style={styles.languageRow}>
                <View
                  style={[
                    styles.languageToggle,
                    { borderColor: theme.border, backgroundColor: theme.backgroundElement },
                  ]}>
                  {SUPPORTED_LANGUAGES.map((lang) => {
                    const selected = i18n.language === lang;
                    return (
                      <Pressable
                        key={lang}
                        accessibilityRole="button"
                        accessibilityLabel={t(`languages.${lang}`)}
                        accessibilityState={{ selected }}
                        onPress={() => i18n.changeLanguage(lang)}
                        style={[styles.languageOption, selected && { backgroundColor: theme.primary }]}>
                        <ThemedText
                          type="smallBold"
                          style={{ color: selected ? theme.onPrimary : theme.textSecondary }}>
                          {lang.toUpperCase()}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.header}>
                <ThemedText type="title">Chat Pisos</ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.bodyText}>
                  {t('auth.tagline')}
                </ThemedText>
              </View>

              <ThemedText type="subtitle" style={styles.formTitle}>
                {isSignUp ? t('auth.signUpTitle') : isForgot ? t('auth.forgotTitle') : t('auth.signInTitle')}
              </ThemedText>

              {isForgot && (
                <ThemedText themeColor="textSecondary" style={styles.bodyText}>
                  {t('auth.forgotIntro')}
                </ThemedText>
              )}

              <View style={styles.field}>
                <ThemedText type="smallBold">{t('auth.email')}</ThemedText>
                <TextInput
                  style={inputStyle}
                  value={email}
                  onChangeText={setEmail}
                  placeholder={t('auth.emailPlaceholder')}
                  placeholderTextColor={theme.textSecondary}
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  inputMode="email"
                  accessibilityLabel={t('auth.email')}
                />
              </View>

              {!isForgot && (
              <View style={styles.field}>
                <ThemedText type="smallBold">{t('auth.password')}</ThemedText>
                <TextInput
                  style={inputStyle}
                  value={password}
                  onChangeText={setPassword}
                  placeholder={t('auth.passwordPlaceholder')}
                  placeholderTextColor={theme.textSecondary}
                  secureTextEntry
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                  accessibilityLabel={t('auth.password')}
                  onSubmitEditing={submit}
                />
                {mode === 'signIn' && (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => changeMode('forgot')}
                    hitSlop={8}
                    style={styles.forgotLink}>
                    <ThemedText type="small" style={{ color: theme.primary }}>
                      {t('auth.forgotLink')}
                    </ThemedText>
                  </Pressable>
                )}
              </View>
              )}

              {isSignUp && (
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: accepted }}
                  onPress={() => setAccepted(!accepted)}
                  style={styles.checkboxRow}>
                  <View
                    style={[
                      styles.checkbox,
                      { borderColor: accepted ? theme.primary : theme.border },
                      accepted && { backgroundColor: theme.primary },
                    ]}>
                    {accepted && (
                      <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
                        ✓
                      </ThemedText>
                    )}
                  </View>
                  <ThemedText type="small" style={styles.flex}>
                    {t('auth.acceptTerms')}
                  </ThemedText>
                </Pressable>
              )}

              {error && (
                <ThemedText type="small" style={{ color: theme.danger }} accessibilityLiveRegion="polite">
                  {t(`auth.errors.${error}`)}
                </ThemedText>
              )}

              {error === 'emailNotConfirmed' && (
                <Pressable accessibilityRole="button" disabled={busy} onPress={resendConfirmation} hitSlop={8}>
                  <ThemedText type="smallBold" style={{ color: theme.primary }}>
                    {t('auth.resendConfirmation')}
                  </ThemedText>
                </Pressable>
              )}

              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={submit}
                style={({ pressed }) => [
                  styles.primaryButton,
                  { backgroundColor: theme.primary },
                  (pressed || busy) && styles.pressed,
                ]}>
                {busy ? (
                  <ActivityIndicator color={theme.onPrimary} />
                ) : (
                  <ThemedText style={[styles.primaryButtonText, { color: theme.onPrimary }]}>
                    {isSignUp ? t('auth.signUpButton') : isForgot ? t('auth.sendResetLink') : t('auth.signInButton')}
                  </ThemedText>
                )}
              </Pressable>

              {isForgot ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => changeMode('signIn')}
                  hitSlop={12}
                  style={styles.switchRow}>
                  <ThemedText type="smallBold" style={{ color: theme.primary }}>
                    {t('auth.backToSignIn')}
                  </ThemedText>
                </Pressable>
              ) : (
              <View style={styles.switchRow}>
                <ThemedText type="small" themeColor="textSecondary">
                  {isSignUp ? t('auth.haveAccount') : t('auth.noAccount')}
                </ThemedText>
                <Pressable accessibilityRole="button" onPress={switchMode} hitSlop={12}>
                  <ThemedText type="smallBold" style={{ color: theme.primary }}>
                    {isSignUp ? t('auth.switchToSignIn') : t('auth.switchToSignUp')}
                  </ThemedText>
                </Pressable>
              </View>
              )}
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
  safeArea: {
    flex: 1,
  },
  flex: {
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
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.four,
    gap: Spacing.three,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
  },
  languageRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  languageToggle: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 999,
    padding: 3,
  },
  languageOption: {
    paddingHorizontal: Spacing.three,
    paddingVertical: 6,
    borderRadius: 999,
  },
  header: {
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  bodyText: {
    lineHeight: 24,
  },
  formTitle: {
    fontSize: 24,
    lineHeight: 32,
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
  forgotLink: {
    alignSelf: 'flex-end',
    paddingTop: Spacing.one,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    paddingVertical: Spacing.one,
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
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  pressed: {
    opacity: 0.7,
  },
});
