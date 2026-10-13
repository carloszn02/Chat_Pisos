/**
 * True when the database refused an action because of the spam limits
 * (too many messages, conversations, listings or reports in a short time).
 */
export function isRateLimitError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    (error as { message: unknown }).message === 'rate_limit'
  );
}
