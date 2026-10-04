import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';

export default function HomeScreen() {
  const { t } = useTranslation();

  const sections = [t('home.districtChats'), t('home.listings'), t('home.privateMessages')];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.heroSection}>
          <ThemedText type="title" style={styles.centered}>
            {t('home.title')}
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.centered}>
            {t('home.subtitle')}
          </ThemedText>
        </ThemedView>

        <ThemedView style={styles.sectionList}>
          {sections.map((label) => (
            <ThemedView key={label} type="backgroundElement" style={styles.sectionCard}>
              <ThemedText>{label}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {t('home.comingSoon')}
              </ThemedText>
            </ThemedView>
          ))}
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
    alignItems: 'center',
    gap: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.three,
    maxWidth: MaxContentWidth,
  },
  heroSection: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    gap: Spacing.three,
  },
  centered: {
    textAlign: 'center',
  },
  sectionList: {
    alignSelf: 'stretch',
    gap: Spacing.two,
    paddingBottom: Spacing.four,
  },
  sectionCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
  },
});
