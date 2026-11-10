// What a friend sees when you share your Recap: names and ranks only. No
// emails, no tokens, no listening history, nothing Spotify-identifying.

export const CODE_LENGTH = 6;
// No 0/O/1/I, so a code read aloud or typed from a screenshot still works.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const MAX_ENTRIES = 10;
export const MAX_NAME = 120;
export const MAX_SHARE_BYTES = 4_000;

export interface SharedEntry {
  id: string;
  name: string;
}

export interface SharedRecap {
  /** What this friend is called in the compare view: their Spotify display name. */
  displayName: string;
  artists: SharedEntry[];
  tracks: SharedEntry[];
  updatedAt: number;
}

export function makeCode(random: () => number = Math.random): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) code += ALPHABET[Math.floor(random() * ALPHABET.length)];
  return code;
}

/** Codes are shown and typed in upper case; accept any case and ignore spaces. */
export function normaliseCode(value: string): string | null {
  const code = value.trim().toUpperCase().replace(/\s|-/g, '');
  if (code.length !== CODE_LENGTH) return null;
  return [...code].every((c) => ALPHABET.includes(c)) ? code : null;
}

function cleanEntries(value: unknown): SharedEntry[] | null {
  if (!Array.isArray(value) || value.length > MAX_ENTRIES) return null;
  const entries: SharedEntry[] = [];
  for (const item of value) {
    if (typeof item !== 'object' || item === null) return null;
    const { id, name } = item as Record<string, unknown>;
    if (typeof id !== 'string' || typeof name !== 'string') return null;
    if (!id || !name.trim()) return null;
    entries.push({ id: id.slice(0, MAX_NAME), name: name.trim().slice(0, MAX_NAME) });
  }
  return entries;
}

/** Validates anything coming from the network, in either direction. */
export function parseSharedRecap(value: unknown, now: number): SharedRecap | null {
  if (typeof value !== 'object' || value === null) return null;
  const { displayName, artists, tracks, updatedAt } = value as Record<string, unknown>;
  const cleanArtists = cleanEntries(artists);
  const cleanTracks = cleanEntries(tracks);
  if (!cleanArtists || !cleanTracks) return null;
  if (typeof displayName !== 'string' || !displayName.trim()) return null;
  const when = typeof updatedAt === 'number' && Number.isFinite(updatedAt) ? updatedAt : now;
  return {
    displayName: displayName.trim().slice(0, MAX_NAME),
    artists: cleanArtists,
    tracks: cleanTracks,
    // Never trust a client clock to be in the future.
    updatedAt: Math.min(when, now),
  };
}

export interface SharedItem {
  name: string;
  /** 1-based rank for each person; null when they don't have it at all. */
  yours: number | null;
  theirs: number | null;
}

export interface Comparison {
  /** 0-100. How much of your two top lists overlap, weighted towards the top. */
  matchPercent: number;
  shared: SharedItem[];
  onlyYours: string[];
  onlyTheirs: string[];
}

function rankOf(list: readonly SharedEntry[], id: string): number | null {
  const index = list.findIndex((e) => e.id === id);
  return index === -1 ? null : index + 1;
}

/**
 * Compares two top lists. A shared item scores more when you both rank it
 * highly and rank it similarly, so two people whose #1 matches score higher
 * than two who merely both have someone at #9.
 */
export function compareLists(yours: readonly SharedEntry[], theirs: readonly SharedEntry[]): Comparison {
  const size = Math.max(yours.length, theirs.length);
  const shared: SharedItem[] = [];
  let points = 0;

  yours.forEach((entry, index) => {
    const theirRank = rankOf(theirs, entry.id);
    if (theirRank === null) return;
    shared.push({ name: entry.name, yours: index + 1, theirs: theirRank });
    const weight = (size - index) / size;
    const closeness = 1 - Math.abs(index + 1 - theirRank) / size;
    points += weight * closeness;
  });

  const best = yours.reduce((sum, _, index) => sum + (size - index) / size, 0);
  return {
    matchPercent: best === 0 ? 0 : Math.round((points / best) * 100),
    shared: shared.sort((a, b) => a.yours! + a.theirs! - (b.yours! + b.theirs!)),
    onlyYours: yours.filter((e) => rankOf(theirs, e.id) === null).map((e) => e.name),
    onlyTheirs: theirs.filter((e) => rankOf(yours, e.id) === null).map((e) => e.name),
  };
}
