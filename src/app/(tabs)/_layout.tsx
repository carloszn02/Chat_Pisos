import AppTabs from '@/components/app-tabs';

/**
 * The main tabs. New people are taught in context (a one-time tip on each screen, see
 * HintCard) instead of a tutorial up front; the tutorial stays in Settings › Información.
 */
export default function TabLayout() {
  return <AppTabs />;
}
