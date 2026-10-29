import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { ConnectionPicker } from '@/components/connection-picker';
import { ScreenScrollView } from '@/components/screen-scroll-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AppFonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { isRateLimitError } from '@/lib/errors';
import { createPrivateGroup, inviteErrorKey, PRIVATE_GROUP_MAX_PEOPLE } from '@/lib/private-groups';

type CreateError =
  'nameRequired' | 'peopleRequired' | 'notConnected' | 'groupFull' | 'rateLimit' | 'generic';

/** Create a private group with people you're already talking to. */
export default function NewPrivateGroupScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const [name, setName] = useState('');
  const [invitees, setInvitees] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<CreateError | null>(null);

  async function create() {
    if (!name.trim()) return setError('nameRequired');
    if (invitees.length === 0) return setError('peopleRequired');
    setError(null);
    setBusy(true);
    try {
      const groupId = await createPrivateGroup(name, invitees);
      router.replace({ pathname: '/private-group/[id]', params: { id: groupId } });
    } catch (createError) {
      setError(isRateLimitError(createError) ? 'rateLimit' : inviteErrorKey(createError));
      setBusy(false);
    }
  }

  return (
    <ThemedView style={styles.screen}>
      <Stack.Screen options={{ title: t('privateGroups.newTitle') }} />
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScreenScrollView keyboardShouldPersistTaps="handled">
          <View style={styles.content}>
            <ThemedText themeColor="textSecondary" style={styles.intro}>
              {t('privateGroups.newIntro', { max: PRIVATE_GROUP_MAX_PEOPLE })}
            </ThemedText>

            <View style={styles.field}>
              <ThemedText type="smallBold">{t('privateGroups.nameLabel')}</ThemedText>
              <TextInput
                style={[
                  styles.input,
                  {
                    borderColor: theme.border,
                    backgroundColor: theme.backgroundElement,
                    color: theme.text,
                  },
                ]}
                value={name}
                onChangeText={setName}
                placeholder={t('privateGroups.namePlaceholder')}
                placeholderTextColor={theme.textSecondary}
                maxLength={50}
                accessibilityLabel={t('privateGroups.nameLabel')}
              />
            </View>

            <View style={styles.field}>
              <ThemedText type="smallBold">
                {t('privateGroups.peopleLabel', { count: invitees.length })}
              </ThemedText>
              <ConnectionPicker
                selected={invitees}
                onChange={setInvitees}
                maxSelected={PRIVATE_GROUP_MAX_PEOPLE - 1}
              />
            </View>

            {error && (
              <ThemedText
                type="small"
                style={{ color: theme.danger }}
                accessibilityLiveRegion="polite">
                {t(`privateGroups.errors.${error}`)}
              </ThemedText>
            )}

            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={create}
              style={({ pressed }) => [
                styles.primaryButton,
                { backgroundColor: theme.primary },
                (pressed || busy) && styles.pressed,
              ]}>
              {busy ? (
                <ActivityIndicator color={theme.onPrimary} />
              ) : (
                <ThemedText style={[styles.primaryButtonText, { color: theme.onPrimary }]}>
                  {t('privateGroups.create')}
                </ThemedText>
              )}
            </Pressable>
          </View>
        </ScreenScrollView>
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
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    padding: Spacing.four,
    gap: Spacing.four,
  },
  intro: {
    lineHeight: 22,
  },
  field: {
    gap: Spacing.two,
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
    height: 48,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: 700,
  },
  pressed: {
    opacity: 0.7,
  },
});
