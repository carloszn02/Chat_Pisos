import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { SUPPORTED_LANGUAGES } from '@/i18n';

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="subtitle">{t('settings.title')}</ThemedText>

        <ThemedText type="smallBold" themeColor="textSecondary">
          {t('settings.language')}
        </ThemedText>
        <ThemedView style={styles.options}>
          {SUPPORTED_LANGUAGES.map((lang) => {
            const selected = i18n.language === lang;
            return (
              <Pressable
                key={lang}
                onPress={() => i18n.changeLanguage(lang)}
                style={({ pressed }) => pressed && styles.pressed}>
                <ThemedView
                  type={selected ? 'backgroundSelected' : 'backgroundElement'}
                  style={styles.option}>
                  <ThemedText>{t(`languages.${lang}`)}</ThemedText>
                  {selected && <ThemedText>✓</ThemedText>}
                </ThemedView>
              </Pressable>
            );
          })}
        </ThemedView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    flexDirection: 'row',
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.six,
    gap: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.three,
    maxWidth: MaxContentWidth,
  },
  options: {
    gap: Spacing.two,
  },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
  },
  pressed: {
    opacity: 0.7,
  },
});
