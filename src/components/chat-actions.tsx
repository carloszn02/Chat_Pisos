/**
 * The options of a chat, opened by long-pressing it in a list (like WhatsApp):
 * mark as read, mute, share or info, profile, report, block, leave. Leaving and blocking
 * ask first.
 */

import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ActionSheet, type ActionSheetOption } from '@/components/action-sheet';
import { MuteSheet } from '@/components/mute-sheet';
import { useBlocks } from '@/hooks/use-blocks';
import { useMutes } from '@/hooks/use-mutes';
import { useSession } from '@/hooks/use-session';
import { useShare } from '@/hooks/use-share';
import { leaveGroup, markGroupRead } from '@/lib/chat';
import { markConversationRead } from '@/lib/direct-messages';
import { appUrl } from '@/lib/links';
import { leavePrivateGroup, markPrivateGroupRead } from '@/lib/private-groups';
import type { ChatGroup } from '@/types/chat';

export type ChatActionsTarget =
  | { kind: 'group'; group: ChatGroup; unread: number }
  | { kind: 'conversation'; id: string; otherUserId: string; name: string; unread: number }
  | { kind: 'private_group'; id: string; name: string; unread: number };

type ChatActionsProps = {
  target: ChatActionsTarget | null;
  onClose: () => void;
  /** Something changed (read, left, blocked…): the list should reload. */
  onChanged: () => void;
  /** Something went wrong (shown by the screen). */
  onError?: () => void;
};

export function ChatActions({ target, onClose, onChanged, onError }: ChatActionsProps) {
  const { t } = useTranslation();
  const { session } = useSession();
  const userId = session?.user.id;
  const { isMuted } = useMutes();
  const { block } = useBlocks();
  const { share, toast } = useShare();
  // The follow-up sheets: mute options, or "are you sure?".
  const [muteFor, setMuteFor] = useState<ChatActionsTarget | null>(null);
  const [confirm, setConfirm] = useState<{
    target: ChatActionsTarget;
    action: 'leave' | 'block';
  } | null>(null);

  const run = (action: () => Promise<unknown>) => () => {
    action()
      .then(onChanged)
      .catch(() => onError?.());
  };

  function muteKind(item: ChatActionsTarget) {
    return item.kind === 'group' ? 'group' : item.kind;
  }
  function chatId(item: ChatActionsTarget) {
    return item.kind === 'group' ? item.group.id : item.id;
  }

  let title = '';
  const options: ActionSheetOption[] = [];
  if (target) {
    title = target.kind === 'group' ? target.group.name : target.name;
    const muted = isMuted(muteKind(target), chatId(target));
    if (target.unread > 0) {
      options.push({
        label: t('chatActions.markRead'),
        onPress: run(() =>
          target.kind === 'group'
            ? markGroupRead(target.group.id)
            : target.kind === 'conversation'
              ? markConversationRead(target.id)
              : markPrivateGroupRead(target.id)
        ),
      });
    }
    options.push({
      label: muted ? t('mute.unmuteMenu') : t('mute.menu'),
      onPress: () => setMuteFor(target),
    });
    if (target.kind === 'group') {
      const group = target.group;
      options.push(
        {
          label: t('share.shareGroup'),
          onPress: () =>
            void share(
              t('share.groupMessage', { name: group.name }),
              appUrl(`/group/${group.slug}`)
            ),
        },
        {
          label: t('chats.groupInfo'),
          onPress: () =>
            router.push({ pathname: '/group-info/[slug]', params: { slug: group.slug } }),
        },
        {
          label: t('chats.leave'),
          destructive: true,
          onPress: () => setConfirm({ target, action: 'leave' }),
        }
      );
    } else if (target.kind === 'conversation') {
      options.push(
        {
          label: t('messages.viewProfile'),
          onPress: () =>
            router.push({ pathname: '/user/[id]', params: { id: target.otherUserId } }),
        },
        {
          label: t('report.action'),
          destructive: true,
          onPress: () =>
            router.push({
              pathname: '/report',
              params: { userId: target.otherUserId, name: target.name },
            }),
        },
        {
          label: t('blocked.blockName', { name: target.name }),
          destructive: true,
          onPress: () => setConfirm({ target, action: 'block' }),
        }
      );
    } else {
      options.push(
        {
          label: t('privateGroups.membersAndInvite'),
          onPress: () =>
            router.push({ pathname: '/private-group-members/[id]', params: { id: target.id } }),
        },
        {
          label: t('privateGroups.leave'),
          destructive: true,
          onPress: () => setConfirm({ target, action: 'leave' }),
        }
      );
    }
  }

  // "Are you sure?"
  let confirmTitle = '';
  let confirmMessage: string | undefined;
  let confirmOption: ActionSheetOption | null = null;
  if (confirm) {
    const item = confirm.target;
    if (confirm.action === 'block' && item.kind === 'conversation') {
      confirmTitle = t('blocked.confirmTitle', { name: item.name });
      confirmMessage = t('blocked.confirmBody');
      confirmOption = {
        label: t('blocked.block'),
        destructive: true,
        onPress: run(() => block(item.otherUserId)),
      };
    } else if (item.kind === 'group') {
      confirmTitle = t('chats.leaveConfirmTitle', { name: item.group.name });
      confirmMessage = t('chats.leaveConfirmBody');
      confirmOption = {
        label: t('chats.leave'),
        destructive: true,
        onPress: run(async () => {
          if (userId) await leaveGroup(item.group.id, userId);
        }),
      };
    } else if (item.kind === 'private_group') {
      confirmTitle = t('privateGroups.leaveConfirmTitle', { name: item.name });
      confirmMessage = t('privateGroups.leaveConfirmBody');
      confirmOption = {
        label: t('privateGroups.leave'),
        destructive: true,
        onPress: run(() => leavePrivateGroup(item.id)),
      };
    }
  }

  return (
    <>
      <ActionSheet visible={!!target} title={title} options={options} onClose={onClose} />
      {muteFor && (
        <MuteSheet
          visible
          kind={muteKind(muteFor)}
          chatId={chatId(muteFor)}
          onClose={() => {
            setMuteFor(null);
            onChanged();
          }}
          onError={onError}
        />
      )}
      <ActionSheet
        visible={!!confirm}
        title={confirmTitle}
        message={confirmMessage}
        options={confirmOption ? [confirmOption] : []}
        onClose={() => setConfirm(null)}
      />
      {toast}
    </>
  );
}
