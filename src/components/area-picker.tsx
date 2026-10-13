import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ChoiceChips } from '@/components/choice-chips';
import { Spacing } from '@/constants/theme';
import { usePlaces } from '@/hooks/use-places';

type AreaPickerProps = {
  label: string;
  /** Chosen district and neighbourhood ids. */
  value: string[];
  onChange: (areaIds: string[]) => void;
  /** 1 for a room or flat (one place); more for people looking in several districts. */
  maxDistricts: number;
};

/**
 * Pick a district, then (optionally) a neighbourhood inside it.
 * With maxDistricts > 1, several districts and several neighbourhoods can be chosen.
 */
export function AreaPicker({ label, value, onChange, maxDistricts }: AreaPickerProps) {
  const { t } = useTranslation();
  const { districts, neighbourhoodsOf, areaById } = usePlaces();
  const single = maxDistricts === 1;

  const chosenDistricts = value.filter((id) => areaById(id)?.kind === 'district');
  const chosenHoods = value.filter((id) => areaById(id)?.kind === 'neighbourhood');

  function toggleDistrict(districtId: string) {
    if (chosenDistricts.includes(districtId)) {
      // Removing a district also removes its neighbourhoods.
      onChange(value.filter((id) => id !== districtId && areaById(id)?.parent_id !== districtId));
    } else if (single) {
      onChange([districtId]);
    } else if (chosenDistricts.length < maxDistricts) {
      onChange([...value, districtId]);
    }
  }

  function toggleHood(districtId: string, hoodId: string) {
    if (chosenHoods.includes(hoodId)) {
      onChange(value.filter((id) => id !== hoodId));
    } else if (single) {
      // One neighbourhood per place: replace any other one in the same district.
      onChange([...value.filter((id) => areaById(id)?.parent_id !== districtId), hoodId]);
    } else {
      onChange([...value, hoodId]);
    }
  }

  return (
    <View style={styles.container}>
      <ChoiceChips
        label={label}
        options={districts.map((d) => d.id)}
        getLabel={(id) => areaById(id)?.name ?? ''}
        value={single ? (chosenDistricts[0] ?? null) : chosenDistricts}
        onChange={toggleDistrict}
      />
      {chosenDistricts.map((districtId) => {
        const hoods = neighbourhoodsOf(districtId);
        const chosenHere = chosenHoods.filter((id) => areaById(id)?.parent_id === districtId);
        return (
          <ChoiceChips
            key={districtId}
            label={t('listings.form.neighbourhoodIn', {
              district: areaById(districtId)?.name ?? '',
            })}
            options={hoods.map((h) => h.id)}
            getLabel={(id) => areaById(id)?.name ?? ''}
            value={single ? (chosenHere[0] ?? null) : chosenHere}
            onChange={(hoodId) => toggleHood(districtId, hoodId)}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.three,
  },
});
