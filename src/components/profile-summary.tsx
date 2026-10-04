import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  SPOKEN_LANGUAGES,
  type Occupation,
  type Pets,
  type Schedule,
  type Smoking,
  type SpokenLanguage,
  type Tidiness,
} from '@/types/profile';

export type ProfileSummaryData = {
  first_name: string;
  age: number;
  avatar_url: string | null;
  occupation: Occupation | null;
  languages: SpokenLanguage[];
  about: string | null;
  schedule: Schedule | null;
  tidiness: Tidiness | null;
  smoking: Smoking | null;
  pets: Pets | null;
};

/** Photo, "Name, age", occupation, languages, about text and habits. */
export function ProfileSummary({ profile }: { profile: ProfileSummaryData }) {
  const { t } = useTranslation();
  const theme = useTheme();

  const subtitle = [
    profile.occupation && t(`profileSetup.options.occupation.${profile.occupation}`),
    profile.languages.map((code) => SPOKEN_LANGUAGES[code]).join(', '),
  ]
    .filter(Boolean)
    .join(' · ');

  const habits = [
    profile.schedule && t(`profileSetup.options.schedule.${profile.schedule}`),
    profile.tidiness && t(`profileSetup.options.tidiness.${profile.tidiness}`),
    profile.smoking && t(`profileSetup.options.smoking.${profile.smoking}`),
    profile.pets && t(`profileSetup.options.pets.${profile.pets}`),
  ].filter((habit): habit is string => !!habit);

  return (
    <View style={styles.container}>
      <View style={styles.identity}>
        <Avatar uri={profile.avatar_url} name={profile.first_name} size={80} />
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

      {profile.about ? <ThemedText style={styles.about}>{profile.about}</ThemedText> : null}

      {habits.length > 0 && (
        <View style={styles.pills}>
          {habits.map((habit) => (
            <View
              key={habit}
              style={[styles.pill, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="small">{habit}</ThemedText>
            </View>
          ))}
        </View>
      )}
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
