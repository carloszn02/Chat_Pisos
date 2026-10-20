import '@/i18n';

import { DarkTheme, DefaultTheme, Stack, ThemeProvider, type Theme } from 'expo-router';
import Head from 'expo-router/head';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';

import { ConnectionError } from '@/components/connection-error';
import { AppFonts, Colors } from '@/constants/theme';
import { BlocksProvider } from '@/hooks/use-blocks';
import { AppearanceProvider, useColorScheme } from '@/hooks/use-color-scheme';
import { InboxProvider } from '@/hooks/use-inbox';
import { MutesProvider } from '@/hooks/use-mutes';
import { usePendingLinks } from '@/hooks/use-pending-links';
import { PlacesProvider } from '@/hooks/use-places';
import { ProfileProvider, useProfile } from '@/hooks/use-profile';
import { SavedProvider } from '@/hooks/use-saved';
import { SessionProvider, useSession } from '@/hooks/use-session';

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
      regular: { fontFamily: AppFonts.regular, fontWeight: '400' },
      medium: { fontFamily: AppFonts.medium, fontWeight: '500' },
      bold: { fontFamily: AppFonts.bold, fontWeight: '700' },
      heavy: { fontFamily: AppFonts.heading, fontWeight: '800' },
    },
  };
}

const headerOptions = {
  headerShown: true,
  headerBackTitle: '',
  headerTitleStyle: { fontFamily: AppFonts.headingSemiBold, fontWeight: '700' as const },
};

export default function RootLayout() {
  return (
    <>
      {/* Browser tab title on the web (ignored on phones). */}
      <Head>
        <title>Chat Pisos · Habitaciones y compañeros de piso en Madrid</title>
      </Head>
      <AppearanceProvider>
        <ThemedNavigation>
          <SessionProvider>
            <ProfileProvider>
              <BlocksProvider>
                <PlacesProvider>
                  <MutesProvider>
                    <SavedProvider>
                      <InboxProvider>
                        <SplashScreenController />
                        <RootNavigator />
                      </InboxProvider>
                    </SavedProvider>
                  </MutesProvider>
                </PlacesProvider>
              </BlocksProvider>
            </ProfileProvider>
          </SessionProvider>
        </ThemedNavigation>
      </AppearanceProvider>
    </>
  );
}

/** Navigation colours and the status bar follow the chosen look (light or dark). */
function ThemedNavigation({ children }: { children: React.ReactNode }) {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={navigationTheme(colorScheme)}>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      {children}
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

// Logged out -> sign-in. Opened a password reset link -> reset-password.
// Logged in without a profile -> create-profile. Otherwise -> the app.
function RootNavigator() {
  const { session, isLoading: sessionLoading, isRecoveringPassword } = useSession();
  const { profile, isLoading, loadFailed, refresh } = useProfile();
  const loggedIn = !!session;
  const hasProfile = !!profile;
  const inApp = loggedIn && !isRecoveringPassword;

  // Shared links opened while logged out are opened after signing in.
  usePendingLinks({
    loggedOut: !loggedIn && !sessionLoading,
    inApp: inApp && hasProfile && !isLoading,
  });

  // Couldn't reach the server: don't mistake that for "no profile yet".
  if (inApp && loadFailed) return <ConnectionError onRetry={refresh} />;

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
        <Stack.Screen name="settings" options={headerOptions} />
        <Stack.Screen name="listing/[id]" options={headerOptions} />
        <Stack.Screen name="edit-listing/[id]" options={headerOptions} />
        <Stack.Screen name="delete-account" options={headerOptions} />
        <Stack.Screen name="suggest-area" options={headerOptions} />
        <Stack.Screen name="explore-groups" options={headerOptions} />
        <Stack.Screen name="group-info/[slug]" options={headerOptions} />
        <Stack.Screen name="new-private-group" options={headerOptions} />
        <Stack.Screen name="private-group/[id]" options={headerOptions} />
        <Stack.Screen name="private-group-members/[id]" options={headerOptions} />
        <Stack.Screen name="join/[token]" options={headerOptions} />
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
