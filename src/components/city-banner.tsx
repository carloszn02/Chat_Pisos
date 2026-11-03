import { Image, type ImageSource } from 'expo-image';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { AppFonts, Spacing } from '@/constants/theme';
import type { City } from '@/types/places';

// City photos shipped with the app, by city slug. The credit text lives in the database and
// is shown in Settings › About (the photo licence asks for it).
const CITY_PHOTOS: Record<string, { source: ImageSource | number; focus: string }> = {
  // A tall photo shown as a wide strip: focus on the angel and the top of the Metrópolis dome,
  // so phones and computers both show the best part (not a slice from the middle).
  madrid: { source: require('@/assets/images/cities/madrid.jpg'), focus: '13%' },
};

/** Wider screens (computers, tablets) get a taller banner, so the photo isn't a thin slice. */
const WIDE_SCREEN = 700;

/** A wide photo of the city with its name, shown at the top of the Chats tab. */
export function CityBanner({ city, subtitle }: { city: City; subtitle: string }) {
  const photo = CITY_PHOTOS[city.slug];
  const { width } = useWindowDimensions();

  return (
    <View style={[styles.banner, width >= WIDE_SCREEN && styles.bannerWide]}>
      {photo && (
        <Image
          source={photo.source}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          contentPosition={{ top: photo.focus, left: '50%' }}
          accessibilityIgnoresInvertColors
        />
      )}
      {/* A dusk sky over the photo; darker at the bottom so the white text stays readable. */}
      <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none" viewBox="0 0 100 100">
        <Defs>
          <LinearGradient id="dusk" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#2E3A78" stopOpacity="0.62" />
            <Stop offset="0.45" stopColor="#C98B3A" stopOpacity="0.22" />
            <Stop offset="1" stopColor="#141628" stopOpacity="0.82" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100" height="100" fill="url(#dusk)" />
      </Svg>
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
    backgroundColor: '#2E3A78',
  },
  bannerWide: {
    height: 210,
  },
  text: {
    padding: Spacing.three,
    gap: 2,
  },
  name: {
    color: '#FFFFFF',
    fontFamily: AppFonts.heading,
    fontWeight: 800,
    letterSpacing: -0.6,
    fontSize: 30,
    lineHeight: 36,
  },
  subtitle: {
    color: '#FFFFFF',
    opacity: 0.92,
  },
});
