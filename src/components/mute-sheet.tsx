import { useTranslation } from 'react-i18next';

import { ActionSheet } from '@/components/action-sheet';
import { useMutes } from '@/hooks/use-mutes';
import type { ChatKind } from '@/lib/mutes';

type MuteSheetProps = {
  visible: boolean;
  kind: ChatKind;
  chatId: string;
  onClose: () => void;
  onError?: () => void;
};

/** "Mute for 8 hours / 1 week / until I turn it back on", or "Unmute" if already muted. */
export function MuteSheet({ visible, kind, chatId, onClose, onError }: MuteSheetProps) {
  const { t } = useTranslation();
  const { isMuted, mute, unmute } = useMutes();
  const muted = isMuted(kind, chatId);

  const run = (action: () => Promise<void>) => () => {
    action().catch(() => onError?.());
  };

  return (
    <ActionSheet
      visible={visible}
      title={muted ? t('mute.mutedTitle') : t('mute.title')}
      message={t('mute.body')}
      options={
        muted
          ? [{ label: t('mute.unmute'), onPress: run(() => unmute(kind, chatId)) }]
          : [
              { label: t('mute.hours8'), onPress: run(() => mute(kind, chatId, '8h')) },
              { label: t('mute.week'), onPress: run(() => mute(kind, chatId, '1w')) },
              { label: t('mute.always'), onPress: run(() => mute(kind, chatId, 'always')) },
            ]
      }
      onClose={onClose}
    />
  );
}

/** The menu entry that opens the sheet: "Mute" or "Unmute". */
export function useMuteLabel(kind: ChatKind, chatId: string | undefined): string {
  const { t } = useTranslation();
  const { isMuted } = useMutes();
  return chatId && isMuted(kind, chatId) ? t('mute.unmuteMenu') : t('mute.menu');
}
