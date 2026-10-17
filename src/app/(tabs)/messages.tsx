import { Link } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConversationRow } from '@/components/conversation-row';
import { PrivateGroupRow } from '@/components/private-group-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useInbox } from '@/hooks/use-inbox';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';

export default function MessagesScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { session } = useSession();
  const { data, loadError, reload } = useInbox();
  const myUserId = session?.user.id ?? '';
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }

  const requests = data?.items.filter((item) => item.is_incoming_request) ?? [];
  const invitations = data?.groups.filter((group) => group.my_status === 'invited') ?? [];
  const pendingCount = requests.length + invitations.length;

  // Private conversations and groups in one list, most recent activity first.
  const rows = [
    ...(data?.items ?? [])
      .filter((item) => !item.is_incoming_request)
      .map((item) => ({ kind: 'direct' as const, at: item.last_message_at ?? '', item })),
    ...(data?.groups ?? [])
      .filter((group) => group.my_status === 'member')
      .map((group) => ({ kind: 'group' as const, at: group.last_message_at ?? '', group })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.primary} />
          }>
          <View style={styles.content}>
            <View style={styles.header}>
              <ThemedText type="subtitle">{t('messages.title')}</ThemedText>
              <Link href="/new-private-group" asChild>
                <Pressable
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.newGroup,
                    { borderColor: theme.primary },
                    pressed && styles.pressed,
                  ]}>
                  <ThemedText type="smallBold" style={{ color: theme.primary }}>
                    + {t('privateGroups.newButton')}
                  </ThemedText>
                </Pressable>
              </Link>
            </View>

            {!data && !loadError && (
              <ActivityIndicator color={theme.primary} style={styles.loader} />
            )}

            {loadError && (
              <View style={styles.errorBox}>
                <ThemedText type="small" style={{ color: theme.danger }}>
                  {t('messages.loadError')}
                </ThemedText>
                <Pressable accessibilityRole="button" onPress={reload} hitSlop={12}>
                  <ThemedText type="smallBold" style={{ color: theme.primary }}>
                    {t('chats.retry')}
                  </ThemedText>
                </Pressable>
              </View>
            )}

            {data && (
              <>
                <Link href="/message-requests" asChild>
                  <Pressable
                    accessibilityRole="link"
                    style={({ pressed }) => [
                      styles.requestsBox,
                      { borderColor: theme.border, backgroundColor: theme.backgroundElement },
                      pressed && styles.pressed,
                    ]}>
                    <View style={styles.requestsText}>
                      <ThemedText style={styles.bold}>{t('messages.requests')}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {t('messages.requestsHint')}
                      </ThemedText>
                    </View>
                    {pendingCount > 0 && (
                      <View style={[styles.badge, { backgroundColor: theme.primary }]}>
                        <ThemedText style={[styles.badgeText, { color: theme.onPrimary }]}>
                          {pendingCount}
                        </ThemedText>
                      </View>
                    )}
                  </Pressable>
                </Link>

                {rows.length === 0 ? (
                  <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
                    {t('messages.empty')}
                  </ThemedText>
                ) : (
                  <View>
                    {rows.map((row) =>
                      row.kind === 'direct' ? (
                        <ConversationRow
                          key={row.item.id}
                          item={row.item}
                          otherUser={data.users.get(row.item.other_user_id)}
                          myUserId={myUserId}
                        />
                      ) : (
                        <PrivateGroupRow
                          key={row.group.id}
                          group={row.group}
                          users={data.users}
                          myUserId={myUserId}
                        />
                      )
                    )}
                  </View>
                )}
              </>
            )}
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
    gap: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.one,
  },
  newGroup: {
    height: 36,
    paddingHorizontal: Spacing.three,
    borderRadius: 999,
    borderWidth: 1.5,
    justifyContent: 'center',
  },
  loader: {
    marginTop: Spacing.five,
  },
  errorBox: {
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'center',
  },
  requestsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: 14,
    borderWidth: 1,
  },
  requestsText: {
    flex: 1,
  },
  bold: {
    fontWeight: 700,
  },
  badge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: 700,
  },
  empty: {
    marginTop: Spacing.two,
    lineHeight: 20,
  },
  pressed: {
    opacity: 0.7,
  },
});
