import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  DAILY_LIFE_QUESTIONS,
  LIVING_TOGETHER_QUESTIONS,
  SPOKEN_LANGUAGES,
  type HabitQuestion,
  type Habits,
  type Occupation,
  type SpokenLanguage,
} from '@/types/profile';

export type ProfileSummaryData = Habits & {
  first_name: string;
  age: number;
  avatar_url: string | null;
  occupation: Occupation | null;
  languages: SpokenLanguage[];
  about: string | null;
};

/**
 * Photo, "Name, age", occupation, languages, about text and habits.
 * `part` shows only the top (photo and name) or only the details (about and habits).
 */
export function ProfileSummary({
  profile,
  part = 'all',
}: {
  profile: ProfileSummaryData;
  part?: 'all' | 'identity' | 'details';
}) {
  const { t } = useTranslation();
  const theme = useTheme();

  const subtitle = [
    profile.occupation && t(`profileSetup.options.occupation.${profile.occupation}`),
    profile.languages.map((code) => SPOKEN_LANGUAGES[code]).join(', '),
  ]
    .filter(Boolean)
    .join(' · ');

  const tags = (questions: HabitQuestion[]) =>
    questions.flatMap((question) => {
      const value = profile[question];
      return value ? [t(`profileSetup.tags.${question}.${value}` as never) as string] : [];
    });
  const groups = [
    { key: 'daily', title: t('profileSetup.sections.daily'), items: tags(DAILY_LIFE_QUESTIONS) },
    {
      key: 'together',
      title: t('profileSetup.sections.together'),
      items: tags(LIVING_TOGETHER_QUESTIONS),
    },
    {
      key: 'interests',
      title: t('profileSetup.sections.interests'),
      items: profile.interests.map((interest) => t(`profileSetup.options.interests.${interest}`)),
    },
  ].filter((group) => group.items.length > 0);

  return (
    <View style={styles.container}>
      {part !== 'details' && (
        <View style={styles.identity}>
          <Avatar uri={profile.avatar_url} name={profile.first_name} size={80} zoomable />
          <View style={styles.identityText}>
            <ThemedText type="subtitle" style={styles.name}>
              {profile.first_name}, {profile.age}
            </ThemedText>
            {subtitle ? (
              <ThemedText type="small" themeColor="textSecondary">
                {subtitle}
              </ThemedText>
            ) : null}
          </View>
        </View>
      )}

      {part !== 'identity' && profile.about ? (
        <ThemedText style={styles.about}>{profile.about}</ThemedText>
      ) : null}

      {part !== 'identity' &&
        groups.map((group) => (
          <View key={group.key} style={styles.group}>
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.groupTitle}>
              {group.title}
            </ThemedText>
            <View style={styles.pills}>
              {group.items.map((item) => (
                <View
                  key={item}
                  style={[
                    styles.pill,
                    { borderColor: theme.border, backgroundColor: theme.backgroundElement },
                  ]}>
                  <ThemedText type="small">{item}</ThemedText>
                </View>
              ))}
            </View>
          </View>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.four,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  identityText: {
    flex: 1,
    gap: Spacing.one,
  },
  name: {
    fontSize: 26,
    lineHeight: 32,
  },
  about: {
    lineHeight: 24,
  },
  group: {
    gap: Spacing.two,
  },
  groupTitle: {
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontSize: 12,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  pill: {
    minHeight: 32,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
  },
});
