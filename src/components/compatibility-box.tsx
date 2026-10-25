import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { compareHabits, type CompatibilityLevel } from '@/lib/compatibility';
import type { Habits } from '@/types/profile';

const LEVEL_BARS: Record<CompatibilityLevel, number> = { high: 3, medium: 2, low: 1 };

/**
 * How well you and another person would match as flatmates: a level, what you have in common
 * and what's worth talking about. Shows nothing if there's nothing to compare yet.
 */
export function CompatibilityBox({
  me,
  other,
  bordered = true,
}: {
  me: Habits;
  other: Habits;
  /** False when it's already inside a card. */
  bordered?: boolean;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const result = compareHabits(me, other);

  const inCommon = [
    ...result.sameAnswers.map(
      (question) => t(`profileSetup.tags.${question}.${me[question]}` as never) as string
    ),
    ...result.sharedInterests.map((interest) => t(`profileSetup.options.interests.${interest}`)),
  ];
  if (!result.level && inCommon.length === 0) return null;

  const levelColor =
    result.level === 'high'
      ? theme.primary
      : result.level === 'medium'
        ? theme.text
        : theme.textSecondary;

  return (
    <View
      style={[
        styles.box,
        bordered && [
          styles.bordered,
          { borderColor: theme.border, backgroundColor: theme.backgroundElement },
        ],
      ]}>
      {result.level ? (
        <View style={styles.levelRow}>
          <View style={styles.bars} accessibilityElementsHidden importantForAccessibility="no">
            {[1, 2, 3].map((bar) => (
              <View
                key={bar}
                style={[
                  styles.bar,
                  { height: 6 + bar * 4 },
                  {
                    backgroundColor:
                      bar <= LEVEL_BARS[result.level!] ? theme.primary : theme.border,
                  },
                ]}
              />
            ))}
          </View>
          <View style={styles.flex}>
            <ThemedText style={[styles.level, { color: levelColor }]}>
              {t(`compatibility.${result.level}`)}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t('compatibility.basedOn', { count: result.compared })}
            </ThemedText>
          </View>
        </View>
      ) : null}

      {inCommon.length > 0 && (
        <View style={styles.section}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            {t('compatibility.inCommon')}
          </ThemedText>
          <View style={styles.pills}>
            {inCommon.map((item) => (
              <View key={item} style={[styles.pill, { backgroundColor: theme.backgroundSelected }]}>
                <ThemedText type="small">{item}</ThemedText>
              </View>
            ))}
          </View>
        </View>
      )}

      {result.differences.length > 0 && (
        <View style={styles.section}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            {t('compatibility.talkAbout')}
          </ThemedText>
          <ThemedText type="small">
            {result.differences.map((question) => t(`profileSetup.topics.${question}`)).join(' · ')}
          </ThemedText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    gap: Spacing.three,
  },
  bordered: {
    borderWidth: 1,
    borderRadius: 16,
    padding: Spacing.three,
  },
  levelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    height: 20,
  },
  bar: {
    width: 6,
    borderRadius: 3,
  },
  level: {
    fontWeight: 700,
    fontSize: 16,
    lineHeight: 22,
  },
  flex: {
    flex: 1,
  },
  section: {
    gap: Spacing.two,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  pill: {
    minHeight: 30,
    paddingHorizontal: 12,
    borderRadius: 999,
    justifyContent: 'center',
  },
});
