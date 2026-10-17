import { Share } from 'react-native';

/**
 * Opens the phone's share menu (WhatsApp, Telegram, copy…) with a message and a link.
 * Returns 'shared', or 'cancelled' if the person closed the menu.
 */
export async function shareLink(
  message: string,
  url: string
): Promise<'shared' | 'copied' | 'cancelled'> {
  const result = await Share.share({ message: `${message}\n${url}` });
  return result.action === Share.dismissedAction ? 'cancelled' : 'shared';
}
