import { router, Stack, useLocalSearchParams } from 'expo-router';
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

import { ChoiceChips } from '@/components/choice-chips';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useBlocks } from '@/hooks/use-blocks';
import { useTheme } from '@/hooks/use-theme';
import { REPORT_REASONS, submitReport, type ReportReason } from '@/lib/moderation';

type ReportParams = {
  userId: string;
  name?: string;
  groupMessageId?: string;
  directMessageId?: string;
  snapshot?: string;
};

/** Report a person, or one of their messages, to the Chat Pisos team. */
export default function ReportScreen() {
  const params = useLocalSearchParams<ReportParams>();
  const { t } = useTranslation();
  const theme = useTheme();
  const { blockedIds, block } = useBlocks();

  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [alsoBlock, setAlsoBlock] = useState(!blockedIds.has(params.userId));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<'reasonRequired' | 'generic' | null>(null);
  const [sent, setSent] = useState(false);

  const isMessageReport = !!(params.groupMessageId || params.directMessageId);
  const name = params.name ?? '';

  async function send() {
    if (!reason) return setError('reasonRequired');
    setError(null);
    setBusy(true);
    try {
      await submitReport({
        reportedUserId: params.userId,
        reason,
        details,
        groupMessageId: params.groupMessageId,
        directMessageId: params.directMessageId,
        messageSnapshot: params.snapshot,
      });
      if (alsoBlock && !blockedIds.has(params.userId)) await block(params.userId);
      setSent(true);
    } catch {
      setError('generic');
    } finally {
      setBusy(false);
    }
  }

  function close() {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  const inputStyle = [
    styles.input,
    { borderColor: theme.border, backgroundColor: theme.backgroundElement, color: theme.text },
  ];

  return (
    <ThemedView style={styles.screen}>
      <Stack.Screen options={{ title: isMessageReport ? t('report.titleMessage') : t('report.titleUser') }} />
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled">
          <View style={styles.content}>
            {sent ? (
              <>
                <ThemedText type="subtitle" style={styles.title}>
                  {t('report.thanksTitle')}
                </ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.bodyText}>
                  {t('report.thanksBody')}
                </ThemedText>
                <Pressable
                  accessibilityRole="button"
                  onPress={close}
                  style={({ pressed }) => [styles.primaryButton, { backgroundColor: theme.primary }, pressed && styles.pressed]}>
                  <ThemedText style={[styles.primaryButtonText, { color: theme.onPrimary }]}>{t('report.done')}</ThemedText>
                </Pressable>
              </>
            ) : (
              <>
                <ThemedText themeColor="textSecondary" style={styles.bodyText}>
                  {t('report.intro', { name })}
                </ThemedText>

                {params.snapshot ? (
                  <View style={[styles.quote, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
                    <ThemedText type="small" themeColor="textSecondary" numberOfLines={4}>
                      “{params.snapshot}”
                    </ThemedText>
                  </View>
                ) : null}

                <ChoiceChips
                  label={t('report.reasonLabel')}
                  options={REPORT_REASONS}
                  getLabel={(r) => t(`report.reasons.${r}`)}
                  value={reason}
                  onChange={setReason}
                />

                <View style={styles.field}>
                  <ThemedText type="smallBold">
                    {t('report.detailsLabel')}{' '}
                    <ThemedText type="small" themeColor="textSecondary">
                      · {t('profileSetup.optional')}
                    </ThemedText>
                  </ThemedText>
                  <TextInput
                    style={[inputStyle, styles.textArea]}
                    value={details}
                    onChangeText={setDetails}
                    placeholder={t('report.detailsPlaceholder')}
                    placeholderTextColor={theme.textSecondary}
                    multiline
                    maxLength={1000}
                    textAlignVertical="top"
                    accessibilityLabel={t('report.detailsLabel')}
                  />
                </View>

                {!blockedIds.has(params.userId) && (
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: alsoBlock }}
                    onPress={() => setAlsoBlock(!alsoBlock)}
                    style={styles.checkboxRow}>
                    <View
                      style={[
                        styles.checkbox,
                        { borderColor: alsoBlock ? theme.primary : theme.border },
                        alsoBlock && { backgroundColor: theme.primary },
                      ]}>
                      {alsoBlock && (
                        <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
                          ✓
                        </ThemedText>
                      )}
                    </View>
                    <View style={styles.checkboxText}>
                      <ThemedText style={styles.bold}>{t('report.alsoBlock', { name })}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {t('report.alsoBlockHint')}
                      </ThemedText>
                    </View>
                  </Pressable>
                )}

                {error && (
                  <ThemedText type="small" style={{ color: theme.danger }} accessibilityLiveRegion="polite">
                    {t(`report.errors.${error}`)}
                  </ThemedText>
                )}

                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={send}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    { backgroundColor: theme.danger },
                    (pressed || busy) && styles.pressed,
                  ]}>
                  {busy ? (
                    <ActivityIndicator color={theme.onPrimary} />
                  ) : (
                    <ThemedText style={[styles.primaryButtonText, { color: theme.onPrimary }]}>
                      {t('report.submit')}
                    </ThemedText>
                  )}
                </Pressable>
              </>
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
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    padding: Spacing.four,
    gap: Spacing.four,
  },
  title: {
    fontSize: 26,
    lineHeight: 32,
  },
  bodyText: {
    lineHeight: 24,
  },
  quote: {
    borderWidth: 1,
    borderRadius: 12,
    padding: Spacing.three,
  },
  field: {
    gap: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  textArea: {
    height: 110,
    paddingTop: 12,
    lineHeight: 22,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxText: {
    flex: 1,
    gap: 2,
  },
  bold: {
    fontWeight: 700,
  },
  primaryButton: {
    height: 50,
    borderRadius: 12,
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
