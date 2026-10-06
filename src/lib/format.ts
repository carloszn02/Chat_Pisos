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

/** "€620" in the user's language. */
export function formatPrice(euros: number, language: string): string {
  return new Intl.NumberFormat(language, {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(euros);
}

/** "1 Nov 2026" (or "1 nov 2026" in Spanish) from a YYYY-MM-DD date. */
export function formatDate(isoDate: string, language: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(language, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
