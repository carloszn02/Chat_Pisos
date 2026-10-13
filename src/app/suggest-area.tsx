import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useOpenGroups } from '@/hooks/use-open-groups';
import { usePlaces } from '@/hooks/use-places';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { fetchMyInterests, setInterest } from '@/lib/places';

/**
 * Lists the districts and neighbourhoods that don't have a group chat yet. People tap the
 * ones they'd like; when enough people ask for a place, the team opens its group and
 * everyone who asked joins it automatically.
 */
export default function SuggestAreaScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { session } = useSession();
  const userId = session?.user.id;
  const { city, districts, neighbourhoodsOf } = usePlaces();
  const groups = useOpenGroups();

  const [interests, setInterests] = useState<Set<string> | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    fetchMyInterests(userId)
      .then((found) => {
        if (!cancelled) setInterests(found);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const withGroup = new Set(groups.map((g) => g.area_id));

  async function toggle(areaId: string) {
    if (!userId || !interests) return;
    const next = !interests.has(areaId);
    setError(false);
    // Update the screen straight away; undo if the database refuses.
    setInterests(
      new Set(next ? [...interests, areaId] : [...interests].filter((id) => id !== areaId))
    );
    try {
      await setInterest(userId, areaId, next);
    } catch {
      setError(true);
      setInterests(interests);
    }
  }

  function interestButton(areaId: string, name: string) {
    const chosen = interests?.has(areaId) ?? false;
    return (
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: chosen }}
        accessibilityLabel={name}
        onPress={() => toggle(areaId)}
        style={({ pressed }) => [
          styles.interest,
          chosen
            ? { backgroundColor: theme.primary, borderColor: theme.primary }
            : { borderColor: theme.border },
          pressed && styles.pressed,
        ]}>
        <ThemedText type="smallBold" style={{ color: chosen ? theme.onPrimary : theme.text }}>
          {chosen ? `✓ ${t('chats.interested')}` : t('chats.wantGroup')}
        </ThemedText>
      </Pressable>
    );
  }

  return (
    <ThemedView style={styles.screen}>
      <Stack.Screen options={{ title: t('chats.suggestTitle') }} />
      <ScrollView>
        <View style={styles.content}>
          <ThemedText themeColor="textSecondary" style={styles.intro}>
            {t('chats.suggestIntro', { city: city?.name ?? '' })}
          </ThemedText>

          {error && (
            <ThemedText type="small" style={{ color: theme.danger }}>
              {t('messages.actionError')}
            </ThemedText>
          )}

          {!interests ? (
            <ActivityIndicator color={theme.primary} />
          ) : (
            districts.map((district) => {
              const hoods = neighbourhoodsOf(district.id).filter((h) => !withGroup.has(h.id));
              const isOpen = expanded === district.id;
              return (
                <View
                  key={district.id}
                  style={[
                    styles.district,
                    { borderColor: theme.border, backgroundColor: theme.backgroundElement },
                  ]}>
                  <View style={styles.districtRow}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ expanded: isOpen }}
                      onPress={() => setExpanded(isOpen ? null : district.id)}
                      style={styles.districtName}>
                      <ThemedText style={styles.bold}>{district.name}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {isOpen ? '▾' : '▸'}{' '}
                        {t('chats.neighbourhoodCount', { count: hoods.length })}
                      </ThemedText>
                    </Pressable>
                    {withGroup.has(district.id) ? (
                      <ThemedText type="small" themeColor="textSecondary">
                        {t('chats.hasGroup')}
                      </ThemedText>
                    ) : (
                      interestButton(district.id, district.name)
                    )}
                  </View>
                  {isOpen &&
                    hoods.map((hood) => (
                      <View
                        key={hood.id}
                        style={[styles.hoodRow, { borderTopColor: theme.border }]}>
                        <View style={styles.flex}>
                          <ThemedText>{hood.name}</ThemedText>
                          {hood.official_name !== hood.name && (
                            <ThemedText type="small" themeColor="textSecondary">
                              {hood.official_name}
                            </ThemedText>
                          )}
                        </View>
                        {interestButton(hood.id, hood.name)}
                      </View>
                    ))}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    padding: Spacing.four,
    gap: Spacing.two,
  },
  intro: {
    lineHeight: 22,
    marginBottom: Spacing.two,
  },
  district: {
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  districtRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
  },
  districtName: {
    flex: 1,
    gap: 2,
  },
  hoodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderTopWidth: 1,
  },
  interest: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
  },
  flex: {
    flex: 1,
  },
  bold: {
    fontWeight: 700,
  },
  pressed: {
    opacity: 0.7,
  },
});
