import { readJson, writeJson } from '../lib/storage';

// One snapshot of the predicted rankings per day, so the Recap page can show
// how things moved since the last day you looked.

const KEY = 'larpify.recapSnapshots';
const KEEP_DAYS = 14;

export interface Snapshot {
  day: string;
  artists: string[];
  tracks: string[];
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
