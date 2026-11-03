import { TopTabs, type MaterialTopTabBarProps } from 'expo-router/js-top-tabs';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { TabSwipeProvider } from '@/hooks/use-tab-swipe';
import { useUnreadCount } from '@/hooks/use-unread';

const ICONS: Record<string, IconName> = {
  index: 'message',
  listings: 'house',
  messages: 'mail',
  profile: 'user',
};

/**
 * The phone's tabs: swipe left and right between the five main screens (like WhatsApp),
 * with our own compact bar at the bottom. The web uses app-tabs.web.
 */
export default function AppTabs() {
  const { t } = useTranslation();
  const [swipeEnabled, setSwipeEnabled] = useState(true);
  return (
    <TabSwipeProvider setSwipeEnabled={setSwipeEnabled}>
      <TopTabs
        tabBarPosition="bottom"
        tabBar={(props) => <CompactTabBar {...props} />}
        // Screens are built the first time they're shown, so the app opens quickly.
        screenOptions={{ swipeEnabled, lazy: true }}>
        <TopTabs.Screen name="index" options={{ title: t('tabs.chats') }} />
        <TopTabs.Screen name="listings" options={{ title: t('tabs.listings') }} />
        <TopTabs.Screen name="publish" options={{ title: t('tabs.publish') }} />
        <TopTabs.Screen name="messages" options={{ title: t('tabs.messages') }} />
        <TopTabs.Screen name="profile" options={{ title: t('tabs.profile') }} />
      </TopTabs>
    </TabSwipeProvider>
  );
}

function CompactTabBar({
  state,
  descriptors,
  navigateToTab,
  emitter,
  insets,
}: MaterialTopTabBarProps) {
  const theme = useTheme();
  const unread = useUnreadCount();
  return (
    <View
      accessibilityRole="tablist"
      style={[
        styles.bar,
        {
          backgroundColor: theme.background,
          borderTopColor: theme.border,
          paddingBottom: insets.bottom,
        },
      ]}>
      {state.routes.map((route, index) => {
        const title = descriptors[route.key]?.options.title ?? route.name;
        const focused = index === state.index;
        const color = focused ? theme.primary : theme.textSecondary;
        const icon = ICONS[route.name];
        const badge = route.name === 'messages' ? unread : 0;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityLabel={title}
            aria-selected={focused}
            onPress={() => {
              const event = emitter.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) navigateToTab(route.key);
            }}
            style={({ pressed }) => [styles.tab, pressed && styles.pressed]}>
            {route.name === 'publish' ? (
              <View style={[styles.publish, { backgroundColor: theme.primary }]}>
                <Icon name="plus" size={20} color={theme.onPrimary} strokeWidth={2.4} />
              </View>
            ) : (
              <View>
                {icon && (
                  <Icon name={icon} size={22} color={color} strokeWidth={focused ? 2.3 : 1.8} />
                )}
                {badge > 0 && (
                  <View
                    style={[
                      styles.badge,
                      { backgroundColor: theme.accent, borderColor: theme.background },
                    ]}>
                    <ThemedText style={[styles.badgeText, { color: theme.onAccent }]}>
                      {badge > 99 ? '99+' : badge}
                    </ThemedText>
                  </View>
                )}
              </View>
            )}
            <ThemedText
              numberOfLines={1}
              maxFontSizeMultiplier={1.2}
              style={[styles.label, { color }, focused && styles.labelFocused]}>
              {title}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  pressed: {
    opacity: 0.6,
  },
  publish: {
    width: 40,
    height: 26,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 11,
    lineHeight: 14,
  },
  labelFocused: {
    fontWeight: 700,
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -10,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: 700,
  },
});
