import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet } from 'react-native';

import { Icon } from '@/components/icon';
import { useSaved } from '@/hooks/use-saved';
import { useTheme } from '@/hooks/use-theme';

const SAVED_RED = '#D64545';

type SaveButtonProps = {
  listingId: string;
  /** "floating": a white circle (on top of a photo). "plain": just the heart (in a header). */
  variant?: 'floating' | 'plain';
};

/** The heart that saves a listing to your favourites. */
export function SaveButton({ listingId, variant = 'floating' }: SaveButtonProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { isSaved, toggle } = useSaved();
  const saved = isSaved(listingId);
  const color = saved ? SAVED_RED : theme.text;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={saved ? t('listings.unsave') : t('listings.save')}
      accessibilityState={{ selected: saved }}
      onPress={() => {
        void toggle(listingId);
      }}
      hitSlop={8}
      style={({ pressed }) => [
        styles.button,
        variant === 'floating' && [styles.floating, { backgroundColor: theme.backgroundElement }],
        pressed && styles.pressed,
      ]}>
      <Icon name="heart" size={19} color={color} filled={saved} strokeWidth={2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floating: {
    borderRadius: 18,
    boxShadow: '0 1px 4px rgba(0, 0, 0, 0.15)',
  },
  pressed: {
    opacity: 0.6,
  },
});
