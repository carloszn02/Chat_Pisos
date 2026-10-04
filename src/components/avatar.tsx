import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

type AvatarProps = {
  uri: string | null;
  name: string;
  size: number;
};

/** A round profile photo, or the person's initial when there is no photo. */
export function Avatar({ uri, name, size }: AvatarProps) {
  const theme = useTheme();
  const shape = { width: size, height: size, borderRadius: size / 2 };

  if (uri) {
    return <Image source={{ uri }} style={shape} contentFit="cover" accessibilityLabel={name} />;
  }
  return (
    <View style={[styles.fallback, shape, { backgroundColor: theme.primary }]}>
      <ThemedText style={{ color: theme.onPrimary, fontSize: size * 0.4, lineHeight: size * 0.5, fontWeight: 700 }}>
        {name.trim().charAt(0).toUpperCase()}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
