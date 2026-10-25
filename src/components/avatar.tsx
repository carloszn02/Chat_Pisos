import { Image } from 'expo-image';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { PhotoViewer } from '@/components/chat-photo';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

type AvatarProps = {
  uri: string | null;
  name: string;
  size: number;
  /** Tapping the photo opens it big, full screen (like WhatsApp). */
  zoomable?: boolean;
};

/** A round profile photo, or the person's initial when there is no photo. */
export function Avatar({ uri, name, size, zoomable = false }: AvatarProps) {
  const theme = useTheme();
  const shape = { width: size, height: size, borderRadius: size / 2 };

  if (uri) {
    const image = (
      <Image source={{ uri }} style={shape} contentFit="cover" accessibilityLabel={name} />
    );
    return zoomable ? <ZoomablePhoto url={uri}>{image}</ZoomablePhoto> : image;
  }
  return (
    <View style={[styles.fallback, shape, { backgroundColor: theme.primary }]}>
      <ThemedText
        style={{
          color: theme.onPrimary,
          fontSize: size * 0.4,
          lineHeight: size * 0.5,
          fontWeight: 700,
        }}>
        {name.trim().charAt(0).toUpperCase()}
      </ThemedText>
    </View>
  );
}

/** Wraps a small photo so tapping it shows it full screen. */
export function ZoomablePhoto({ url, children }: { url: string; children: ReactNode }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        accessibilityRole="imagebutton"
        accessibilityLabel={t('chats.openPhoto')}
        onPress={() => setOpen(true)}
        style={({ pressed }) => pressed && styles.pressed}>
        {children}
      </Pressable>
      <PhotoViewer url={open ? url : null} onClose={() => setOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.8,
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
