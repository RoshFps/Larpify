import { readJson, writeJson } from '../lib/storage';

// One snapshot of the predicted rankings per day, so the Recap page can show
// how things moved since the last day you looked.

const KEY = 'larpify.recapSnapshots';
/** Enough for a 3-month #1 history. Each entry is a few KB at most. */
const KEEP_DAYS = 92;

export interface Snapshot {
  day: string;
  artists: string[];
  tracks: string[];
  /** Names of that day's 4-week #1 artist and song (older snapshots lack them). */
  topArtist?: string;
  topTrack?: string;
}

export function dayKey(now: number): string {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Most recent snapshot from before today, or null on the first day. */
export function previousSnapshot(snapshots: readonly Snapshot[], now: number): Snapshot | null {
  const today = dayKey(now);
  return [...snapshots].reverse().find((s) => s.day < today) ?? null;
}

/** Replaces today's entry and drops anything older than two weeks of entries. */
export function withSnapshot(snapshots: readonly Snapshot[], snapshot: Snapshot): Snapshot[] {
  return [...snapshots.filter((s) => s.day !== snapshot.day), snapshot]
    .sort((a, b) => a.day.localeCompare(b.day))
    .slice(-KEEP_DAYS);
}

export function loadSnapshots(): Snapshot[] {
  return readJson<Snapshot[]>(KEY) ?? [];
}

export function saveSnapshots(snapshots: Snapshot[]): void {
  writeJson(KEY, snapshots);
}

const HISTORY_DAYS = 90;

function mostFrequent(names: (string | undefined)[]): { name: string; days: number } | null {
  const counts = new Map<string, number>();
  for (const name of names) if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
  let best: { name: string; days: number } | null = null;
  for (const [name, days] of counts) if (!best || days > best.days) best = { name, days };
  return best;
}

/** Which artist and song were #1 on the most days over the last 3 months. */
export function topHistory(snapshots: readonly Snapshot[], now: number) {
  const since = dayKey(now - HISTORY_DAYS * 86_400_000);
  const recent = snapshots.filter((s) => s.day >= since && s.topArtist);
  return {
    artist: mostFrequent(recent.map((s) => s.topArtist)),
    track: mostFrequent(recent.map((s) => s.topTrack)),
    days: recent.length,
  };
}
