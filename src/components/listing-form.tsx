import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ChoiceChips } from '@/components/choice-chips';
import { LocationMap } from '@/components/location-map';
import { ThemedText } from '@/components/themed-text';
import { AppFonts, Spacing } from '@/constants/theme';
import { useDistricts } from '@/hooks/use-districts';
import { useTheme } from '@/hooks/use-theme';
import type es from '@/i18n/locales/es';
import { parseCalendarDate } from '@/lib/age';
import { blurLocation, MADRID_CENTER, searchAddress, type Coordinates } from '@/lib/geocoding';
import type { ListingValues } from '@/lib/listings';
import {
  LISTING_TYPES,
  MAX_LISTING_PHOTOS,
  MAX_SEEKING_DISTRICTS,
  type Listing,
  type ListingType,
} from '@/types/listing';

export type ListingErrorKey = keyof typeof es.listings.errors;

export type ListingFormResult = {
  values: ListingValues;
  keptPhotoUrls: string[];
  newPhotos: ImagePicker.ImagePickerAsset[];
  shareInGroups: boolean;
};

type ListingFormProps = {
  /** The listing being edited; omit when creating a new one. */
  initial?: Listing;
  submitLabel: string;
  onSubmit: (result: ListingFormResult) => Promise<ListingErrorKey | null>;
};

const VISIBILITY = ['approximate', 'exact'] as const;
type Visibility = (typeof VISIBILITY)[number];

const YES_NO = ['yes', 'no'] as const;
type YesNo = (typeof YES_NO)[number];

function toYesNo(value: boolean | null | undefined): YesNo | null {
  if (value === true) return 'yes';
  if (value === false) return 'no';
  return null;
}

function fromYesNo(value: YesNo | null): boolean | null {
  return value === null ? null : value === 'yes';
}

/** Parses an optional whole number. Returns undefined when the text isn't a valid number. */
function parseOptionalInt(text: string): number | null | undefined {
  const trimmed = text.trim();
  if (!trimmed) return null;
  return /^\d+$/.test(trimmed) ? Number(trimmed) : undefined;
}

function dateParts(isoDate?: string): [string, string, string] {
  const date = isoDate ? new Date(`${isoDate}T00:00:00`) : new Date();
  return [String(date.getDate()), String(date.getMonth() + 1), String(date.getFullYear())];
}

/** All listing fields, shared by the new-listing and edit-listing screens. */
export function ListingForm({ initial, submitLabel, onSubmit }: ListingFormProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const districts = useDistricts();
  const isEditing = !!initial;

  const [initialDay, initialMonth, initialYear] = dateParts(initial?.available_from);

  const [type, setType] = useState<ListingType | null>(initial?.type ?? null);
  const [districtIds, setDistrictIds] = useState<string[]>(initial?.district_ids ?? []);
  const [title, setTitle] = useState(initial?.title ?? '');
  const [price, setPrice] = useState(initial ? String(initial.price_eur) : '');
  const [day, setDay] = useState(initialDay);
  const [month, setMonth] = useState(initialMonth);
  const [year, setYear] = useState(initialYear);
  const [minStay, setMinStay] = useState(initial?.min_stay_months ? String(initial.min_stay_months) : '');
  const [roomSize, setRoomSize] = useState(initial?.room_size_m2 ? String(initial.room_size_m2) : '');
  const [flatmates, setFlatmates] = useState(initial?.flatmates != null ? String(initial.flatmates) : '');
  const [bedrooms, setBedrooms] = useState(initial?.bedrooms ? String(initial.bedrooms) : '');
  const [furnished, setFurnished] = useState<YesNo | null>(toYesNo(initial?.furnished));
  const [billsIncluded, setBillsIncluded] = useState<YesNo | null>(toYesNo(initial?.bills_included));
  const [description, setDescription] = useState(initial?.description ?? '');
  const [keptPhotoUrls, setKeptPhotoUrls] = useState<string[]>(initial?.photo_urls ?? []);
  const [newPhotos, setNewPhotos] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [shareInGroups, setShareInGroups] = useState(true);
  const initialLocation =
    initial?.latitude != null && initial.longitude != null
      ? { latitude: initial.latitude, longitude: initial.longitude }
      : null;
  const [addressText, setAddressText] = useState(initial?.address ?? '');
  // mapCenter only changes on a new search, so the map doesn't reload while the pin is dragged.
  const [mapCenter, setMapCenter] = useState<Coordinates | null>(initialLocation);
  const [location, setLocation] = useState<Coordinates | null>(initialLocation);
  const [locationTouched, setLocationTouched] = useState(false);
  const [visibility, setVisibility] = useState<Visibility>(initial?.location_exact ? 'exact' : 'approximate');
  const [searching, setSearching] = useState(false);
  const [searchMessage, setSearchMessage] = useState<'notFound' | 'failed' | null>(null);
  const [error, setError] = useState<ListingErrorKey | null>(null);
  const [busy, setBusy] = useState(false);

  const isSeeking = type === 'seeking_room';
  const maxDistricts = isSeeking ? MAX_SEEKING_DISTRICTS : 1;
  const photoCount = keptPhotoUrls.length + newPhotos.length;

  function changeType(next: ListingType) {
    setType(next);
    // Rooms and flats are in exactly one district.
    if (next !== 'seeking_room') setDistrictIds((current) => current.slice(0, 1));
  }

  function toggleDistrict(id: string) {
    setDistrictIds((current) => {
      if (current.includes(id)) return current.filter((d) => d !== id);
      if (maxDistricts === 1) return [id];
      return current.length >= maxDistricts ? current : [...current, id];
    });
  }

  const movePin = useCallback((coordinates: Coordinates) => {
    setLocation(coordinates);
    setLocationTouched(true);
  }, []);

  function placePin(coordinates: Coordinates) {
    setMapCenter(coordinates);
    movePin(coordinates);
  }

  async function findAddress() {
    if (!addressText.trim()) return;
    setSearching(true);
    setSearchMessage(null);
    try {
      const found = await searchAddress(addressText.trim());
      if (found) placePin(found);
      else setSearchMessage('notFound');
    } catch {
      setSearchMessage('failed');
    } finally {
      setSearching(false);
    }
  }

  function removeLocation() {
    setMapCenter(null);
    setLocation(null);
    setLocationTouched(true);
  }

  async function addPhotos() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_LISTING_PHOTOS - photoCount,
      quality: 0.7,
    });
    if (!result.canceled) {
      setNewPhotos((current) => [...current, ...result.assets].slice(0, MAX_LISTING_PHOTOS - keptPhotoUrls.length));
    }
  }

  async function submit() {
    if (!type) return setError('typeRequired');
    if (districtIds.length === 0) return setError('districtRequired');
    const trimmedTitle = title.trim();
    if (trimmedTitle.length < 3) return setError('titleRequired');
    const priceValue = parseOptionalInt(price);
    if (!priceValue || priceValue > 20000) return setError('invalidPrice');
    const availableFrom = parseCalendarDate(day, month, year);
    if (!availableFrom) return setError('invalidDate');

    const minStayValue = parseOptionalInt(minStay);
    const roomSizeValue = parseOptionalInt(roomSize);
    const flatmatesValue = parseOptionalInt(flatmates);
    const bedroomsValue = parseOptionalInt(bedrooms);
    if ([minStayValue, roomSizeValue, flatmatesValue, bedroomsValue].includes(undefined)) {
      return setError('invalidNumber');
    }

    // Location (rooms and flats only). An approximate location is moved ~200 m before saving,
    // unless it was already saved that way and hasn't changed.
    const exact = visibility === 'exact';
    if (!isSeeking && location && exact && initial && !initial.location_exact && !locationTouched) {
      return setError('confirmPin');
    }
    const savedLocation =
      isSeeking || !location
        ? null
        : !exact && (locationTouched || initial?.location_exact)
          ? blurLocation(location)
          : location;

    const values: ListingValues = {
      type,
      district_ids: districtIds,
      title: trimmedTitle,
      description: description.trim() || null,
      price_eur: priceValue,
      available_from: availableFrom.toISOString().slice(0, 10),
      min_stay_months: minStayValue ?? null,
      // Details that don't apply to this type are cleared.
      room_size_m2: type === 'offering_room' ? (roomSizeValue ?? null) : null,
      flatmates: type === 'offering_room' ? (flatmatesValue ?? null) : null,
      bedrooms: type === 'whole_flat' ? (bedroomsValue ?? null) : null,
      furnished: isSeeking ? null : fromYesNo(furnished),
      bills_included: isSeeking ? null : fromYesNo(billsIncluded),
      latitude: savedLocation?.latitude ?? null,
      longitude: savedLocation?.longitude ?? null,
      location_exact: !!savedLocation && exact,
      address: savedLocation && exact ? addressText.trim() || null : null,
    };

    setError(null);
    setBusy(true);
    try {
      setError(
        await onSubmit({
          values,
          keptPhotoUrls: isSeeking ? [] : keptPhotoUrls,
          newPhotos: isSeeking ? [] : newPhotos,
          shareInGroups: !isEditing && shareInGroups,
        })
      );
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

  function numberField(label: string, value: string, onChange: (text: string) => void, placeholder?: string) {
    return (
      <View style={[styles.field, styles.half]}>
        <ThemedText type="smallBold">{label}</ThemedText>
        <TextInput
          style={inputStyle}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={theme.textSecondary}
          keyboardType="number-pad"
          inputMode="numeric"
          maxLength={5}
          accessibilityLabel={label}
        />
      </View>
    );
  }

  return (
    <View style={styles.form}>
      <View style={styles.group} accessibilityRole="radiogroup">
        <ThemedText style={styles.sectionTitle}>{t('listings.form.typeQuestion')}</ThemedText>
        {LISTING_TYPES.map((option) => {
          const selected = type === option;
          return (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => changeType(option)}
              style={({ pressed }) => [
                styles.typeOption,
                {
                  borderColor: selected ? theme.primary : theme.border,
                  backgroundColor: selected ? theme.backgroundSelected : theme.backgroundElement,
                },
                pressed && styles.pressed,
              ]}>
              <View style={[styles.radio, { borderColor: selected ? theme.primary : theme.border }]}>
                {selected && <View style={[styles.radioDot, { backgroundColor: theme.primary }]} />}
              </View>
              <View style={styles.flex}>
                <ThemedText style={styles.bold}>{t(`listings.form.typeOptions.${option}`)}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {t(`listings.form.typeHints.${option}`)}
                </ThemedText>
              </View>
            </Pressable>
          );
        })}
      </View>

      {type && (
        <>
          <ChoiceChips
            label={isSeeking ? t('listings.form.districtsSeeking') : t('listings.form.district')}
            options={districts.map((d) => d.id)}
            getLabel={(id) => districts.find((d) => d.id === id)?.name ?? ''}
            value={districtIds}
            onChange={toggleDistrict}
          />

          <View style={styles.field}>
            <ThemedText type="smallBold">{t('listings.form.title')}</ThemedText>
            <TextInput
              style={inputStyle}
              value={title}
              onChangeText={setTitle}
              placeholder={t(`listings.form.titlePlaceholders.${type}`)}
              placeholderTextColor={theme.textSecondary}
              maxLength={100}
              accessibilityLabel={t('listings.form.title')}
            />
          </View>

          <View style={styles.row}>
            {numberField(isSeeking ? t('listings.form.budget') : t('listings.form.rent'), price, setPrice, '€')}
            {numberField(t('listings.form.minStay'), minStay, setMinStay, t('profileSetup.optional'))}
          </View>

          <View style={styles.field}>
            <ThemedText type="smallBold">{t('listings.form.availableFrom')}</ThemedText>
            <View style={styles.row}>
              <TextInput
                style={[inputStyle, styles.flex]}
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
                style={[inputStyle, styles.flex]}
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
                style={[inputStyle, styles.yearInput]}
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

          {type === 'offering_room' && (
            <View style={styles.row}>
              {numberField(t('listings.form.roomSize'), roomSize, setRoomSize, t('profileSetup.optional'))}
              {numberField(t('listings.form.flatmates'), flatmates, setFlatmates, t('profileSetup.optional'))}
            </View>
          )}

          {type === 'whole_flat' && (
            <View style={styles.row}>
              {numberField(t('listings.form.bedrooms'), bedrooms, setBedrooms, t('profileSetup.optional'))}
              <View style={styles.half} />
            </View>
          )}

          {!isSeeking && (
            <>
              <ChoiceChips
                label={t('listings.form.furnished')}
                options={YES_NO}
                getLabel={(o) => t(`listings.${o}`)}
                value={furnished}
                onChange={(o) => setFurnished(furnished === o ? null : o)}
              />
              <ChoiceChips
                label={t('listings.form.billsIncluded')}
                options={YES_NO}
                getLabel={(o) => t(`listings.${o}`)}
                value={billsIncluded}
                onChange={(o) => setBillsIncluded(billsIncluded === o ? null : o)}
              />
            </>
          )}

          {!isSeeking && (
            <View style={styles.field}>
              <ThemedText type="smallBold">
                {t('listings.form.location')}{' '}
                <ThemedText type="small" themeColor="textSecondary">
                  · {t('profileSetup.optional')}
                </ThemedText>
              </ThemedText>
              <View style={styles.row}>
                <TextInput
                  style={[inputStyle, styles.flex]}
                  value={addressText}
                  onChangeText={setAddressText}
                  onSubmitEditing={findAddress}
                  placeholder={t('listings.form.addressPlaceholder')}
                  placeholderTextColor={theme.textSecondary}
                  returnKeyType="search"
                  maxLength={200}
                  accessibilityLabel={t('listings.form.location')}
                />
                <Pressable
                  accessibilityRole="button"
                  disabled={searching}
                  onPress={findAddress}
                  style={({ pressed }) => [
                    styles.searchButton,
                    { borderColor: theme.primary },
                    (pressed || searching) && styles.pressed,
                  ]}>
                  {searching ? (
                    <ActivityIndicator color={theme.primary} />
                  ) : (
                    <ThemedText type="smallBold" style={{ color: theme.primary }}>
                      {t('listings.form.searchAddress')}
                    </ThemedText>
                  )}
                </Pressable>
              </View>
              {searchMessage && (
                <ThemedText type="small" style={{ color: theme.danger }}>
                  {searchMessage === 'notFound' ? t('listings.form.searchNotFound') : t('listings.form.searchFailed')}
                </ThemedText>
              )}

              {mapCenter ? (
                <>
                  <LocationMap center={mapCenter} exact editable onMove={movePin} height={240} />
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('listings.form.pinHint')}
                  </ThemedText>
                  <ChoiceChips
                    label={t('listings.form.visibilityLabel')}
                    options={VISIBILITY}
                    getLabel={(o) => t(`listings.form.visibility.${o}`)}
                    value={visibility}
                    onChange={setVisibility}
                  />
                  <ThemedText type="small" themeColor="textSecondary">
                    {t(`listings.form.visibilityHints.${visibility}`)}
                  </ThemedText>
                  <Pressable accessibilityRole="button" onPress={removeLocation} hitSlop={8} style={styles.linkButton}>
                    <ThemedText type="small" style={{ color: theme.danger }}>
                      {t('listings.form.removeLocation')}
                    </ThemedText>
                  </Pressable>
                </>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => placePin(MADRID_CENTER)}
                  hitSlop={8}
                  style={styles.linkButton}>
                  <ThemedText type="smallBold" style={{ color: theme.primary }}>
                    {t('listings.form.placeManually')}
                  </ThemedText>
                </Pressable>
              )}
            </View>
          )}

          <View style={styles.field}>
            <ThemedText type="smallBold">
              {t('listings.form.description')}{' '}
              <ThemedText type="small" themeColor="textSecondary">
                · {t('profileSetup.optional')}
              </ThemedText>
            </ThemedText>
            <TextInput
              style={[inputStyle, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder={t(`listings.form.descriptionPlaceholders.${type}`)}
              placeholderTextColor={theme.textSecondary}
              multiline
              maxLength={2000}
              textAlignVertical="top"
              accessibilityLabel={t('listings.form.description')}
            />
          </View>

          {!isSeeking && (
            <View style={styles.field}>
              <ThemedText type="smallBold">
                {t('listings.form.photos')}{' '}
                <ThemedText type="small" themeColor="textSecondary">
                  · {t('listings.form.photosHint', { max: MAX_LISTING_PHOTOS })}
                </ThemedText>
              </ThemedText>
              <View style={styles.photoGrid}>
                {keptPhotoUrls.map((url) => (
                  <View key={url} style={styles.photoCell}>
                    <Image source={{ uri: url }} style={styles.photo} contentFit="cover" />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t('listings.form.removePhoto')}
                      onPress={() => setKeptPhotoUrls((current) => current.filter((u) => u !== url))}
                      style={styles.removePhoto}>
                      <ThemedText style={styles.removePhotoText}>×</ThemedText>
                    </Pressable>
                  </View>
                ))}
                {newPhotos.map((photo) => (
                  <View key={photo.uri} style={styles.photoCell}>
                    <Image source={{ uri: photo.uri }} style={styles.photo} contentFit="cover" />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t('listings.form.removePhoto')}
                      onPress={() => setNewPhotos((current) => current.filter((p) => p.uri !== photo.uri))}
                      style={styles.removePhoto}>
                      <ThemedText style={styles.removePhotoText}>×</ThemedText>
                    </Pressable>
                  </View>
                ))}
                {photoCount < MAX_LISTING_PHOTOS && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('listings.form.addPhotos')}
                    onPress={addPhotos}
                    style={({ pressed }) => [
                      styles.photoCell,
                      styles.addPhoto,
                      { borderColor: theme.border, backgroundColor: theme.backgroundElement },
                      pressed && styles.pressed,
                    ]}>
                    <ThemedText type="subtitle" themeColor="textSecondary">
                      +
                    </ThemedText>
                  </Pressable>
                )}
              </View>
            </View>
          )}

          {!isEditing && (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: shareInGroups }}
              onPress={() => setShareInGroups(!shareInGroups)}
              style={[styles.checkboxRow, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
              <View
                style={[
                  styles.checkbox,
                  { borderColor: shareInGroups ? theme.primary : theme.border },
                  shareInGroups && { backgroundColor: theme.primary },
                ]}>
                {shareInGroups && (
                  <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
                    ✓
                  </ThemedText>
                )}
              </View>
              <View style={styles.flex}>
                <ThemedText style={styles.bold}>{t('listings.form.share')}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {t('listings.form.shareHint')}
                </ThemedText>
              </View>
            </Pressable>
          )}
        </>
      )}

      {error && (
        <ThemedText type="small" style={{ color: theme.danger }} accessibilityLiveRegion="polite">
          {t(`listings.errors.${error}`)}
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
          <ThemedText style={[styles.primaryButtonText, { color: theme.onPrimary }]}>{submitLabel}</ThemedText>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: Spacing.four,
  },
  group: {
    gap: Spacing.two,
  },
  sectionTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: 700,
    marginBottom: Spacing.one,
  },
  typeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  flex: {
    flex: 1,
  },
  bold: {
    fontWeight: 700,
  },
  field: {
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  half: {
    flex: 1,
  },
  yearInput: {
    flex: 1.5,
  },
  input: {
    fontFamily: AppFonts.regular,
    height: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  textArea: {
    height: 120,
    paddingTop: 12,
    lineHeight: 22,
  },
  searchButton: {
    height: 48,
    paddingHorizontal: Spacing.three,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkButton: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.one,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  photoCell: {
    width: 76,
    height: 76,
    borderRadius: 12,
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  removePhoto: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removePhotoText: {
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 18,
    fontWeight: 700,
  },
  addPhoto: {
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: 14,
    borderWidth: 1,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
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
