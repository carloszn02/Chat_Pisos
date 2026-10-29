import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { ChoiceChips } from '@/components/choice-chips';
import { ThemedText } from '@/components/themed-text';
import { AppFonts, Spacing } from '@/constants/theme';
import { useOpenGroups } from '@/hooks/use-open-groups';
import { useTheme } from '@/hooks/use-theme';
import { isAdult, parseBirthDate } from '@/lib/age';
import type { ProfileErrorKey, ProfileFormValues } from '@/lib/profiles';
import {
  DAILY_LIFE_QUESTIONS,
  HABIT_QUESTIONS,
  INTERESTS,
  LIVING_TOGETHER_QUESTIONS,
  MAX_INTERESTS,
  OCCUPATIONS,
  SPOKEN_LANGUAGES,
  TIDINESS,
  type HabitQuestion,
  type Habits,
  type Interest,
  type Occupation,
  type Profile,
  type SpokenLanguage,
  type Tidiness,
} from '@/types/profile';

const LANGUAGE_CODES = Object.keys(SPOKEN_LANGUAGES) as SpokenLanguage[];

const STEPS = ['basics', 'daily', 'together'] as const;
type Step = (typeof STEPS)[number];

// Tapping the selected option again clears it, so optional answers can be undone.
function toggle<T>(current: T | null, option: T): T | null {
  return current === option ? null : option;
}

function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
}

function habitsFrom(profile?: Profile): Habits {
  return {
    schedule: profile?.schedule ?? null,
    tidiness: profile?.tidiness ?? null,
    smoking: profile?.smoking ?? null,
    pets: profile?.pets ?? null,
    weekends: profile?.weekends ?? null,
    work_from_home: profile?.work_from_home ?? null,
    cooking: profile?.cooking ?? null,
    diet: profile?.diet ?? null,
    guests: profile?.guests ?? null,
    overnight_guests: profile?.overnight_guests ?? null,
    noise: profile?.noise ?? null,
    social: profile?.social ?? null,
    food_sharing: profile?.food_sharing ?? null,
    interests: profile?.interests ?? [],
  };
}

type ProfileFormProps = {
  /** The current profile when editing; omit when creating a new one. */
  initial?: Profile;
  submitLabel: string;
  onSubmit: (values: ProfileFormValues) => Promise<ProfileErrorKey | null>;
  /** Called when moving to another sign-up step (e.g. to scroll back to the top). */
  onStepChange?: () => void;
};

/**
 * All profile fields, shared by the create-profile and edit-profile screens.
 * Creating goes in three short steps (the last two can be skipped); editing shows everything.
 */
export function ProfileForm({ initial, submitLabel, onSubmit, onStepChange }: ProfileFormProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const isEditing = !!initial;

  const [step, setStep] = useState<Step>('basics');
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
  const [habits, setHabits] = useState<Habits>(() => habitsFrom(initial));
  const [districtIds, setDistrictIds] = useState<string[]>([]);
  // The district chats people can join straight away when signing up.
  const districts = useOpenGroups();
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

  function toggleInterest(interest: Interest) {
    setHabits((current) => {
      if (current.interests.includes(interest)) {
        return { ...current, interests: current.interests.filter((i) => i !== interest) };
      }
      if (current.interests.length >= MAX_INTERESTS) return current;
      return { ...current, interests: [...current.interests, interest] };
    });
  }

  function answer(question: HabitQuestion, option: string) {
    setHabits((current) => ({
      ...current,
      [question]: toggle(current[question] as string | null, option),
    }));
  }

  /** Checks the required basics. Returns the birth date (null when editing). */
  function checkBasics(): { ok: true; birthDate: Date | null } | { ok: false } {
    if (!firstName.trim()) {
      setError('nameRequired');
      return { ok: false };
    }
    let birthDate: Date | null = null;
    if (!isEditing) {
      birthDate = parseBirthDate(day, month, year);
      if (!birthDate) {
        setError('invalidDate');
        return { ok: false };
      }
      if (!isAdult(birthDate)) {
        setError('underage');
        return { ok: false };
      }
    }
    if (languages.length === 0) {
      setError('languagesRequired');
      return { ok: false };
    }
    setError(null);
    return { ok: true, birthDate };
  }

  function goTo(next: Step) {
    if (step === 'basics' && !checkBasics().ok) return;
    setError(null);
    setStep(next);
    onStepChange?.();
  }

  async function submit() {
    const basics = checkBasics();
    if (!basics.ok) {
      setStep('basics');
      return;
    }
    setBusy(true);
    try {
      const result = await onSubmit({
        photo,
        firstName,
        birthDate: basics.birthDate,
        occupation,
        languages,
        about,
        habits,
        districtIds,
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

  /** Only some questions have an explanation under them. */
  function questionHint(key: HabitQuestion): string | undefined {
    const hints = t('profileSetup.questionHints', { returnObjects: true }) as Partial<
      Record<HabitQuestion, string>
    >;
    return hints[key];
  }

  function question(key: HabitQuestion) {
    const value = habits[key] as string | null;
    if (key === 'tidiness') {
      return (
        <TidinessScale
          key={key}
          hint={questionHint(key)}
          value={habits.tidiness}
          onChange={(option) => answer('tidiness', option)}
        />
      );
    }
    return (
      <ChoiceChips
        key={key}
        label={t(`profileSetup.questions.${key}`)}
        hint={questionHint(key)}
        options={HABIT_QUESTIONS[key] as readonly string[]}
        getLabel={(o) => t(`profileSetup.options.${key}.${o}` as never)}
        value={value}
        onChange={(o) => answer(key, o)}
      />
    );
  }

  const basicsFields = (
    <>
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

      {!isEditing && districts.length > 0 && (
        <View style={styles.field}>
          <ChoiceChips
            label={t('profileSetup.districts')}
            options={districts.map((d) => d.id)}
            getLabel={(id) => districts.find((d) => d.id === id)?.name ?? ''}
            value={districtIds}
            onChange={(id) =>
              setDistrictIds((current) =>
                current.includes(id) ? current.filter((d) => d !== id) : [...current, id]
              )
            }
          />
          <ThemedText type="small" themeColor="textSecondary">
            {t('profileSetup.districtsHint')}
          </ThemedText>
        </View>
      )}
    </>
  );

  const aboutField = (
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
  );

  const dailyFields = <>{DAILY_LIFE_QUESTIONS.map(question)}</>;

  const togetherFields = (
    <>
      {LIVING_TOGETHER_QUESTIONS.map(question)}
      <ChoiceChips
        label={`${t('profileSetup.interests')} · ${t('profileSetup.interestsHint', { max: MAX_INTERESTS })}`}
        options={INTERESTS}
        getLabel={(o) => t(`profileSetup.options.interests.${o}`)}
        value={habits.interests}
        onChange={toggleInterest}
      />
    </>
  );

  const errorText = error && (
    <ThemedText type="small" style={{ color: theme.danger }} accessibilityLiveRegion="polite">
      {t(`profileSetup.errors.${error}`)}
    </ThemedText>
  );

  if (isEditing) {
    return (
      <View style={styles.form}>
        {basicsFields}
        {aboutField}
        <SectionTitle title={t('profileSetup.steps.daily')} />
        {dailyFields}
        <SectionTitle title={t('profileSetup.steps.together')} />
        {togetherFields}
        {errorText}
        <Button label={submitLabel} onPress={submit} loading={busy} />
      </View>
    );
  }

  // Creating: one step at a time, with a progress bar.
  const index = STEPS.indexOf(step);
  const isLast = index === STEPS.length - 1;
  return (
    <View style={styles.form}>
      <View style={styles.progress}>
        <View style={styles.progressTop}>
          <ThemedText type="small" themeColor="textSecondary">
            {t('profileSetup.stepOf', { step: index + 1, total: STEPS.length })}
          </ThemedText>
          {index > 0 && (
            <Button
              label={t('profileSetup.skip')}
              variant="text"
              size="small"
              onPress={isLast ? submit : () => goTo(STEPS[index + 1])}
            />
          )}
        </View>
        <View style={styles.progressTrack}>
          {STEPS.map((s, i) => (
            <View
              key={s}
              style={[
                styles.progressPart,
                { backgroundColor: i <= index ? theme.primary : theme.border },
              ]}
            />
          ))}
        </View>
      </View>

      <View style={styles.header}>
        <ThemedText type="subtitle" style={styles.title}>
          {t(`profileSetup.steps.${step}`)}
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.bodyText}>
          {t(`profileSetup.stepIntros.${step}`)}
        </ThemedText>
      </View>

      {step === 'basics' && basicsFields}
      {step === 'daily' && dailyFields}
      {step === 'together' && (
        <>
          {togetherFields}
          {aboutField}
        </>
      )}

      {errorText}

      <View style={styles.navRow}>
        {index > 0 && (
          <Button
            label={t('profileSetup.back')}
            variant="secondary"
            onPress={() => goTo(STEPS[index - 1])}
            style={styles.flex}
          />
        )}
        <Button
          label={isLast ? submitLabel : t('profileSetup.next')}
          onPress={isLast ? submit : () => goTo(STEPS[index + 1])}
          loading={busy}
          style={styles.flex}
        />
      </View>
    </View>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <ThemedText style={styles.sectionTitle}>{title}</ThemedText>;
}

/** Tidiness from 1 (very relaxed) to 5 (spotless), as five dots on a line. */
function TidinessScale({
  value,
  onChange,
  hint,
}: {
  hint?: string;
  value: Tidiness | null;
  onChange: (option: Tidiness) => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const selectedIndex = value ? TIDINESS.indexOf(value) : -1;
  return (
    <View
      style={styles.field}
      accessibilityRole="radiogroup"
      accessibilityLabel={t('profileSetup.questions.tidiness')}>
      <View style={styles.questionLabel}>
        <ThemedText type="smallBold">{t('profileSetup.questions.tidiness')}</ThemedText>
        {hint && (
          <ThemedText type="small" themeColor="textSecondary">
            {hint}
          </ThemedText>
        )}
      </View>
      <View style={styles.scale}>
        <View style={[styles.scaleLine, { backgroundColor: theme.border }]} />
        {TIDINESS.map((option, i) => {
          const selected = i === selectedIndex;
          return (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityLabel={t(`profileSetup.options.tidiness.${option}`)}
              accessibilityState={{ selected }}
              onPress={() => onChange(option)}
              hitSlop={8}
              style={({ pressed }) => [
                styles.scaleDot,
                {
                  borderColor: i <= selectedIndex ? theme.primary : theme.borderStrong,
                  backgroundColor: selected
                    ? theme.primary
                    : i < selectedIndex
                      ? theme.backgroundSelected
                      : theme.backgroundElement,
                },
                pressed && styles.pressed,
              ]}>
              <ThemedText
                type="smallBold"
                style={{ color: selected ? theme.onPrimary : theme.textSecondary }}>
                {i + 1}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.scaleLabels}>
        <ThemedText type="small" themeColor="textSecondary">
          {t('profileSetup.options.tidiness.very_relaxed')}
        </ThemedText>
        {value && (
          <ThemedText type="smallBold" style={{ color: theme.primary }}>
            {t(`profileSetup.options.tidiness.${value}`)}
          </ThemedText>
        )}
        <ThemedText type="small" themeColor="textSecondary">
          {t('profileSetup.options.tidiness.very_tidy')}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  questionLabel: {
    gap: 2,
  },
  form: {
    gap: Spacing.four,
  },
  progressTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // Same height with or without "Skip", so the bar doesn't move between steps.
    minHeight: 36,
  },
  progress: {
    gap: Spacing.two,
  },
  progressTrack: {
    flexDirection: 'row',
    gap: 6,
  },
  progressPart: {
    flex: 1,
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
    fontFamily: AppFonts.regular,
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
  // minWidth 0: on the web, text boxes otherwise refuse to shrink and overflow the row.
  dateShort: {
    flex: 1,
    minWidth: 0,
  },
  dateLong: {
    flex: 1.5,
    minWidth: 0,
  },
  textArea: {
    height: 120,
    paddingTop: 12,
    lineHeight: 22,
  },
  sectionTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: 700,
    marginTop: Spacing.two,
  },
  navRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
  scale: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  scaleLine: {
    position: 'absolute',
    left: 20,
    right: 20,
    height: 2,
  },
  scaleDot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scaleLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  pressed: {
    opacity: 0.7,
  },
});
