import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ChoiceChips } from '@/components/choice-chips';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { isAdult, parseBirthDate } from '@/lib/age';
import type { ProfileErrorKey, ProfileFormValues } from '@/lib/profiles';
import {
  OCCUPATIONS,
  PETS,
  SCHEDULES,
  SMOKING,
  SPOKEN_LANGUAGES,
  TIDINESS,
  type Occupation,
  type Pets,
  type Profile,
  type Schedule,
  type Smoking,
  type SpokenLanguage,
  type Tidiness,
} from '@/types/profile';

const LANGUAGE_CODES = Object.keys(SPOKEN_LANGUAGES) as SpokenLanguage[];

// Tapping the selected option again clears it, so optional answers can be undone.
function toggle<T>(current: T | null, option: T): T | null {
  return current === option ? null : option;
}

function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
}

type ProfileFormProps = {
  /** The current profile when editing; omit when creating a new one. */
  initial?: Profile;
  submitLabel: string;
  onSubmit: (values: ProfileFormValues) => Promise<ProfileErrorKey | null>;
};

/** All profile fields, shared by the create-profile and edit-profile screens. */
export function ProfileForm({ initial, submitLabel, onSubmit }: ProfileFormProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const isEditing = !!initial;

  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [firstName, setFirstName] = useState(initial?.first_name ?? '');
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [occupation, setOccupation] = useState<Occupation | null>(initial?.occupation ?? null);
  const [languages, setLanguages] = useState<SpokenLanguage[]>(
    initial?.languages ?? (i18n.language === 'en' ? ['en'] : ['es'])
  );
  const [about, setAbout] = useState(initial?.about ?? '');
  const [schedule, setSchedule] = useState<Schedule | null>(initial?.schedule ?? null);
  const [tidiness, setTidiness] = useState<Tidiness | null>(initial?.tidiness ?? null);
  const [smoking, setSmoking] = useState<Smoking | null>(initial?.smoking ?? null);
  const [pets, setPets] = useState<Pets | null>(initial?.pets ?? null);
  const [error, setError] = useState<ProfileErrorKey | null>(null);
  const [busy, setBusy] = useState(false);

  const photoUri = photo?.uri ?? initial?.avatar_url ?? null;

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
    if (!firstName.trim()) return setError('nameRequired');

    let birthDate: Date | null = null;
    if (!isEditing) {
      birthDate = parseBirthDate(day, month, year);
      if (!birthDate) return setError('invalidDate');
      if (!isAdult(birthDate)) return setError('underage');
    }
    if (languages.length === 0) return setError('languagesRequired');

    setError(null);
    setBusy(true);
    try {
      const result = await onSubmit({
        photo,
        firstName,
        birthDate,
        occupation,
        languages,
        about,
        schedule,
        tidiness,
        smoking,
        pets,
      });
      setError(result);
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
    <View style={styles.form}>
      <View style={styles.photoRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={photoUri ? t('profileSetup.changePhoto') : t('profileSetup.addPhoto')}
          onPress={pickPhoto}
          style={({ pressed }) => [
            styles.photo,
            { borderColor: theme.border, backgroundColor: theme.backgroundElement },
            !photoUri && styles.photoEmpty,
            pressed && styles.pressed,
          ]}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.photoImage} contentFit="cover" />
          ) : (
            <ThemedText type="subtitle" themeColor="textSecondary">
              +
            </ThemedText>
          )}
        </Pressable>
        <View style={styles.photoText}>
          <ThemedText type="smallBold" style={{ color: theme.primary }}>
            {photoUri ? t('profileSetup.changePhoto') : t('profileSetup.addPhoto')}
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
        {initial ? (
          <View style={styles.lockedField}>
            <ThemedText>{formatDate(initial.birth_date)}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t('profileSetup.birthDateLocked')}
            </ThemedText>
          </View>
        ) : (
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
        )}
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
            {submitLabel}
          </ThemedText>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: Spacing.four,
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
  lockedField: {
    gap: 2,
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
  pressed: {
    opacity: 0.7,
  },
});
