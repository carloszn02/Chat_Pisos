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

/** "10:42". Used under each chat bubble (the day is shown in the divider above). */
export function formatMessageTime(iso: string, language: string): string {
  return new Date(iso).toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit' });
}

/** True if both moments fall on the same day (in the phone's time zone). */
export function isSameDay(a: string, b: string): boolean {
  const first = new Date(a);
  const second = new Date(b);
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}

/**
 * The chat divider for a day: "Hoy", "Ayer", "Lunes" (this week), "12 de octubre"
 * (this year) or "12 de octubre de 2025".
 */
export function formatChatDay(
  iso: string,
  language: string,
  words: { today: string; yesterday: string }
): string {
  const date = new Date(iso);
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const daysAgo = Math.round((startOfDay(new Date()) - startOfDay(date)) / (24 * 60 * 60 * 1000));
  if (daysAgo === 0) return words.today;
  if (daysAgo === 1) return words.yesterday;
  let text: string;
  if (daysAgo > 1 && daysAgo < 7) {
    text = date.toLocaleDateString(language, { weekday: 'long' });
  } else {
    const sameYear = date.getFullYear() === new Date().getFullYear();
    text = date.toLocaleDateString(language, {
      day: 'numeric',
      month: 'long',
      ...(sameYear ? {} : { year: 'numeric' }),
    });
  }
  return text.charAt(0).toUpperCase() + text.slice(1);
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
