/**
 * On the web: the browser's share menu where there is one (phones), otherwise the link is
 * copied so it can be pasted anywhere.
 */
export async function shareLink(
  message: string,
  url: string
): Promise<'shared' | 'copied' | 'cancelled'> {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ text: message, url });
      return 'shared';
    } catch (error) {
      if ((error as Error).name === 'AbortError') return 'cancelled';
      // Some browsers refuse; fall back to copying.
    }
  }
  await navigator.clipboard.writeText(`${message} ${url}`);
  return 'copied';
}
