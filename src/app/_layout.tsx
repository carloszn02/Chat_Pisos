import '@/i18n';

import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { ProfileProvider, useProfile } from '@/hooks/use-profile';
import { SessionProvider, useSession } from '@/hooks/use-session';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <SessionProvider>
        <ProfileProvider>
          <SplashScreenController />
          <RootNavigator />
        </ProfileProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}

// Keeps the splash screen up until we know who is logged in and whether they have a profile.
function SplashScreenController() {
  const { isLoading } = useProfile();
  if (!isLoading) {
    SplashScreen.hide();
  }
  return null;
}

// Logged out -> sign-in. Logged in without a profile -> create-profile. Otherwise -> the app.
function RootNavigator() {
  const { session } = useSession();
  const { profile, isLoading } = useProfile();
  const loggedIn = !!session;
  const hasProfile = !!profile;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={loggedIn && (hasProfile || isLoading)}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
      <Stack.Protected guard={loggedIn && !hasProfile && !isLoading}>
        <Stack.Screen name="create-profile" />
      </Stack.Protected>
      <Stack.Protected guard={!loggedIn}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
    </Stack>
  );
}
