import Constants from 'expo-constants';
import { Link, Stack } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ActionSheet } from '@/components/action-sheet';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useBlocks } from '@/hooks/use-blocks';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { SUPPORTED_LANGUAGES } from '@/i18n';
import { supabase } from '@/lib/supabase';

/** Language, account (blocked people, password, signing out, deleting) and app info. */
export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const { session } = useSession();
  const { blockedIds } = useBlocks();
  const email = session?.user.email ?? '';

  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<'sent' | 'error' | null>(null);
  const [sendingReset, setSendingReset] = useState(false);

  async function sendPasswordLink() {
    if (!email || sendingReset) return;
    setSendingReset(true);
    setPasswordMessage(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: Platform.OS === 'web' ? window.location.origin : undefined,
      });
      setPasswordMessage(error ? 'error' : 'sent');
    } catch {
      setPasswordMessage('error');
    } finally {
      setSendingReset(false);
    }
  }

  return (
    <ThemedView style={styles.screen}>
      <Stack.Screen options={{ title: t('settings.title') }} />
      <ScrollView>
        <View style={styles.content}>
          <Section title={t('settings.language')}>
            {SUPPORTED_LANGUAGES.map((lang, index) => {
              const selected = i18n.language === lang;
              return (
                <Row
                  key={lang}
                  first={index === 0}
                  accessibilityRole="radio"
                  selected={selected}
                  onPress={() => i18n.changeLanguage(lang)}>
                  <ThemedText>{t(`languages.${lang}`)}</ThemedText>
                  {selected && <ThemedText style={{ color: theme.primary }}>✓</ThemedText>}
                </Row>
              );
            })}
          </Section>

          <Section title={t('settings.account')} hint={t('settings.signedInAs', { email })}>
            <Link href="/blocked-users" asChild>
              <Row first accessibilityRole="link">
                <ThemedText>{t('blocked.title')}</ThemedText>
                <ThemedText themeColor="textSecondary">
                  {blockedIds.size > 0 ? `${blockedIds.size}  ›` : '›'}
                </ThemedText>
              </Row>
            </Link>
            <Row accessibilityRole="button" onPress={sendPasswordLink}>
              <ThemedText>{t('settings.changePassword')}</ThemedText>
              <ThemedText themeColor="textSecondary">›</ThemedText>
            </Row>
          </Section>
          {passwordMessage && (
            <ThemedText
              type="small"
              style={{ color: passwordMessage === 'sent' ? theme.primary : theme.danger }}
              accessibilityLiveRegion="polite">
              {passwordMessage === 'sent'
                ? t('settings.passwordLinkSent', { email })
                : t('settings.passwordLinkError')}
            </ThemedText>
          )}

          <Section title={t('settings.about')}>
            <Row first>
              <ThemedText>{t('settings.version')}</ThemedText>
              <ThemedText themeColor="textSecondary">
                {Constants.expoConfig?.version ?? '1.0.0'}
              </ThemedText>
            </Row>
          </Section>

          <Pressable
            accessibilityRole="button"
            onPress={() => setConfirmSignOut(true)}
            style={({ pressed }) => [
              styles.signOut,
              { borderColor: theme.border, backgroundColor: theme.backgroundElement },
              pressed && styles.pressed,
            ]}>
            <ThemedText style={[styles.bold, { color: theme.danger }]}>
              {t('settings.signOut')}
            </ThemedText>
          </Pressable>

          <Link href="/delete-account" asChild>
            <Pressable accessibilityRole="link" hitSlop={8} style={styles.deleteLink}>
              <ThemedText type="small" themeColor="textSecondary">
                {t('deleteAccount.title')}
              </ThemedText>
            </Pressable>
          </Link>
        </View>
      </ScrollView>

      <ActionSheet
        visible={confirmSignOut}
        title={t('settings.signOutConfirm')}
        options={[
          {
            label: t('settings.signOut'),
            destructive: true,
            onPress: () => {
              void supabase.auth.signOut();
            },
          },
        ]}
        onClose={() => setConfirmSignOut(false)}
      />
    </ThemedView>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.section}>
      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
        {title}
      </ThemedText>
      <View style={[styles.list, { borderColor: theme.border }]}>{children}</View>
      {hint && (
        <ThemedText type="small" themeColor="textSecondary">
          {hint}
        </ThemedText>
      )}
    </View>
  );
}

type RowProps = {
  children: ReactNode;
  first?: boolean;
  onPress?: () => void;
  accessibilityRole?: 'button' | 'link' | 'radio';
  selected?: boolean;
};

/** One line in a settings list. Works inside <Link asChild> too (it passes onPress down). */
function Row({ children, first = false, onPress, accessibilityRole, selected, ...rest }: RowProps) {
  const theme = useTheme();
  return (
    <Pressable
      {...rest}
      accessibilityRole={accessibilityRole}
      accessibilityState={selected === undefined ? undefined : { selected }}
      disabled={!onPress && !accessibilityRole}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: theme.backgroundElement },
        !first && { borderTopWidth: 1, borderTopColor: theme.border },
        pressed && styles.pressed,
      ]}>
      {children}
    </Pressable>
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
    gap: Spacing.four,
  },
  section: {
    gap: Spacing.two,
  },
  sectionTitle: {
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontSize: 12,
  },
  list: {
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  row: {
    minHeight: 50,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  signOut: {
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteLink: {
    alignSelf: 'center',
    paddingVertical: Spacing.two,
  },
  bold: {
    fontWeight: 700,
  },
  pressed: {
    opacity: 0.7,
  },
});
