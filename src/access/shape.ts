export interface AccessRequest {
  name: string;
  email: string;
  requestedAt: number;
}

export const MAX_NAME = 60;
export const MAX_EMAIL = 254;

// Deliberately simple: the real check is the owner pasting it into Spotify.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Validates what a friend typed. Returns a cleaned request, or an error message to show them. */
export function parseAccessRequest(value: unknown, now: number): AccessRequest | string {
  if (typeof value !== 'object' || value === null) return 'Please fill in the form.';
  const { name, email } = value as Record<string, unknown>;
  if (typeof name !== 'string' || !name.trim()) return 'Please add your name.';
  if (typeof email !== 'string' || !EMAIL.test(email.trim())) return 'That email doesn’t look right.';
  if (name.trim().length > MAX_NAME || email.trim().length > MAX_EMAIL) return 'That’s a bit long. Please shorten it.';
  return { name: name.trim(), email: email.trim().toLowerCase(), requestedAt: now };
}
