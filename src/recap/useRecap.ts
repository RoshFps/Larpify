import { useEffect, useState } from 'react';
import { SpotifyApiError } from '../api/client';
import { getTopArtists, getTopTracks, type TimeRange } from '../api/spotify';
import type { Artist, Track } from '../api/types';
import { blendRankings, RANGE_WEIGHTS, type Prediction } from './predict';
import { dayKey, loadSnapshots, previousSnapshot, saveSnapshots, topHistory, withSnapshot } from './snapshots';

/** Spotify updates top lists about once a day, so Recap asks Spotify once per calendar day. */
const DAY_CHECK_MS = 60 * 60_000;

/** Oldest first, matching the order of each prediction's `parts`. */
export const RANGES: readonly TimeRange[] = ['long_term', 'medium_term', 'short_term'];

export interface Recap {
  artists: Prediction<Artist>[];
  tracks: Prediction<Track>[];
  /** Yesterday's (or the last earlier day's) order, for movement arrows. */
  previous: { artists: string[]; tracks: string[] } | null;
  /** #1 in Spotify's 4-week and ~6-month lists. */
  recent: {
    artist4w: Artist | null;
    track4w: Track | null;
    artist6m: Artist | null;
    track6m: Track | null;
  };
  /** Most frequent 4-week #1 over the last 90 days of daily snapshots. */
  history: { artist: NamedCount | null; track: NamedCount | null; days: number };
  updatedAt: number;
}

export interface NamedCount {
  name: string;
  days: number;
}

const CACHE_KEY = 'larpify.recapCache';

function readCache(): Recap | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as Recap) : null;
  } catch {
    return null;
  }
}

function writeCache(recap: Recap): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(recap));
  } catch {
    // Storage full or blocked: the cache is only a convenience.
  }
}

export type RecapState =
  | { status: 'loading' }
  | { status: 'needs-permission' }
  | { status: 'error'; message: string }
  | { status: 'ready'; recap: Recap };

async function fetchRecap(): Promise<RecapState> {
  const cached = readCache();
  // Top lists only change about daily, so a recent copy saves calls (and Spotify's rate limit).
  const fresh = cached && cached.recent && dayKey(cached.updatedAt) === dayKey(Date.now());
  if (fresh) return { status: 'ready', recap: cached };
  try {
    // One at a time: six at once is what trips Spotify's rate limit.
    const artistLists: Artist[][] = [];
    const trackLists: Track[][] = [];
    for (const range of RANGES) {
      artistLists.push(await getTopArtists(range));
      trackLists.push(await getTopTracks(range));
    }
    const artists = blendRankings(RANGES.map((range, i) => ({ items: artistLists[i]!, weight: RANGE_WEIGHTS[range] })));
    const tracks = blendRankings(RANGES.map((range, i) => ({ items: trackLists[i]!, weight: RANGE_WEIGHTS[range] })));

    const now = Date.now();
    // RANGES is long, medium, short.
    const recent = {
      artist4w: artistLists[2]?.[0] ?? null,
      track4w: trackLists[2]?.[0] ?? null,
      artist6m: artistLists[1]?.[0] ?? null,
      track6m: trackLists[1]?.[0] ?? null,
    };
    const snapshots = loadSnapshots();
    const previous = previousSnapshot(snapshots, now);
    const updated = withSnapshot(snapshots, {
      day: dayKey(now),
      artists: artists.map((p) => p.item.id),
      tracks: tracks.map((p) => p.item.id),
      topArtist: recent.artist4w?.name,
      topTrack: recent.track4w?.name,
    });
    saveSnapshots(updated);
    const recap: Recap = { artists, tracks, previous, recent, history: topHistory(updated, now), updatedAt: now };
    writeCache(recap);
    return { status: 'ready', recap };
  } catch (err) {
    // Rate limited: keep showing the last good result rather than an error.
    if (err instanceof SpotifyApiError && err.status === 429) {
      return cached?.recent
        ? { status: 'ready', recap: cached }
        : { status: 'error', message: err.message };
    }
    // Sessions from before this feature lack the user-top-read scope.
    if (err instanceof SpotifyApiError && err.status === 403) return { status: 'needs-permission' };
    return { status: 'error', message: err instanceof Error ? err.message : 'Could not load your stats.' };
  }
}

export function useRecap(): RecapState {
  const [state, setState] = useState<RecapState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetchRecap().then((next) => {
        if (!cancelled) setState(next);
      });
    void load();
    // Cheap: this only calls Spotify once the date has changed.
    const id = window.setInterval(() => void load(), DAY_CHECK_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  return state;
}
