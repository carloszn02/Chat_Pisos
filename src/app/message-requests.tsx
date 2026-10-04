import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { ConversationRow } from '@/components/conversation-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useInbox } from '@/hooks/use-inbox';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';

export default function MessageRequestsScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { session } = useSession();
  const { data, loadError } = useInbox();
  const requests = data?.items.filter((item) => item.is_incoming_request) ?? [];

  return (
    <ThemedView style={styles.screen}>
      <Stack.Screen options={{ title: t('messages.requests') }} />
      <ScrollView>
        <View style={styles.content}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.intro}>
            {t('messages.requestsIntro')}
          </ThemedText>
          {!data && !loadError && <ActivityIndicator color={theme.primary} />}
          {loadError && (
            <ThemedText type="small" style={{ color: theme.danger }}>
              {t('messages.loadError')}
            </ThemedText>
          )}
          {data && requests.length === 0 && (
            <ThemedText themeColor="textSecondary">{t('messages.noRequests')}</ThemedText>
          )}
          {requests.map((item) => (
            <ConversationRow
              key={item.id}
              item={item}
              otherUser={data?.users.get(item.other_user_id)}
              myUserId={session?.user.id ?? ''}
            />
          ))}
        </View>
      </ScrollView>
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
