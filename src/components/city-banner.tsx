import { Image } from 'expo-image';
import { StyleSheet, View, type ImageSourcePropType } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { AppFonts, Spacing } from '@/constants/theme';
import type { City } from '@/types/places';

// City photos shipped with the app, by city slug. The credit text lives in the database and
// is shown in Settings › About (the photo licence asks for it).
const CITY_PHOTOS: Record<string, ImageSourcePropType> = {
  madrid: require('@/assets/images/cities/madrid.jpg'),
};

/** A wide photo of the city with its name, shown at the top of the Chats tab. */
export function CityBanner({ city, subtitle }: { city: City; subtitle: string }) {
  const photo = CITY_PHOTOS[city.slug];

  return (
    <View style={styles.banner}>
      {photo && (
        <Image
          source={photo}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          accessibilityIgnoresInvertColors
        />
      )}
      {/* A soft shade so the white text stays readable on any photo. */}
      <View style={[StyleSheet.absoluteFill, styles.shade]} />
      <View style={styles.text}>
        <ThemedText style={styles.name}>{city.name}</ThemedText>
        <ThemedText type="small" style={styles.subtitle}>
          {subtitle}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    height: 150,
    borderRadius: 18,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    backgroundColor: '#8E6A52',
  },
  shade: {
    backgroundColor: 'rgba(30, 20, 14, 0.38)',
  },
  text: {
    padding: Spacing.three,
    gap: 2,
  },
  name: {
    color: '#FFFFFF',
    fontFamily: AppFonts.heading,
    fontSize: 30,
    lineHeight: 36,
  },
  subtitle: {
    color: '#FFFFFF',
    opacity: 0.92,
  },
});
