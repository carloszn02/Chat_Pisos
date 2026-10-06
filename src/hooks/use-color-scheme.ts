/**
 * The app always uses its light palette, whatever the phone or computer is set to.
 * Use this instead of React Native's useColorScheme everywhere.
 */
export function useColorScheme(): 'light' | 'dark' {
  return 'light';
}
