import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { PrivateGroupBadge } from '@/components/private-group-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { fetchAuthors } from '@/lib/chat';
import { isRateLimitError } from '@/lib/errors';
import { fetchLinkPreview, leavePrivateGroup, requestToJoin } from '@/lib/private-groups';
import type { PrivateGroupLinkPreview, PublicProfile } from '@/types/chat';

/**
 * Opened from a private group's invite link: shows the group's name and who is in it
 * (never the messages) and lets you ask to join. A member of the group then accepts.
 */
export default function JoinGroupScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { t } = useTranslation();
  const theme = useTheme();

  const [preview, setPreview] = useState<PrivateGroupLinkPreview | null | undefined>(undefined);
  const [people, setPeople] = useState<Map<string, PublicProfile>>(new Map());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<'generic' | 'full' | 'rateLimit' | null>(null);

  const load = useCallback(
    async (isCurrent: () => boolean = () => true) => {
      if (!token) return;
      try {
        const found = await fetchLinkPreview(token);
        const members = found ? await fetchAuthors(found.member_ids) : new Map();
        if (!isCurrent()) return;
        setPreview(found);
        setPeople(members);
      } catch {
        if (isCurrent()) setPreview(null);
      }
    },
    [token]
  );

  useEffect(() => {
    let current = true;
    void (async () => {
      await load(() => current);
    })();
    return () => {
      current = false;
    };
  }, [load]);

  async function ask() {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      await requestToJoin(token);
      await load();
    } catch (requestError) {
      const message = (requestError as { message?: string })?.message ?? '';
      if (message.includes('group_full')) setError('full');
      else if (isRateLimitError(requestError) || message.includes('rate_limited'))
        setError('rateLimit');
      else setError('generic');
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!preview) return;
    setBusy(true);
    setError(null);
    try {
      await leavePrivateGroup(preview.group_id);
      await load();
    } catch {
      setError('generic');
    } finally {
      setBusy(false);
    }
  }

  function openGroup() {
    if (!preview) return;
    router.replace({ pathname: '/private-group/[id]', params: { id: preview.group_id } });
  }

  const title = <Stack.Screen options={{ title: t('joinGroup.title') }} />;

  if (preview === undefined) {
    return (
      <ThemedView style={[styles.screen, styles.centered]}>
        {title}
        <ActivityIndicator color={theme.primary} />
      </ThemedView>
    );
  }

  if (preview === null) {
    return (
      <ThemedView style={[styles.screen, styles.centered]}>
        {title}
        <View style={styles.box}>
          <ThemedText type="subtitle" style={styles.heading}>
            {t('joinGroup.invalidTitle')}
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.centerText}>
            {t('joinGroup.invalidBody')}
          </ThemedText>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace('/messages')}
            style={({ pressed }) => [
              styles.button,
              { borderColor: theme.border, borderWidth: 1 },
              pressed && styles.pressed,
            ]}>
            <ThemedText style={styles.bold}>{t('joinGroup.goToMessages')}</ThemedText>
          </Pressable>
        </View>
      </ThemedView>
    );
  }

  const members = preview.member_ids.map((id) => people.get(id)).filter((p) => !!p);
  const names = members.map((p) => p.first_name).join(', ');

  return (
    <ThemedView style={[styles.screen, styles.centered]}>
      {title}
      <View style={styles.box}>
        <PrivateGroupBadge name={preview.name} size={72} />
        <ThemedText type="subtitle" style={styles.heading}>
          {preview.name}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {t('privateGroups.memberCount', { count: preview.member_ids.length })}
        </ThemedText>

        <View style={styles.faces}>
          {members.slice(0, 6).map((person, index) => (
            <View
              key={person.id}
              style={[
                styles.face,
                { borderColor: theme.background },
                index > 0 && styles.faceOverlap,
              ]}>
              <Avatar uri={person.avatar_url} name={person.first_name} size={40} />
            </View>
          ))}
        </View>
        {names !== '' && (
          <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
            {t('privateGroups.whoIsIn', { names })}
          </ThemedText>
        )}

        {preview.my_status === 'member' ? (
          <>
            <ThemedText themeColor="textSecondary" style={styles.centerText}>
              {t('joinGroup.alreadyMember')}
            </ThemedText>
            <PrimaryButton label={t('joinGroup.openChat')} onPress={openGroup} />
          </>
        ) : preview.my_status === 'invited' ? (
          <>
            <ThemedText themeColor="textSecondary" style={styles.centerText}>
              {t('joinGroup.alreadyInvited')}
            </ThemedText>
            <PrimaryButton label={t('joinGroup.seeInvitation')} onPress={openGroup} />
          </>
        ) : preview.my_status === 'requested' ? (
          <>
            <View style={[styles.sentBox, { backgroundColor: theme.backgroundSelected }]}>
              <ThemedText style={[styles.bold, styles.centerText]}>
                {t('joinGroup.sentTitle')}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
                {t('joinGroup.sentBody')}
              </ThemedText>
            </View>
            <Pressable accessibilityRole="button" disabled={busy} onPress={cancel} hitSlop={10}>
              <ThemedText type="small" themeColor="textSecondary">
                {t('joinGroup.cancelRequest')}
              </ThemedText>
            </Pressable>
          </>
        ) : preview.is_full ? (
          <ThemedText themeColor="textSecondary" style={styles.centerText}>
            {t('joinGroup.full')}
          </ThemedText>
        ) : (
          <>
            <ThemedText themeColor="textSecondary" style={styles.centerText}>
              {t('joinGroup.intro')}
            </ThemedText>
            <PrimaryButton label={t('joinGroup.ask')} onPress={ask} busy={busy} />
          </>
        )}

        {error && (
          <ThemedText
            type="small"
            style={[styles.centerText, { color: theme.danger }]}
            accessibilityLiveRegion="polite">
            {t(`joinGroup.errors.${error}`)}
          </ThemedText>
        )}
      </View>
    </ThemedView>
  );
}

function PrimaryButton({
  label,
  onPress,
  busy = false,
}: {
  label: string;
  onPress: () => void;
  busy?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: theme.primary },
        (pressed || busy) && styles.pressed,
      ]}>
      {busy ? (
        <ActivityIndicator color={theme.onPrimary} />
      ) : (
        <ThemedText style={[styles.bold, { color: theme.onPrimary }]}>{label}</ThemedText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  box: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    gap: Spacing.three,
  },
  heading: {
    fontSize: 26,
    lineHeight: 32,
    textAlign: 'center',
  },
  centerText: {
    textAlign: 'center',
  },
  faces: {
    flexDirection: 'row',
  },
  face: {
    borderWidth: 2,
    borderRadius: 999,
  },
  faceOverlap: {
    marginLeft: -12,
  },
  sentBox: {
    alignSelf: 'stretch',
    borderRadius: 14,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  button: {
    alignSelf: 'stretch',
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bold: {
    fontWeight: 700,
  },
  pressed: {
    opacity: 0.7,
  },
});
