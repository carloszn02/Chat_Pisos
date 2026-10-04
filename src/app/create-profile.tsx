import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChoiceChips } from '@/components/choice-chips';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useProfile } from '@/hooks/use-profile';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import type es from '@/i18n/locales/es';
import { uploadAvatar } from '@/lib/avatars';
import { supabase } from '@/lib/supabase';
import {
  OCCUPATIONS,
  PETS,
  SCHEDULES,
  SMOKING,
  SPOKEN_LANGUAGES,
  TIDINESS,
  type Occupation,
  type Pets,
  type Schedule,
  type Smoking,
  type SpokenLanguage,
  type Tidiness,
} from '@/types/profile';

type ErrorKey = keyof typeof es.profileSetup.errors;

const LANGUAGE_CODES = Object.keys(SPOKEN_LANGUAGES) as SpokenLanguage[];

/** Returns a real calendar date, or null if the numbers don't form one. */
function parseBirthDate(day: string, month: string, year: string): Date | null {
  const d = Number(day);
  const m = Number(month);
  const y = Number(year);
  if (!Number.isInteger(d) || !Number.isInteger(m) || !Number.isInteger(y) || y < 1900) {
    return null;
  }
  const date = new Date(Date.UTC(y, m - 1, d));
  const matches =
    date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
  return matches && date <= new Date() ? date : null;
}

function isAdult(birthDate: Date): boolean {
  const now = new Date();
  const cutoff = new Date(Date.UTC(now.getFullYear() - 18, now.getMonth(), now.getDate()));
  return birthDate <= cutoff;
}

// Tapping the selected option again clears it, so optional answers can be undone.
function toggle<T>(current: T | null, option: T): T | null {
  return current === option ? null : option;
}

export default function CreateProfileScreen() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const { session } = useSession();
  const { refresh } = useProfile();

  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [firstName, setFirstName] = useState('');
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [occupation, setOccupation] = useState<Occupation | null>(null);
  const [languages, setLanguages] = useState<SpokenLanguage[]>(
    i18n.language === 'en' ? ['en'] : ['es']
  );
  const [about, setAbout] = useState('');
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [tidiness, setTidiness] = useState<Tidiness | null>(null);
  const [smoking, setSmoking] = useState<Smoking | null>(null);
  const [pets, setPets] = useState<Pets | null>(null);
  const [error, setError] = useState<ErrorKey | null>(null);
  const [busy, setBusy] = useState(false);

  async function pickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled) {
      setPhoto(result.assets[0]);
    }
  }

  function toggleLanguage(code: SpokenLanguage) {
    setLanguages((current) =>
      current.includes(code) ? current.filter((c) => c !== code) : [...current, code]
    );
  }

  async function submit() {
    const userId = session?.user.id;
    if (!userId) return;

    const name = firstName.trim();
    if (!name) return setError('nameRequired');
    const birthDate = parseBirthDate(day, month, year);
    if (!birthDate) return setError('invalidDate');
    if (!isAdult(birthDate)) return setError('underage');
    if (languages.length === 0) return setError('languagesRequired');

    setError(null);
    setBusy(true);
    try {
      let avatarUrl: string | null = null;
      if (photo) {
        try {
          avatarUrl = await uploadAvatar(userId, photo);
        } catch {
          setError('photoUpload');
          return;
        }
      }

      const { error: insertError } = await supabase.from('profiles').insert({
        id: userId,
        first_name: name,
        birth_date: birthDate.toISOString().slice(0, 10),
        occupation,
        languages,
        about: about.trim() || null,
        avatar_url: avatarUrl,
        schedule,
        tidiness,
        smoking,
        pets,
      });
      // 23505 = a profile already exists (e.g. saved twice); just continue to the app.
      if (insertError && insertError.code !== '23505') {
        setError('generic');
        return;
      }
      await refresh();
    } catch {
      setError('generic');
    } finally {
      setBusy(false);
    }
  }

  const inputStyle = [
    styles.input,
    { borderColor: theme.border, backgroundColor: theme.backgroundElement, color: theme.text },
  ];

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.screen}>
        <KeyboardAvoidingView
          style={styles.screen}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <View style={styles.content}>
              <View style={styles.progress}>
                <View style={styles.progressLabels}>
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('profileSetup.progress')}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('profileSetup.duration')}
                  </ThemedText>
                </View>
                <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
                  <View style={[styles.progressFill, { backgroundColor: theme.primary }]} />
                </View>
              </View>

              <View style={styles.header}>
                <ThemedText type="subtitle" style={styles.title}>
                  {t('profileSetup.title')}
                </ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.bodyText}>
                  {t('profileSetup.intro')}
                </ThemedText>
              </View>

              <View style={styles.photoRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={photo ? t('profileSetup.changePhoto') : t('profileSetup.addPhoto')}
                  onPress={pickPhoto}
                  style={({ pressed }) => [
                    styles.photo,
                    { borderColor: theme.border, backgroundColor: theme.backgroundElement },
                    !photo && styles.photoEmpty,
                    pressed && styles.pressed,
                  ]}>
                  {photo ? (
                    <Image source={{ uri: photo.uri }} style={styles.photoImage} contentFit="cover" />
                  ) : (
                    <ThemedText type="subtitle" themeColor="textSecondary">
                      +
                    </ThemedText>
                  )}
                </Pressable>
                <View style={styles.photoText}>
                  <ThemedText type="smallBold" style={{ color: theme.primary }}>
                    {photo ? t('profileSetup.changePhoto') : t('profileSetup.addPhoto')}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('profileSetup.photoHint')}
                  </ThemedText>
                </View>
              </View>

              <View style={styles.field}>
                <ThemedText type="smallBold">{t('profileSetup.firstName')}</ThemedText>
                <TextInput
                  style={inputStyle}
                  value={firstName}
                  onChangeText={setFirstName}
                  autoComplete="given-name"
                  autoCapitalize="words"
                  maxLength={50}
                  accessibilityLabel={t('profileSetup.firstName')}
                />
              </View>

              <View style={styles.field}>
                <ThemedText type="smallBold">{t('profileSetup.birthDate')}</ThemedText>
                <View style={styles.dateRow}>
                  <TextInput
                    style={[inputStyle, styles.dateShort]}
                    value={day}
                    onChangeText={setDay}
                    placeholder={t('profileSetup.day')}
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="number-pad"
                    inputMode="numeric"
                    maxLength={2}
                    accessibilityLabel={t('profileSetup.day')}
                  />
                  <TextInput
                    style={[inputStyle, styles.dateShort]}
                    value={month}
                    onChangeText={setMonth}
                    placeholder={t('profileSetup.month')}
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="number-pad"
                    inputMode="numeric"
                    maxLength={2}
                    accessibilityLabel={t('profileSetup.month')}
                  />
                  <TextInput
                    style={[inputStyle, styles.dateLong]}
                    value={year}
                    onChangeText={setYear}
                    placeholder={t('profileSetup.year')}
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="number-pad"
                    inputMode="numeric"
                    maxLength={4}
                    accessibilityLabel={t('profileSetup.year')}
                  />
                </View>
              </View>

              <ChoiceChips
                label={t('profileSetup.occupation')}
                options={OCCUPATIONS}
                getLabel={(o) => t(`profileSetup.options.occupation.${o}`)}
                value={occupation}
                onChange={(o) => setOccupation(toggle(occupation, o))}
              />

              <ChoiceChips
                label={t('profileSetup.languages')}
                options={LANGUAGE_CODES}
                getLabel={(code) => SPOKEN_LANGUAGES[code]}
                value={languages}
                onChange={toggleLanguage}
              />

              <View style={styles.field}>
                <ThemedText type="smallBold">
                  {t('profileSetup.about')}{' '}
                  <ThemedText type="small" themeColor="textSecondary">
                    · {t('profileSetup.optional')}
                  </ThemedText>
                </ThemedText>
                <TextInput
                  style={[inputStyle, styles.textArea]}
                  value={about}
                  onChangeText={setAbout}
                  placeholder={t('profileSetup.aboutPlaceholder')}
                  placeholderTextColor={theme.textSecondary}
                  multiline
                  maxLength={1000}
                  textAlignVertical="top"
                  accessibilityLabel={t('profileSetup.about')}
                />
              </View>

              <View style={styles.habits}>
                <ThemedText style={styles.sectionTitle}>
                  {t('profileSetup.habits')}{' '}
                  <ThemedText type="small" themeColor="textSecondary">
                    · {t('profileSetup.optional')}
                  </ThemedText>
                </ThemedText>
                <ChoiceChips
                  label={t('profileSetup.schedule')}
                  options={SCHEDULES}
                  getLabel={(o) => t(`profileSetup.options.schedule.${o}`)}
                  value={schedule}
                  onChange={(o) => setSchedule(toggle(schedule, o))}
                />
                <ChoiceChips
                  label={t('profileSetup.tidiness')}
                  options={TIDINESS}
                  getLabel={(o) => t(`profileSetup.options.tidiness.${o}`)}
                  value={tidiness}
                  onChange={(o) => setTidiness(toggle(tidiness, o))}
                />
                <ChoiceChips
                  label={t('profileSetup.smoking')}
                  options={SMOKING}
                  getLabel={(o) => t(`profileSetup.options.smoking.${o}`)}
                  value={smoking}
                  onChange={(o) => setSmoking(toggle(smoking, o))}
                />
                <ChoiceChips
                  label={t('profileSetup.pets')}
                  options={PETS}
                  getLabel={(o) => t(`profileSetup.options.pets.${o}`)}
                  value={pets}
                  onChange={(o) => setPets(toggle(pets, o))}
                />
              </View>

              {error && (
                <ThemedText type="small" style={{ color: theme.danger }} accessibilityLiveRegion="polite">
                  {t(`profileSetup.errors.${error}`)}
                </ThemedText>
              )}

              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={submit}
                style={({ pressed }) => [
                  styles.primaryButton,
                  { backgroundColor: theme.primary },
                  (pressed || busy) && styles.pressed,
                ]}>
                {busy ? (
                  <ActivityIndicator color={theme.onPrimary} />
                ) : (
                  <ThemedText style={[styles.primaryButtonText, { color: theme.onPrimary }]}>
                    {t('profileSetup.submit')}
                  </ThemedText>
                )}
              </Pressable>

              <View style={styles.signOutRow}>
                <ThemedText type="small" themeColor="textSecondary">
                  {t('profileSetup.wrongAccount')}
                </ThemedText>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => supabase.auth.signOut()}
                  hitSlop={12}>
                  <ThemedText type="smallBold" style={{ color: theme.primary }}>
                    {t('profileSetup.signOut')}
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.four,
    gap: Spacing.four,
  },
  progress: {
    gap: Spacing.two,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressTrack: {
    height: 6,
    borderRadius: 999,
  },
  progressFill: {
    width: '60%',
    height: 6,
    borderRadius: 999,
  },
  header: {
    gap: Spacing.two,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
  },
  bodyText: {
    lineHeight: 24,
  },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  photo: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photoEmpty: {
    borderStyle: 'dashed',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photoText: {
    flex: 1,
    gap: Spacing.one,
  },
  field: {
    gap: 6,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  dateRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  dateShort: {
    flex: 1,
  },
  dateLong: {
    flex: 1.5,
  },
  textArea: {
    height: 120,
    paddingTop: 12,
    lineHeight: 22,
  },
  habits: {
    gap: Spacing.three,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 700,
  },
  primaryButton: {
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: 700,
  },
  signOutRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  pressed: {
    opacity: 0.7,
  },
});
