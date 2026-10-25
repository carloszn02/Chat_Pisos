import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Icon, type IconName } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { markTutorialSeen } from '@/lib/tutorial';

const SLIDES: { key: string; icon: IconName }[] = [
  { key: 'welcome', icon: 'house' },
  { key: 'chats', icon: 'message' },
  { key: 'listings', icon: 'map' },
  { key: 'publish', icon: 'plus' },
  { key: 'messages', icon: 'users' },
  { key: 'profile', icon: 'sparkles' },
  { key: 'safety', icon: 'shield' },
];

/**
 * A short welcome tour of the app, shown once after signing up (and any time from
 * Settings). It can be skipped at any moment.
 */
export default function TutorialScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { session } = useSession();
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index];
  const isLast = index === SLIDES.length - 1;

  function close() {
    if (session) void markTutorialSeen(session.user.id);
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.screen}>
        <View style={styles.inner}>
          <View style={styles.top}>
            <ThemedText type="small" themeColor="textSecondary">
              {t('tutorial.progress', { step: index + 1, total: SLIDES.length })}
            </ThemedText>
            {!isLast && <Button label={t('tutorial.skip')} variant="text" onPress={close} />}
          </View>

          <View style={styles.middle} accessibilityLiveRegion="polite">
            <View style={[styles.iconCircle, { backgroundColor: theme.tile }]}>
              <Icon name={slide.icon} size={56} color={theme.onTile} strokeWidth={1.6} />
            </View>
            <ThemedText type="subtitle" style={styles.title}>
              {t(`tutorial.slides.${slide.key}.title` as never)}
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.body}>
              {t(`tutorial.slides.${slide.key}.body` as never)}
            </ThemedText>
          </View>

          <View style={styles.bottom}>
            <View style={styles.dots}>
              {SLIDES.map((s, i) => (
                <Pressable
                  key={s.key}
                  accessibilityRole="button"
                  accessibilityLabel={t('tutorial.progress', { step: i + 1, total: SLIDES.length })}
                  onPress={() => setIndex(i)}
                  hitSlop={6}>
                  <View
                    style={[
                      styles.dot,
                      {
                        width: i === index ? 22 : 8,
                        backgroundColor: i === index ? theme.primary : theme.borderStrong,
                      },
                    ]}
                  />
                </Pressable>
              ))}
            </View>
            <View style={styles.buttons}>
              {index > 0 && (
                <Button
                  label={t('tutorial.back')}
                  variant="secondary"
                  onPress={() => setIndex(index - 1)}
                  style={styles.flex}
                />
              )}
              <Button
                label={isLast ? t('tutorial.start') : t('tutorial.next')}
                onPress={isLast ? close : () => setIndex(index + 1)}
                style={styles.flex}
              />
            </View>
          </View>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  inner: {
    flex: 1,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    padding: Spacing.four,
  },
  top: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  middle: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
  },
  iconCircle: {
    width: 128,
    height: 128,
    borderRadius: 64,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.three,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    textAlign: 'center',
  },
  body: {
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 420,
  },
  bottom: {
    gap: Spacing.four,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  buttons: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
});
