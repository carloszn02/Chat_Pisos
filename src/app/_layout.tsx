import '@/i18n';

// Import each weight on its own so only these five font files end up in the app.
import { BricolageGrotesque_600SemiBold } from '@expo-google-fonts/bricolage-grotesque/600SemiBold';
import { BricolageGrotesque_700Bold } from '@expo-google-fonts/bricolage-grotesque/700Bold';
import { DMSans_400Regular } from '@expo-google-fonts/dm-sans/400Regular';
import { DMSans_500Medium } from '@expo-google-fonts/dm-sans/500Medium';
import { DMSans_700Bold } from '@expo-google-fonts/dm-sans/700Bold';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, type Theme } from 'expo-router';
import { useFonts } from 'expo-font';
import Head from 'expo-router/head';
import * as SplashScreen from 'expo-splash-screen';

import { AppFonts, Colors } from '@/constants/theme';
import { BlocksProvider } from '@/hooks/use-blocks';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ProfileProvider, useProfile } from '@/hooks/use-profile';
import { SessionProvider, useSession } from '@/hooks/use-session';
import { UnreadProvider } from '@/hooks/use-unread';

SplashScreen.preventAutoHideAsync();

// Navigation colors (headers, screen backgrounds) taken from our own palette.
function navigationTheme(scheme: 'light' | 'dark'): Theme {
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const colors = Colors[scheme];
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.background,
      text: colors.text,
      border: colors.border,
    },
    fonts: {
      ...base.fonts,
      regular: { fontFamily: AppFonts.regular, fontWeight: 'normal' },
      medium: { fontFamily: AppFonts.medium, fontWeight: 'normal' },
      bold: { fontFamily: AppFonts.bold, fontWeight: 'normal' },
      heavy: { fontFamily: AppFonts.heading, fontWeight: 'normal' },
    },
  };
}

const headerOptions = {
  headerShown: true,
  headerBackTitle: '',
  headerTitleStyle: { fontFamily: AppFonts.headingSemiBold },
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [fontsLoaded, fontError] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
    BricolageGrotesque_600SemiBold,
    BricolageGrotesque_700Bold,
  });

  // Keep the splash screen until the fonts are ready (or failed: then system fonts are used).
  const ready = fontsLoaded || !!fontError;

  return (
    <>
      {/* Browser tab title on the web (ignored on phones). */}
      <Head>
        <title>Chat Pisos · Habitaciones y compañeros de piso en Madrid</title>
      </Head>
      {ready && (
    <ThemeProvider value={navigationTheme(colorScheme === 'dark' ? 'dark' : 'light')}>
      <SessionProvider>
        <ProfileProvider>
          <BlocksProvider>
            <UnreadProvider>
              <SplashScreenController />
              <RootNavigator />
            </UnreadProvider>
          </BlocksProvider>
        </ProfileProvider>
      </SessionProvider>
    </ThemeProvider>
      )}
    </>
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

// Logged out -> sign-in. Opened a password reset link -> reset-password.
// Logged in without a profile -> create-profile. Otherwise -> the app.
function RootNavigator() {
  const { session, isRecoveringPassword } = useSession();
  const { profile, isLoading } = useProfile();
  const loggedIn = !!session;
  const hasProfile = !!profile;
  const inApp = loggedIn && !isRecoveringPassword;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={inApp && (hasProfile || isLoading)}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="edit-profile" options={headerOptions} />
        <Stack.Screen name="group/[slug]" options={headerOptions} />
        <Stack.Screen name="message-requests" options={headerOptions} />
        <Stack.Screen name="conversation/[id]" options={headerOptions} />
        <Stack.Screen name="user/[id]" options={headerOptions} />
        <Stack.Screen name="report" options={{ ...headerOptions, presentation: 'modal' }} />
        <Stack.Screen name="blocked-users" options={headerOptions} />
        <Stack.Screen name="listing/[id]" options={headerOptions} />
        <Stack.Screen name="edit-listing/[id]" options={headerOptions} />
        <Stack.Screen name="delete-account" options={headerOptions} />
      </Stack.Protected>
      <Stack.Protected guard={inApp && !hasProfile && !isLoading}>
        <Stack.Screen name="create-profile" />
      </Stack.Protected>
      <Stack.Protected guard={loggedIn && isRecoveringPassword}>
        <Stack.Screen name="reset-password" />
      </Stack.Protected>
      <Stack.Protected guard={!loggedIn}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
    </Stack>
  );
}
