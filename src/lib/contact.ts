/**
 * Contact details on listings: turning what people type into the format the database
 * accepts, and the links that open Instagram, WhatsApp, the phone and so on.
 */

/** Accepts "@ana.pisos", "ana.pisos" or an instagram.com link. Null when it isn't valid. */
export function normalizeInstagram(text: string): string | null {
  let value = text.trim();
  const fromLink = value.match(/instagram\.com\/([^/?#\s]+)/i);
  if (fromLink) value = fromLink[1];
  value = value.replace(/^@/, '');
  return /^[A-Za-z0-9._]{1,30}$/.test(value) ? value : null;
}

/** Accepts a linkedin.com link (with or without https://) or just the profile name. */
export function normalizeLinkedin(text: string): string | null {
  const value = text.trim();
  let url: string;
  if (/linkedin\.com\//i.test(value)) {
    url = value.replace(/^(https?:\/\/)?/i, 'https://');
  } else if (/^[A-Za-z0-9_%-]{3,100}$/.test(value)) {
    url = `https://www.linkedin.com/in/${value}`;
  } else {
    return null;
  }
  url = url.replace(/^https:\/\/[^/]+/, (host) => host.toLowerCase());
  return url.length <= 200 && /^https:\/\/([a-z]{2,3}\.)?linkedin\.com\/\S+$/.test(url)
    ? url
    : null;
}

/** Spanish numbers can be written without +34; others need their country code. */
export function normalizePhone(text: string): string | null {
  let value = text.replace(/[\s\-().]/g, '');
  if (value.startsWith('00')) value = `+${value.slice(2)}`;
  if (/^[6789]\d{8}$/.test(value)) value = `+34${value}`;
  return /^\+\d{8,15}$/.test(value) ? value : null;
}

/** Any web link; https:// is added when missing. */
export function normalizeLink(text: string): string | null {
  const value = text.trim().replace(/^(https?:\/\/)?/i, 'https://');
  return value.length <= 200 && /^https:\/\/\S+\.\S+$/.test(value) ? value : null;
}

/** "+34612345678" → "+34 612 34 56 78"; other countries are shown as saved. */
export function formatPhone(phone: string): string {
  const spanish = phone.match(/^\+34(\d{3})(\d{2})(\d{2})(\d{2})$/);
  return spanish ? `+34 ${spanish[1]} ${spanish[2]} ${spanish[3]} ${spanish[4]}` : phone;
}

/** How a saved phone number is shown back in the form (Spanish ones without +34). */
export function phoneForEditing(phone: string): string {
  return phone.startsWith('+34') ? formatPhone(phone).slice(4) : phone;
}

export const instagramUrl = (username: string) => `https://www.instagram.com/${username}/`;
export const whatsappUrl = (phone: string) => `https://wa.me/${phone.replace('+', '')}`;
export const phoneUrl = (phone: string) => `tel:${phone}`;

/** "https://www.linkedin.com/in/ana" → "linkedin.com/in/ana", for showing links shorter. */
export function shortLink(url: string): string {
  return url.replace(/^https:\/\/(www\.)?/, '').replace(/\/$/, '');
}
