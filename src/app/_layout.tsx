import '@/i18n';

import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { SessionProvider, useSession } from '@/hooks/use-session';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <SessionProvider>
        <SplashScreenController />
        <RootNavigator />
      </SessionProvider>
    </ThemeProvider>
  );
}

// Keeps the splash screen up until we know whether the user is logged in.
function SplashScreenController() {
  const { isLoading } = useSession();
  if (!isLoading) {
    SplashScreen.hide();
  }
  return null;
}

// Logged-out users can only reach the sign-in screen; logged-in users get the app.
function RootNavigator() {
  const { session } = useSession();
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
    </Stack>
  );
}
