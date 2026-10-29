import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { RowsSkeleton } from '@/components/skeleton';
import { ConversationRow } from '@/components/conversation-row';
import { PrivateGroupRow } from '@/components/private-group-row';
import { ScreenScrollView } from '@/components/screen-scroll-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useInbox } from '@/hooks/use-inbox';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';

/** Pending message requests (kind=messages) or group invitations (kind=groups). */
export default function MessageRequestsScreen() {
  const { kind } = useLocalSearchParams<{ kind?: 'messages' | 'groups' }>();
  const showGroups = kind === 'groups';
  const { t } = useTranslation();
  const theme = useTheme();
  const { session } = useSession();
  const { data, loadError } = useInbox();
  const requests = data?.items.filter((item) => item.is_incoming_request) ?? [];
  const invitations = data?.groups.filter((group) => group.my_status === 'invited') ?? [];
  const isEmpty = showGroups ? invitations.length === 0 : requests.length === 0;

  return (
    <ThemedView style={styles.screen}>
      <Stack.Screen
        options={{ title: showGroups ? t('messages.invitations') : t('messages.requests') }}
      />
      <ScreenScrollView>
        <View style={styles.content}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.intro}>
            {showGroups ? t('messages.invitationsIntro') : t('messages.requestsIntro')}
          </ThemedText>
          {!data && !loadError && <RowsSkeleton count={3} />}
          {loadError && (
            <ThemedText type="small" style={{ color: theme.danger }}>
              {t('messages.loadError')}
            </ThemedText>
          )}
          {data && isEmpty && (
            <ThemedText themeColor="textSecondary">
              {showGroups ? t('messages.noInvitations') : t('messages.noRequests')}
            </ThemedText>
          )}
          {showGroups
            ? invitations.map((group) => (
                <PrivateGroupRow
                  key={group.id}
                  group={group}
                  users={data?.users ?? new Map()}
                  myUserId={session?.user.id ?? ''}
                />
              ))
            : requests.map((item) => (
                <ConversationRow
                  key={item.id}
                  item={item}
                  otherUser={data?.users.get(item.other_user_id)}
                  myUserId={session?.user.id ?? ''}
                />
              ))}
        </View>
      </ScreenScrollView>
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
    gap: Spacing.two,
  },
  intro: {
    lineHeight: 20,
    marginBottom: Spacing.two,
  },
});
