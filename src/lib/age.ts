/** Age in whole years from a YYYY-MM-DD date. */
export function ageFromBirthDate(birthDate: string): number {
  const [year, month, day] = birthDate.split('-').map(Number);
  const now = new Date();
  let age = now.getFullYear() - year;
  const hadBirthdayThisYear =
    now.getMonth() + 1 > month || (now.getMonth() + 1 === month && now.getDate() >= day);
  if (!hadBirthdayThisYear) age -= 1;
  return age;
}

/** Returns a real calendar date (UTC midnight), or null if the numbers don't form one. */
export function parseCalendarDate(day: string, month: string, year: string): Date | null {
  const d = Number(day);
  const m = Number(month);
  const y = Number(year);
  if (!Number.isInteger(d) || !Number.isInteger(m) || !Number.isInteger(y) || y < 1900 || y > 2100) {
    return null;
  }
  const date = new Date(Date.UTC(y, m - 1, d));
  const matches =
    date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
  return matches ? date : null;
}

/** Like parseCalendarDate, but a birth date can't be in the future. */
export function parseBirthDate(day: string, month: string, year: string): Date | null {
  const date = parseCalendarDate(day, month, year);
  return date && date <= new Date() ? date : null;
}

export function isAdult(birthDate: Date): boolean {
  return ageFromBirthDate(birthDate.toISOString().slice(0, 10)) >= 18;
}
