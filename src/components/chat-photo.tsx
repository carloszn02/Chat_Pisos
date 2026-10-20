import { Image } from 'expo-image';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const MAX_WIDTH = 240;
const MAX_HEIGHT = 320;

type ChatPhotoProps = {
  url: string | undefined;
  width: number | null;
  height: number | null;
  /** The app couldn't get a link for it (shows "Photo unavailable"). */
  failed?: boolean;
  onPress: () => void;
};

/** A photo inside a chat bubble, sized from its real shape so the chat doesn't jump. */
export function ChatPhoto({ url, width, height, failed = false, onPress }: ChatPhotoProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  // The file itself didn't load (e.g. it was deleted or is damaged).
  const [broken, setBroken] = useState(false);
  const unavailable = failed || broken;
  const ratio = width && height ? width / height : 4 / 3;
  // Fit inside 240 × 320 keeping the shape.
  let shownWidth = MAX_WIDTH;
  let shownHeight = shownWidth / ratio;
  if (shownHeight > MAX_HEIGHT) {
    shownHeight = MAX_HEIGHT;
    shownWidth = shownHeight * ratio;
  }

  return (
    <Pressable
      accessibilityRole="imagebutton"
      accessibilityLabel={t('chats.photo')}
      accessibilityHint={t('chats.openPhoto')}
      onPress={onPress}
      disabled={!url || unavailable}
      style={[
        styles.photo,
        { width: shownWidth, height: shownHeight, backgroundColor: theme.backgroundSelected },
      ]}>
      {url && !unavailable && (
        <Image
          source={{ uri: url }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={150}
          onError={() => setBroken(true)}
        />
      )}
      {unavailable && (
        <View style={styles.unavailable}>
          <ThemedText type="small" themeColor="textSecondary">
            {t('chats.photoUnavailable')}
          </ThemedText>
        </View>
      )}
    </Pressable>
  );
}

/** The photo full screen, on a dark background. Tap ✕ (or anywhere) to close. */
export function PhotoViewer({ url, onClose }: { url: string | null; onClose: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={!!url} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={styles.viewer}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t('chats.closePhoto')}>
        {url && <Image source={{ uri: url }} style={styles.full} contentFit="contain" />}
        <View style={[styles.close, { top: insets.top + Spacing.three }]}>
          <Icon name="close" size={20} color="#FFFFFF" strokeWidth={2.2} />
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  photo: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  unavailable: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.two,
  },
  viewer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  full: {
    width: '100%',
    height: '100%',
  },
  close: {
    position: 'absolute',
    right: Spacing.three,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 700,
  },
});
