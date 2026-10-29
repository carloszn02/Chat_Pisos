import { useTranslation } from 'react-i18next';

import { ActionSheet } from '@/components/action-sheet';
import { LISTING_SORTS, type ListingSort } from '@/lib/listing-sort';

/** The "Sort by" menu for listings. */
export function SortSheet({
  visible,
  value,
  onChange,
  onClose,
}: {
  visible: boolean;
  value: ListingSort;
  onChange: (sort: ListingSort) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <ActionSheet
      visible={visible}
      title={t('listings.sort.title')}
      options={LISTING_SORTS.map((sort) => ({
        label: t(`listings.sort.options.${sort}`),
        selected: sort === value,
        onPress: () => onChange(sort),
      }))}
      onClose={onClose}
    />
  );
}
