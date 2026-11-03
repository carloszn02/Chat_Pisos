import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
} from 'react-native';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { suggestAddresses, type AddressSuggestion } from '@/lib/geocoding';

/** Suggestions start after this many letters, once typing pauses for a moment. */
const MIN_LETTERS = 3;
const PAUSE_MS = 350;

/**
 * The address box of a listing, with suggestions as you type (like Idealista). Picking one
 * fills the box and places the pin; pressing Enter still runs the normal search.
 */
export function AddressInput({
  value,
  onChangeText,
  onPick,
  onSubmit,
  inputStyle,
  placeholder,
  label,
}: {
  value: string;
  onChangeText: (text: string) => void;
  onPick: (suggestion: AddressSuggestion) => void;
  onSubmit: () => void;
  inputStyle: StyleProp<TextStyle>;
  placeholder: string;
  label: string;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  // Only suggest while the person is typing (not for the saved address of a listing).
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    const query = value.trim();
    if (!typing || query.length < MIN_LETTERS) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      suggestAddresses(query, controller.signal)
        .then(setSuggestions)
        // If suggestions fail, the search button still works: just show none.
        .catch(() => setSuggestions([]));
    }, PAUSE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value, typing]);

  const shown = typing && value.trim().length >= MIN_LETTERS ? suggestions : [];

  return (
    <View style={styles.wrap}>
      <TextInput
        style={inputStyle}
        value={value}
        onChangeText={(text) => {
          setTyping(true);
          onChangeText(text);
        }}
        onSubmitEditing={() => {
          setTyping(false);
          onSubmit();
        }}
        placeholder={placeholder}
        placeholderTextColor={theme.textSecondary}
        returnKeyType="search"
        autoCorrect={false}
        maxLength={200}
        accessibilityLabel={label}
        accessibilityHint={t('listings.form.addressSuggestionsHint')}
      />
      {shown.length > 0 && (
        <View
          accessibilityRole="list"
          style={[
            styles.list,
            { backgroundColor: theme.backgroundElement, borderColor: theme.border },
          ]}>
          {shown.map((suggestion, index) => (
            <Pressable
              key={`${suggestion.label}-${suggestion.area}`}
              accessibilityRole="button"
              accessibilityLabel={[suggestion.label, suggestion.area].filter(Boolean).join(', ')}
              onPress={() => {
                setTyping(false);
                setSuggestions([]);
                onPick(suggestion);
              }}
              style={({ pressed }) => [
                styles.row,
                index > 0 && { borderTopWidth: 1, borderTopColor: theme.divider },
                pressed && { backgroundColor: theme.backgroundSelected },
              ]}>
              <Icon name="map-pin" size={16} color={theme.textSecondary} strokeWidth={2} />
              <View style={styles.text}>
                <ThemedText numberOfLines={1}>{suggestion.label}</ThemedText>
                {suggestion.area ? (
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                    {suggestion.area}
                  </ThemedText>
                ) : null}
              </View>
            </Pressable>
          ))}
          {/* Photon's data comes from OpenStreetMap, whose licence asks for this credit. */}
          <ThemedText type="small" themeColor="textSecondary" style={styles.credit}>
            © OpenStreetMap
          </ThemedText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    minWidth: 0,
    gap: Spacing.one,
  },
  list: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 48,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  text: {
    flex: 1,
    minWidth: 0,
  },
  credit: {
    fontSize: 11,
    textAlign: 'right',
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.one,
  },
});
