import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { RowsSkeleton } from '@/components/skeleton';
import { Avatar } from '@/components/avatar';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useBlocks } from '@/hooks/use-blocks';
import { useTheme } from '@/hooks/use-theme';
import { fetchAuthors } from '@/lib/chat';
import { fetchConnections } from '@/lib/private-groups';
import type { PublicProfile } from '@/types/chat';

type ConnectionPickerProps = {
  selected: string[];
  onChange: (userIds: string[]) => void;
  /** People who can't be picked (e.g. already in the group). */
  excludeIds?: string[];
  /** How many more people can be picked. */
  maxSelected: number;
};

/**
 * Pick people to invite to a group. Only people you have an accepted private
 * conversation with are listed (and nobody you've blocked).
 */
export function ConnectionPicker({
  selected,
  onChange,
  excludeIds = [],
  maxSelected,
}: ConnectionPickerProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { blockedIds } = useBlocks();
  const [people, setPeople] = useState<PublicProfile[] | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const ids = await fetchConnections();
        const profiles = await fetchAuthors(ids);
        if (!cancelled) setPeople([...profiles.values()]);
      } catch {
        if (!cancelled) setLoadError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const available = (people ?? []).filter(
    (p) => !excludeIds.includes(p.id) && !blockedIds.has(p.id)
  );

  function toggle(userId: string) {
    if (selected.includes(userId)) onChange(selected.filter((id) => id !== userId));
    else if (selected.length < maxSelected) onChange([...selected, userId]);
  }

  if (loadError) {
    return (
      <ThemedText type="small" style={{ color: theme.danger }}>
        {t('messages.loadError')}
      </ThemedText>
    );
  }
  if (!people) return <RowsSkeleton count={3} />;
  if (available.length === 0) {
    return (
      <ThemedText themeColor="textSecondary" style={styles.empty}>
        {t('privateGroups.noConnections')}
      </ThemedText>
    );
  }

  return (
    <View style={[styles.list, { borderColor: theme.border }]}>
      {available.map((person, index) => {
        const chosen = selected.includes(person.id);
        const disabled = !chosen && selected.length >= maxSelected;
        return (
          <Pressable
            key={person.id}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: chosen, disabled }}
            onPress={() => toggle(person.id)}
            style={({ pressed }) => [
              styles.row,
              { backgroundColor: theme.backgroundElement },
              index > 0 && { borderTopWidth: 1, borderTopColor: theme.border },
              (pressed || disabled) && styles.dimmed,
            ]}>
            <Avatar uri={person.avatar_url} name={person.first_name} size={40} />
            <ThemedText style={styles.name}>
              {person.first_name}, {person.age}
            </ThemedText>
            <View
              style={[
                styles.checkbox,
                { borderColor: chosen ? theme.primary : theme.border },
                chosen && { backgroundColor: theme.primary },
              ]}>
              {chosen && <Icon name="check" size={16} color={theme.onPrimary} strokeWidth={3} />}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  name: {
    flex: 1,
    fontWeight: 700,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    lineHeight: 22,
  },
  dimmed: {
    opacity: 0.5,
  },
});
