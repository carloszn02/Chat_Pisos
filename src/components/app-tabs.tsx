import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useTranslation } from 'react-i18next';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';
import { useUnreadCount } from '@/hooks/use-unread';

// Icons: Apple's SF Symbols on iPhone (filled when selected), Google's Material icons on Android.
export default function AppTabs() {
  const { t } = useTranslation();
  const unread = useUnreadCount();
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.backgroundSelected}
      iconColor={{ default: colors.textSecondary, selected: colors.primary }}
      labelStyle={{ default: { color: colors.textSecondary }, selected: { color: colors.primary } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>{t('tabs.chats')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'bubble.left.and.bubble.right', selected: 'bubble.left.and.bubble.right.fill' }}
          md="forum"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="messages">
        <NativeTabs.Trigger.Label>{t('tabs.messages')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'envelope', selected: 'envelope.fill' }} md="mail" />
        <NativeTabs.Trigger.Badge hidden={unread === 0}>
          {unread > 99 ? '99+' : String(unread)}
        </NativeTabs.Trigger.Badge>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Label>{t('tabs.profile')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'person.crop.circle', selected: 'person.crop.circle.fill' }}
          md="account_circle"
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
