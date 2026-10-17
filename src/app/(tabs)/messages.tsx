import AsyncStorage from '@react-native-async-storage/async-storage';
import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
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
import { SegmentedControl } from '@/components/segmented-control';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useInbox } from '@/hooks/use-inbox';
import { useMutes } from '@/hooks/use-mutes';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { unreadTotal } from '@/hooks/use-unread';

type Section = 'groups' | 'private';
const SECTION_KEY = 'chat-pisos.messages-section';

/** Your own conversations, in two sections: private groups and one-to-one chats. */
export default function MessagesScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { session } = useSession();
  const { data, loadError, reload } = useInbox();
  const { isMuted } = useMutes();
  const myUserId = session?.user.id ?? '';
  const [refreshing, setRefreshing] = useState(false);
  const [section, setSection] = useState<Section>('private');

  // Open on the section used last time.
  useEffect(() => {
    AsyncStorage.getItem(SECTION_KEY)
      .then((saved) => {
        if (saved === 'groups' || saved === 'private') setSection(saved);
      })
      .catch(() => {});
  }, []);

  function chooseSection(next: Section) {
    setSection(next);
    AsyncStorage.setItem(SECTION_KEY, next).catch(() => {});
  }

  async function refresh() {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }

  const items = data?.items ?? [];
  const groups = data?.groups ?? [];
  const messageRequests = items.filter((item) => item.is_incoming_request);
  const conversations = items.filter((item) => !item.is_incoming_request);
  const invitations = groups.filter((group) => group.my_status === 'invited');
  const myGroups = groups.filter((group) => group.my_status === 'member');

  // Unread per section (pending requests and invitations count too; muted chats don't).
  const privateUnread = unreadTotal(items, [], isMuted);
  const groupsUnread = unreadTotal([], groups, isMuted);

  const pending = section === 'groups' ? invitations.length : messageRequests.length;

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
              {section === 'groups' && (
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
              )}
            </View>

            <SegmentedControl
              segments={[
                { key: 'groups', label: t('messages.sectionGroups'), badge: groupsUnread },
                { key: 'private', label: t('messages.sectionPrivate'), badge: privateUnread },
              ]}
              selected={section}
              onChange={chooseSection}
            />

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
                {/* Like Instagram: a small link to requests, always there, highlighted when there are some. */}
                <View style={styles.listHeader}>
                  <ThemedText type="smallBold" themeColor="textSecondary">
                    {section === 'groups' ? t('messages.yourGroups') : t('messages.yourChats')}
                  </ThemedText>
                  <Link
                    href={{
                      pathname: '/message-requests',
                      params: { kind: section === 'groups' ? 'groups' : 'messages' },
                    }}
                    asChild>
                    <Pressable accessibilityRole="link" hitSlop={10}>
                      <ThemedText
                        type={pending > 0 ? 'smallBold' : 'small'}
                        style={{ color: pending > 0 ? theme.primary : theme.textSecondary }}>
                        {section === 'groups' ? t('messages.invitations') : t('messages.requests')}
                        {pending > 0 ? ` (${pending})` : ''}
                      </ThemedText>
                    </Pressable>
                  </Link>
                </View>

                {section === 'groups' ? (
                  myGroups.length === 0 ? (
                    <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
                      {t('messages.noGroups')}
                    </ThemedText>
                  ) : (
                    <View>
                      {myGroups.map((group) => (
                        <PrivateGroupRow
                          key={group.id}
                          group={group}
                          users={data.users}
                          myUserId={myUserId}
                          muted={isMuted('private_group', group.id)}
                        />
                      ))}
                    </View>
                  )
                ) : conversations.length === 0 ? (
                  <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
                    {t('messages.empty')}
                  </ThemedText>
                ) : (
                  <View>
                    {conversations.map((item) => (
                      <ConversationRow
                        key={item.id}
                        item={item}
                        otherUser={data.users.get(item.other_user_id)}
                        myUserId={myUserId}
                        muted={isMuted('conversation', item.id)}
                      />
                    ))}
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
  },
  newGroup: {
    height: 36,
    paddingHorizontal: Spacing.three,
    borderRadius: 999,
    borderWidth: 1.5,
    justifyContent: 'center',
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.one,
  },
  loader: {
    marginTop: Spacing.five,
  },
  errorBox: {
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'center',
  },
  empty: {
    marginTop: Spacing.two,
    lineHeight: 20,
  },
  pressed: {
    opacity: 0.7,
  },
});
