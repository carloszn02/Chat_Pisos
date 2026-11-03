import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
  TabListProps,
} from 'expo-router/ui';
import { useTranslation } from 'react-i18next';
import type { ComponentRef, Ref } from 'react';
import { Pressable, View, StyleSheet, useWindowDimensions } from 'react-native';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUnreadCount } from '@/hooks/use-unread';

export default function AppTabs() {
  const { t } = useTranslation();
  const unread = useUnreadCount();
  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <CustomTabList>
          <TabTrigger name="home" href="/" asChild>
            <TabButton>{t('tabs.chats')}</TabButton>
          </TabTrigger>
          <TabTrigger name="listings" href="/listings" asChild>
            <TabButton>{t('tabs.listings')}</TabButton>
          </TabTrigger>
          <TabTrigger name="publish" href="/publish" asChild>
            <TabButton highlight>+ {t('tabs.publish')}</TabButton>
          </TabTrigger>
          <TabTrigger name="messages" href="/messages" asChild>
            <TabButton badge={unread}>{t('tabs.messages')}</TabButton>
          </TabTrigger>
          <TabTrigger name="profile" href="/profile" asChild>
            <TabButton>{t('tabs.profile')}</TabButton>
          </TabTrigger>
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

export function TabButton({
  children,
  isFocused,
  badge = 0,
  highlight = false,
  ref,
  ...props
}: TabTriggerSlotProps & { badge?: number; highlight?: boolean }) {
  const theme = useTheme();
  const compact = useWindowDimensions().width < COMPACT_WIDTH;
  return (
    <Pressable
      {...props}
      // expo-router still types this ref for the old View class (React Native 0.88 changed it).
      ref={ref as unknown as Ref<ComponentRef<typeof Pressable>>}
      style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView
        type={isFocused ? 'backgroundSelected' : 'backgroundElement'}
        style={[
          styles.tabButtonView,
          compact && styles.tabButtonCompact,
          highlight && { backgroundColor: theme.primary },
        ]}>
        <ThemedText
          type={highlight ? 'smallBold' : 'small'}
          themeColor={isFocused ? 'text' : 'textSecondary'}
          style={[compact && styles.labelCompact, highlight && { color: theme.onPrimary }]}>
          {children}
        </ThemedText>
        {badge > 0 && (
          <View style={[styles.badge, { backgroundColor: theme.accent }]}>
            <ThemedText style={[styles.badgeText, { color: theme.onAccent }]}>
              {badge > 99 ? '99+' : badge}
            </ThemedText>
          </View>
        )}
      </ThemedView>
    </Pressable>
  );
}

export function CustomTabList(props: TabListProps) {
  const compact = useWindowDimensions().width < COMPACT_WIDTH;
  return (
    <View {...props} style={[styles.tabListContainer, compact && styles.tabListCompact]}>
      <ThemedView
        type="backgroundElement"
        style={[styles.innerContainer, compact && styles.innerCompact]}>
        {/* On a phone-sized window the five tabs need all the room. */}
        {!compact && (
          <ThemedText type="smallBold" style={styles.brandText}>
            Chat Pisos
          </ThemedText>
        )}

        {props.children}
      </ThemedView>
    </View>
  );
}

/** Below this width (phones) the bar drops the name and uses tighter spacing. */
const COMPACT_WIDTH = 640;

const styles = StyleSheet.create({
  tabListCompact: {
    padding: Spacing.two,
  },
  innerCompact: {
    paddingHorizontal: Spacing.one,
    gap: 2,
    justifyContent: 'space-between',
  },
  tabButtonCompact: {
    paddingHorizontal: 6,
    gap: 4,
  },
  labelCompact: {
    fontSize: 13,
  },
  tabListContainer: {
    position: 'absolute',
    width: '100%',
    padding: Spacing.three,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  innerContainer: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.five,
    borderRadius: Spacing.five,
    flexDirection: 'row',
    alignItems: 'center',
    flexGrow: 1,
    gap: Spacing.two,
    maxWidth: MaxContentWidth,
  },
  brandText: {
    marginRight: 'auto',
  },
  pressed: {
    opacity: 0.7,
  },
  tabButtonView: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: 700,
  },
});
