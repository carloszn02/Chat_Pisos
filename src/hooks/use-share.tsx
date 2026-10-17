import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Toast } from '@/components/toast';
import { shareLink } from '@/lib/share';

/**
 * Sharing a link from a screen: `share(message, url)` opens the share menu (or copies
 * the link on a computer), and `toast` shows "Link copied" when that happens.
 */
export function useShare() {
  const { t } = useTranslation();
  const [message, setMessage] = useState<string | null>(null);
  const hide = useCallback(() => setMessage(null), []);

  async function share(text: string, url: string) {
    try {
      const result = await shareLink(text, url);
      if (result === 'copied') setMessage(t('share.copied'));
    } catch {
      setMessage(t('share.error'));
    }
  }

  return { share, toast: <Toast message={message} onHide={hide} /> };
}
