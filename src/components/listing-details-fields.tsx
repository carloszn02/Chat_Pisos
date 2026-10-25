import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ChoiceChips } from '@/components/choice-chips';
import { Icon } from '@/components/icon';
import { MetroLinePicker } from '@/components/metro-badge';
import { ThemedText } from '@/components/themed-text';
import { AppFonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type es from '@/i18n/locales/es';
import {
  normalizeInstagram,
  normalizeLink,
  normalizeLinkedin,
  normalizePhone,
  phoneForEditing,
} from '@/lib/contact';
import type { ListingValues } from '@/lib/listings';
import {
  FLAT_FEATURES,
  IDEAL_OCCUPATIONS,
  MAX_METRO_LINES,
  ROOM_FEATURES,
  type IdealOccupation,
  type Listing,
  type ListingContact,
  type ListingFeature,
  type ListingType,
  type MetroLine,
} from '@/types/listing';

type ErrorKey = keyof typeof es.listings.errors;

export const YES_NO = ['yes', 'no'] as const;
export type YesNo = (typeof YES_NO)[number];

function toYesNo(value: boolean | null | undefined): YesNo | null {
  if (value === true) return 'yes';
  if (value === false) return 'no';
  return null;
}

function fromYesNo(value: YesNo | null): boolean | null {
  return value === null ? null : value === 'yes';
}

const numberText = (value: number | null | undefined) => (value != null ? String(value) : '');

/** The optional details, as typed in the form (numbers stay text until saving). */
export type DetailsDraft = {
  bedrooms: string;
  bathrooms: string;
  flatmates: string;
  floor: string;
  size: string;
  furnished: YesNo | null;
  features: ListingFeature[];
  billsIncluded: YesNo | null;
  billsEstimate: string;
  depositMonths: string;
  registration: YesNo | null;
  pets: YesNo | null;
  smoking: YesNo | null;
  couples: YesNo | null;
  ageMin: string;
  ageMax: string;
  occupation: IdealOccupation | null;
  metroLines: MetroLine[];
  metroStation: string;
  transportNotes: string;
};

export function draftFromListing(listing?: Listing): DetailsDraft {
  return {
    bedrooms: numberText(listing?.bedrooms),
    bathrooms: numberText(listing?.bathrooms),
    flatmates: numberText(listing?.flatmates),
    floor: numberText(listing?.floor),
    size: numberText(listing?.room_size_m2),
    furnished: toYesNo(listing?.furnished),
    features: listing?.features ?? [],
    billsIncluded: toYesNo(listing?.bills_included),
    billsEstimate: numberText(listing?.bills_estimate_eur),
    depositMonths: numberText(listing?.deposit_months),
    registration: toYesNo(listing?.registration_allowed),
    pets: toYesNo(listing?.pets_allowed),
    smoking: toYesNo(listing?.smoking_allowed),
    couples: toYesNo(listing?.couples_allowed),
    ageMin: numberText(listing?.age_min),
    ageMax: numberText(listing?.age_max),
    occupation: listing?.ideal_occupation ?? null,
    metroLines: listing?.metro_lines ?? [],
    metroStation: listing?.metro_station ?? '',
    transportNotes: listing?.transport_notes ?? '',
  };
}

/**
 * An optional whole number within limits. Returns undefined when the text is wrong,
 * null when it's empty.
 */
function parseNumber(text: string, min: number, max: number): number | null | undefined {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (!/^\d+$/.test(trimmed)) return undefined;
  const value = Number(trimmed);
  return value >= min && value <= max ? value : undefined;
}

type DetailValues = Omit<
  ListingValues,
  | 'type'
  | 'city_id'
  | 'area_ids'
  | 'title'
  | 'description'
  | 'price_eur'
  | 'available_from'
  | 'min_stay_months'
  | 'gender'
  | 'latitude'
  | 'longitude'
  | 'location_exact'
  | 'address'
>;

/** The details to save for this type of listing. Details that don't apply are cleared. */
export function detailsToValues(
  type: ListingType,
  draft: DetailsDraft
): { values: DetailValues } | { error: ErrorKey } {
  const room = type === 'offering_room';
  const flat = type === 'whole_flat';
  const place = room || flat;

  const numbers = {
    bedrooms: parseNumber(draft.bedrooms, 1, 20),
    bathrooms: parseNumber(draft.bathrooms, 1, 10),
    flatmates: parseNumber(draft.flatmates, 0, 20),
    floor: parseNumber(draft.floor, 0, 40),
    size: parseNumber(draft.size, 1, 500),
    billsEstimate: parseNumber(draft.billsEstimate, 1, 1000),
    depositMonths: parseNumber(draft.depositMonths, 0, 6),
  };
  if (place && Object.values(numbers).includes(undefined)) return { error: 'invalidNumber' };

  const ageMin = parseNumber(draft.ageMin, 18, 99);
  const ageMax = parseNumber(draft.ageMax, 18, 99);
  if (
    room &&
    (ageMin === undefined || ageMax === undefined || (ageMin && ageMax && ageMin > ageMax))
  ) {
    return { error: 'invalidAgeRange' };
  }

  const allowed = new Set<ListingFeature>(
    room
      ? [...ROOM_FEATURES, ...FLAT_FEATURES]
      : flat
        ? [...FLAT_FEATURES, 'exterior', 'balcony']
        : []
  );
  const bills = place ? fromYesNo(draft.billsIncluded) : null;
  const pick = <T,>(value: T | null | undefined, applies: boolean) =>
    applies ? (value ?? null) : null;

  return {
    values: {
      bedrooms: pick(numbers.bedrooms, place),
      bathrooms: pick(numbers.bathrooms, place),
      flatmates: pick(numbers.flatmates, room),
      floor: pick(numbers.floor, place),
      room_size_m2: pick(numbers.size, place),
      furnished: place ? fromYesNo(draft.furnished) : null,
      features: draft.features.filter((feature) => allowed.has(feature)),
      bills_included: bills,
      bills_estimate_eur: bills === true ? null : pick(numbers.billsEstimate, place),
      deposit_months: pick(numbers.depositMonths, place),
      registration_allowed: place ? fromYesNo(draft.registration) : null,
      pets_allowed: place ? fromYesNo(draft.pets) : null,
      smoking_allowed: place ? fromYesNo(draft.smoking) : null,
      couples_allowed: room ? fromYesNo(draft.couples) : null,
      age_min: pick(ageMin, room),
      age_max: pick(ageMax, room),
      ideal_occupation: room ? draft.occupation : null,
      metro_lines: place ? draft.metroLines : [],
      metro_station: place ? draft.metroStation.trim() || null : null,
      transport_notes: place ? draft.transportNotes.trim() || null : null,
    },
  };
}

/** The contact fields, as typed. */
export type ContactDraft = {
  instagram: string;
  linkedin: string;
  phone: string;
  phoneWhatsapp: boolean;
  otherLink: string;
};

export function contactDraftFrom(contact: ListingContact | null): ContactDraft {
  return {
    instagram: contact?.instagram ?? '',
    linkedin: contact?.linkedin ?? '',
    phone: contact?.phone ? phoneForEditing(contact.phone) : '',
    phoneWhatsapp: contact?.phone_whatsapp ?? false,
    otherLink: contact?.other_link ?? '',
  };
}

/** The contact to save (null when every field is empty), or what's wrong with it. */
export function contactFromDraft(
  draft: ContactDraft
): { contact: ListingContact | null } | { error: ErrorKey } {
  const field = (text: string, normalize: (text: string) => string | null) =>
    text.trim() ? normalize(text) : null;
  const instagram = field(draft.instagram, normalizeInstagram);
  if (draft.instagram.trim() && !instagram) return { error: 'invalidInstagram' };
  const linkedin = field(draft.linkedin, normalizeLinkedin);
  if (draft.linkedin.trim() && !linkedin) return { error: 'invalidLinkedin' };
  const phone = field(draft.phone, normalizePhone);
  if (draft.phone.trim() && !phone) return { error: 'invalidPhone' };
  const otherLink = field(draft.otherLink, normalizeLink);
  if (draft.otherLink.trim() && !otherLink) return { error: 'invalidLink' };
  if (!instagram && !linkedin && !phone && !otherLink) return { contact: null };
  return {
    contact: {
      instagram,
      linkedin,
      phone,
      phone_whatsapp: !!phone && draft.phoneWhatsapp,
      other_link: otherLink,
    },
  };
}

/** Which section a form error belongs to, so it can be opened. */
export function sectionForError(error: ErrorKey): SectionKey | null {
  if (error === 'invalidAgeRange') return 'ideal';
  if (['invalidInstagram', 'invalidLinkedin', 'invalidPhone', 'invalidLink'].includes(error)) {
    return 'contact';
  }
  return null;
}

export type SectionKey = 'flat' | 'room' | 'costs' | 'rules' | 'ideal' | 'transport' | 'contact';

type SectionProps = {
  title: string;
  filled: number;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
};

/** A box that opens when tapped, showing how many things were filled in. */
function Section({ title, filled, open, onToggle, children }: SectionProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <View
      style={[
        styles.section,
        { borderColor: theme.border, backgroundColor: theme.backgroundElement },
      ]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={onToggle}
        style={({ pressed }) => [styles.sectionHeader, pressed && styles.pressed]}>
        <ThemedText style={[styles.bold, styles.flex]}>{title}</ThemedText>
        {filled > 0 && (
          <ThemedText type="small" style={{ color: theme.primary }}>
            {t('listings.form.sectionFilled', { count: filled })}
          </ThemedText>
        )}
        <View style={open && styles.rotated}>
          <Icon name="chevron-down" size={20} color={theme.textSecondary} />
        </View>
      </Pressable>
      {open && <View style={styles.sectionBody}>{children}</View>}
    </View>
  );
}

type DetailsFieldsProps = {
  type: ListingType;
  draft: DetailsDraft;
  onChange: (patch: Partial<DetailsDraft>) => void;
  contact: ContactDraft;
  onContactChange: (patch: Partial<ContactDraft>) => void;
  openSections: Set<SectionKey>;
  onToggleSection: (key: SectionKey) => void;
};

/** "More details" (all optional) and the contact outside the app. */
export function ListingDetailsFields({
  type,
  draft,
  onChange,
  contact,
  onContactChange,
  openSections,
  onToggleSection,
}: DetailsFieldsProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const room = type === 'offering_room';
  const place = type !== 'seeking_room';

  const inputStyle = [
    styles.input,
    { borderColor: theme.border, backgroundColor: theme.background, color: theme.text },
  ];

  function textField(
    label: string,
    value: string,
    onChangeText: (text: string) => void,
    options: { placeholder?: string; number?: boolean; maxLength?: number; half?: boolean } = {}
  ) {
    return (
      <View style={[styles.field, options.half && styles.flex]}>
        <ThemedText type="smallBold">{label}</ThemedText>
        <TextInput
          style={inputStyle}
          value={value}
          onChangeText={onChangeText}
          placeholder={options.placeholder}
          placeholderTextColor={theme.textSecondary}
          keyboardType={options.number ? 'number-pad' : 'default'}
          inputMode={options.number ? 'numeric' : 'text'}
          maxLength={options.maxLength ?? (options.number ? 4 : 100)}
          autoCapitalize={options.number ? undefined : 'none'}
          autoCorrect={false}
          accessibilityLabel={label}
        />
      </View>
    );
  }

  function yesNo(label: string, value: YesNo | null, key: keyof DetailsDraft) {
    return (
      <ChoiceChips
        label={label}
        options={YES_NO}
        getLabel={(o) => t(`listings.${o}`)}
        value={value}
        onChange={(o) => onChange({ [key]: value === o ? null : o })}
      />
    );
  }

  function toggleFeature(feature: ListingFeature) {
    onChange({
      features: draft.features.includes(feature)
        ? draft.features.filter((f) => f !== feature)
        : [...draft.features, feature],
    });
  }

  function toggleLine(line: MetroLine) {
    onChange({
      metroLines: draft.metroLines.includes(line)
        ? draft.metroLines.filter((l) => l !== line)
        : [...draft.metroLines, line],
    });
  }

  const count = (...values: unknown[]) =>
    values.filter((v) => (Array.isArray(v) ? v.length > 0 : v !== null && v !== '')).length;
  const flatFeatures: ListingFeature[] = room
    ? [...FLAT_FEATURES]
    : [...FLAT_FEATURES, 'exterior', 'balcony'];
  const roomFeatures = draft.features.filter((f) =>
    (ROOM_FEATURES as readonly string[]).includes(f)
  );
  const flatFeatureCount = draft.features.filter((f) => flatFeatures.includes(f)).length;

  const section = (key: SectionKey, filled: number, children: ReactNode) => (
    <Section
      key={key}
      title={t(`listings.form.sections.${key}`)}
      filled={filled}
      open={openSections.has(key)}
      onToggle={() => onToggleSection(key)}>
      {children}
    </Section>
  );

  return (
    <View style={styles.wrapper}>
      {place && (
        <View style={styles.intro}>
          <ThemedText style={styles.heading}>{t('listings.form.moreDetails')}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t('listings.form.moreDetailsHint')}
          </ThemedText>
        </View>
      )}

      {place &&
        section(
          'flat',
          count(
            draft.bedrooms,
            draft.bathrooms,
            room ? draft.flatmates : '',
            draft.floor,
            room ? '' : draft.size,
            draft.furnished
          ) + flatFeatureCount,
          <>
            <View style={styles.row}>
              {textField(
                t('listings.form.bedrooms'),
                draft.bedrooms,
                (v) => onChange({ bedrooms: v }),
                { number: true, half: true }
              )}
              {textField(
                t('listings.form.bathrooms'),
                draft.bathrooms,
                (v) => onChange({ bathrooms: v }),
                { number: true, half: true }
              )}
            </View>
            <View style={styles.row}>
              {room
                ? textField(
                    t('listings.form.flatmates'),
                    draft.flatmates,
                    (v) => onChange({ flatmates: v }),
                    { number: true, half: true }
                  )
                : textField(t('listings.form.flatSize'), draft.size, (v) => onChange({ size: v }), {
                    number: true,
                    half: true,
                  })}
              {textField(t('listings.form.floor'), draft.floor, (v) => onChange({ floor: v }), {
                number: true,
                half: true,
                placeholder: t('listings.form.floorPlaceholder'),
              })}
            </View>
            {yesNo(t('listings.form.furnished'), draft.furnished, 'furnished')}
            <ChoiceChips
              label={t('listings.form.flatFeatures')}
              options={flatFeatures}
              getLabel={(o) => t(`listings.features.${o}`)}
              value={draft.features}
              onChange={toggleFeature}
            />
          </>
        )}

      {room &&
        section(
          'room',
          count(draft.size) + roomFeatures.length,
          <>
            <View style={styles.row}>
              {textField(t('listings.form.roomSize'), draft.size, (v) => onChange({ size: v }), {
                number: true,
                half: true,
              })}
              <View style={styles.flex} />
            </View>
            <ChoiceChips
              label={t('listings.form.roomFeatures')}
              options={ROOM_FEATURES}
              getLabel={(o) => t(`listings.features.${o}`)}
              value={draft.features}
              onChange={toggleFeature}
            />
          </>
        )}

      {place &&
        section(
          'costs',
          count(
            draft.billsIncluded,
            draft.billsIncluded === 'yes' ? '' : draft.billsEstimate,
            draft.depositMonths
          ),
          <>
            {yesNo(t('listings.form.billsIncluded'), draft.billsIncluded, 'billsIncluded')}
            <View style={styles.row}>
              {draft.billsIncluded !== 'yes'
                ? textField(
                    t('listings.form.billsEstimate'),
                    draft.billsEstimate,
                    (v) => onChange({ billsEstimate: v }),
                    {
                      number: true,
                      half: true,
                      placeholder: '€',
                    }
                  )
                : null}
              {textField(
                t('listings.form.depositMonths'),
                draft.depositMonths,
                (v) => onChange({ depositMonths: v }),
                {
                  number: true,
                  half: true,
                  maxLength: 1,
                }
              )}
            </View>
          </>
        )}

      {place &&
        section(
          'rules',
          count(draft.registration, draft.pets, draft.smoking, room ? draft.couples : null),
          <>
            {yesNo(t('listings.form.registrationAllowed'), draft.registration, 'registration')}
            {yesNo(t('listings.form.petsAllowed'), draft.pets, 'pets')}
            {yesNo(t('listings.form.smokingAllowed'), draft.smoking, 'smoking')}
            {room && yesNo(t('listings.form.couplesAllowed'), draft.couples, 'couples')}
          </>
        )}

      {room &&
        section(
          'ideal',
          count(draft.ageMin, draft.ageMax, draft.occupation),
          <>
            <View style={styles.row}>
              {textField(t('listings.form.ageMin'), draft.ageMin, (v) => onChange({ ageMin: v }), {
                number: true,
                half: true,
                maxLength: 2,
                placeholder: '18',
              })}
              {textField(t('listings.form.ageMax'), draft.ageMax, (v) => onChange({ ageMax: v }), {
                number: true,
                half: true,
                maxLength: 2,
                placeholder: '99',
              })}
            </View>
            <ChoiceChips
              label={t('listings.form.idealOccupation')}
              options={IDEAL_OCCUPATIONS}
              getLabel={(o) => t(`listings.occupations.${o}`)}
              value={draft.occupation}
              onChange={(o) => onChange({ occupation: draft.occupation === o ? null : o })}
            />
          </>
        )}

      {place &&
        section(
          'transport',
          count(draft.metroLines, draft.metroStation.trim(), draft.transportNotes.trim()),
          <>
            <View style={styles.field}>
              <ThemedText type="smallBold">
                {t('listings.form.metroLines', { max: MAX_METRO_LINES })}
              </ThemedText>
              <MetroLinePicker
                value={draft.metroLines}
                onToggle={toggleLine}
                disabled={() => draft.metroLines.length >= MAX_METRO_LINES}
              />
            </View>
            {textField(
              t('listings.form.metroStation'),
              draft.metroStation,
              (v) => onChange({ metroStation: v }),
              {
                placeholder: t('listings.form.metroStationPlaceholder'),
                maxLength: 60,
              }
            )}
            {textField(
              t('listings.form.transportNotes'),
              draft.transportNotes,
              (v) => onChange({ transportNotes: v }),
              {
                placeholder: t('listings.form.transportNotesPlaceholder'),
                maxLength: 150,
              }
            )}
          </>
        )}

      {section(
        'contact',
        count(
          contact.instagram.trim(),
          contact.linkedin.trim(),
          contact.phone.trim(),
          contact.otherLink.trim()
        ),
        <>
          <ThemedText type="small" themeColor="textSecondary">
            {t('listings.form.contactHint')}
          </ThemedText>
          {textField(
            t('listings.form.instagram'),
            contact.instagram,
            (v) => onContactChange({ instagram: v }),
            {
              placeholder: t('listings.form.instagramPlaceholder'),
              maxLength: 60,
            }
          )}
          {textField(
            t('listings.form.linkedin'),
            contact.linkedin,
            (v) => onContactChange({ linkedin: v }),
            {
              placeholder: t('listings.form.linkedinPlaceholder'),
              maxLength: 200,
            }
          )}
          <View style={styles.field}>
            <ThemedText type="smallBold">{t('listings.form.phone')}</ThemedText>
            <TextInput
              style={inputStyle}
              value={contact.phone}
              onChangeText={(v) => onContactChange({ phone: v })}
              placeholder={t('listings.form.phonePlaceholder')}
              placeholderTextColor={theme.textSecondary}
              keyboardType="phone-pad"
              inputMode="tel"
              autoComplete="tel"
              maxLength={20}
              accessibilityLabel={t('listings.form.phone')}
            />
            {contact.phone.trim() !== '' && (
              <Checkbox
                label={t('listings.form.phoneWhatsapp')}
                checked={contact.phoneWhatsapp}
                onPress={() => onContactChange({ phoneWhatsapp: !contact.phoneWhatsapp })}
              />
            )}
          </View>
          {textField(
            t('listings.form.otherLink'),
            contact.otherLink,
            (v) => onContactChange({ otherLink: v }),
            {
              placeholder: t('listings.form.otherLinkPlaceholder'),
              maxLength: 200,
            }
          )}
        </>
      )}
    </View>
  );
}

function Checkbox({
  label,
  checked,
  onPress,
}: {
  label: string;
  checked: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.checkboxRow, pressed && styles.pressed]}>
      <View
        style={[
          styles.checkbox,
          { borderColor: checked ? theme.primary : theme.borderStrong },
          checked && { backgroundColor: theme.primary },
        ]}>
        {checked && <Icon name="check" size={14} color={theme.onPrimary} strokeWidth={3} />}
      </View>
      <ThemedText type="small">{label}</ThemedText>
    </Pressable>
  );
}

/** Opens the sections that already have something in them (when editing). */
export function initialOpenSections(
  draft: DetailsDraft,
  contact: ContactDraft,
  editing: boolean
): Set<SectionKey> {
  const open = new Set<SectionKey>();
  if (!editing) return open;
  if (draft.bedrooms || draft.bathrooms || draft.flatmates || draft.floor || draft.furnished)
    open.add('flat');
  if (draft.size || draft.features.length) open.add('room').add('flat');
  if (draft.billsIncluded || draft.billsEstimate || draft.depositMonths) open.add('costs');
  if (draft.registration || draft.pets || draft.smoking || draft.couples) open.add('rules');
  if (draft.ageMin || draft.ageMax || draft.occupation) open.add('ideal');
  if (draft.metroLines.length || draft.metroStation || draft.transportNotes) open.add('transport');
  if (contact.instagram || contact.linkedin || contact.phone || contact.otherLink)
    open.add('contact');
  return open;
}

/** Keeps the section state together. */
export function useOpenSections(initial: () => Set<SectionKey>) {
  const [open, setOpen] = useState(initial);
  function toggle(key: SectionKey) {
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }
  function reveal(key: SectionKey) {
    setOpen((current) => new Set(current).add(key));
  }
  return { open, toggle, reveal };
}

const styles = StyleSheet.create({
  wrapper: {
    gap: Spacing.two,
  },
  intro: {
    gap: 2,
    marginBottom: Spacing.one,
  },
  heading: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: 700,
  },
  section: {
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  sectionHeader: {
    minHeight: 52,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  sectionBody: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
    gap: Spacing.three,
  },
  rotated: {
    transform: [{ rotate: '180deg' }],
  },
  field: {
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
  bold: {
    fontWeight: 700,
  },
  input: {
    fontFamily: AppFonts.regular,
    height: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});
