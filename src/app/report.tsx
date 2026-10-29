import { router, Stack, useLocalSearchParams } from 'expo-router';
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

import { Icon } from '@/components/icon';
import { ChoiceChips } from '@/components/choice-chips';
import { ScreenScrollView } from '@/components/screen-scroll-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AppFonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { useBlocks } from '@/hooks/use-blocks';
import { useTheme } from '@/hooks/use-theme';
import { isRateLimitError } from '@/lib/errors';
import { REPORT_REASONS, submitReport, type ReportReason } from '@/lib/moderation';

type ReportParams = {
  userId: string;
  name?: string;
  groupMessageId?: string;
  directMessageId?: string;
  privateGroupMessageId?: string;
  listingId?: string;
  snapshot?: string;
  /** The photo in the reported message, so the team can look at it. */
  imagePath?: string;
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
  const [error, setError] = useState<'reasonRequired' | 'rateLimit' | 'generic' | null>(null);
  const [sent, setSent] = useState(false);

  const isMessageReport = !!(
    params.groupMessageId ||
    params.directMessageId ||
    params.privateGroupMessageId
  );
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
        privateGroupMessageId: params.privateGroupMessageId,
        listingId: params.listingId,
        messageSnapshot: params.snapshot,
        imagePath: params.imagePath,
      });
      if (alsoBlock && !blockedIds.has(params.userId)) await block(params.userId);
      setSent(true);
    } catch (submitError) {
      setError(isRateLimitError(submitError) ? 'rateLimit' : 'generic');
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
      <Stack.Screen
        options={{
          title: params.listingId
            ? t('report.titleListing')
            : isMessageReport
              ? t('report.titleMessage')
              : t('report.titleUser'),
        }}
      />
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScreenScrollView keyboardShouldPersistTaps="handled">
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
                  style={({ pressed }) => [
                    styles.primaryButton,
                    { backgroundColor: theme.primary },
                    pressed && styles.pressed,
                  ]}>
                  <ThemedText style={[styles.primaryButtonText, { color: theme.onPrimary }]}>
                    {t('report.done')}
                  </ThemedText>
                </Pressable>
              </>
            ) : (
              <>
                <ThemedText themeColor="textSecondary" style={styles.bodyText}>
                  {t('report.intro', { name })}
                </ThemedText>

                {params.snapshot ? (
                  <View
                    style={[
                      styles.quote,
                      { borderColor: theme.border, backgroundColor: theme.backgroundElement },
                    ]}>
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
                        <Icon name="check" size={16} color={theme.onPrimary} strokeWidth={3} />
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
                  <ThemedText
                    type="small"
                    style={{ color: theme.danger }}
                    accessibilityLiveRegion="polite">
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
    fontFamily: AppFonts.regular,
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
