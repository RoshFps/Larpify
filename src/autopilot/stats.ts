import { readJson, writeJson } from '../lib/storage';

const KEY = 'larpify.stats';

interface DailyStats {
  day: string;
  ms: number;
}

function today(now: number): string {
  const d = new Date(now);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export function readTodayMs(now = Date.now()): number {
  const stats = readJson<DailyStats>(KEY);
  return stats?.day === today(now) ? stats.ms : 0;
}

export function addListening(ms: number, now = Date.now()): number {
  const total = readTodayMs(now) + ms;
  writeJson(KEY, { day: today(now), ms: total } satisfies DailyStats);
  return total;
}

const ARTIST_KEY = 'larpify.artistLog';

interface ArtistLog {
  year: number;
  byArtist: Record<string, { name: string; ms: number }>;
}

export interface ArtistTotal {
  id: string;
  name: string;
  ms: number;
}

function readArtistLog(now: number): ArtistLog {
  const year = new Date(now).getFullYear();
  const log = readJson<ArtistLog>(ARTIST_KEY);
  return log?.year === year ? log : { year, byArtist: {} };
}

/** Time autopilot spent on each artist this calendar year, credited to the track's main artist. */
export function addArtistListening(artist: { id: string; name: string }, ms: number, now = Date.now()): void {
  const log = readArtistLog(now);
  const entry = log.byArtist[artist.id] ?? { name: artist.name, ms: 0 };
  log.byArtist[artist.id] = { name: artist.name, ms: entry.ms + ms };
  writeJson(ARTIST_KEY, log);
}

export function readArtistTotals(now = Date.now()): ArtistTotal[] {
  return Object.entries(readArtistLog(now).byArtist)
    .map(([id, { name, ms }]) => ({ id, name, ms }))
    .sort((a, b) => b.ms - a.ms);
}
