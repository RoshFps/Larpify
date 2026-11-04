import { useEffect, useState } from 'react';
import { SpotifyApiError } from '../api/client';
import { getTopArtists, getTopTracks, type TimeRange } from '../api/spotify';
import type { Artist, Track } from '../api/types';
import { blendRankings, RANGE_WEIGHTS, type Prediction } from './predict';
import { dayKey, loadSnapshots, previousSnapshot, saveSnapshots, withSnapshot } from './snapshots';

/** Spotify updates top lists about once a day; checking more often only spends rate limit. */
const REFRESH_MS = 6 * 60 * 60_000;

/** Oldest first, matching the order of each prediction's `parts`. */
export const RANGES: readonly TimeRange[] = ['long_term', 'medium_term', 'short_term'];

export interface Recap {
  artists: Prediction<Artist>[];
  tracks: Prediction<Track>[];
  /** Yesterday's (or the last earlier day's) order, for movement arrows. */
  previous: { artists: string[]; tracks: string[] } | null;
  updatedAt: number;
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
  if (cached && Date.now() - cached.updatedAt < REFRESH_MS) return { status: 'ready', recap: cached };
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
    const snapshots = loadSnapshots();
    const previous = previousSnapshot(snapshots, now);
    saveSnapshots(
      withSnapshot(snapshots, {
        day: dayKey(now),
        artists: artists.map((p) => p.item.id),
        tracks: tracks.map((p) => p.item.id),
      }),
    );
    const recap = { artists, tracks, previous, updatedAt: now };
    writeCache(recap);
    return { status: 'ready', recap };
  } catch (err) {
    // Rate limited: keep showing the last good result rather than an error.
    if (err instanceof SpotifyApiError && err.status === 429) {
      return cached
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
    const id = window.setInterval(() => void load(), REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  return state;
}
