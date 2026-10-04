function isToday(date: Date): boolean {
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

/** "10:42" for today, "28/9" for older dates. Used in chat list previews. */
export function formatShortTime(iso: string, language: string): string {
  const date = new Date(iso);
  if (isToday(date)) {
    return date.toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString(language, { day: 'numeric', month: 'numeric' });
}

/** "10:42" for today, "28/9 10:42" for older messages. Used under each chat bubble. */
export function formatMessageTime(iso: string, language: string): string {
  const date = new Date(iso);
  const time = date.toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit' });
  if (isToday(date)) return time;
  return `${date.toLocaleDateString(language, { day: 'numeric', month: 'numeric' })} ${time}`;
}
