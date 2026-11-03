import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
} from 'react-native';

import { Icon } from '@/components/icon';
import { useTheme } from '@/hooks/use-theme';

type PasswordInputProps = Omit<TextInputProps, 'secureTextEntry' | 'style'> & {
  style?: StyleProp<TextStyle>;
};

/** A password box with an eye button to show what you typed (and hide it again). */
export function PasswordInput({ style, ...props }: PasswordInputProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [visible, setVisible] = useState(false);
  return (
    <View style={styles.wrap}>
      <TextInput
        {...props}
        style={[style, styles.input]}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={visible ? t('auth.hidePassword') : t('auth.showPassword')}
        aria-pressed={visible}
        onPress={() => setVisible((current) => !current)}
        hitSlop={8}
        style={({ pressed }) => [styles.eye, pressed && styles.pressed]}>
        <Icon name={visible ? 'eye-off' : 'eye'} size={20} color={theme.textSecondary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    justifyContent: 'center',
  },
  input: {
    // Room for the eye button on the right.
    paddingRight: 48,
  },
  eye: {
    position: 'absolute',
    right: 0,
    width: 48,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
});
