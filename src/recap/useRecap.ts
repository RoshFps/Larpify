import { useEffect, useState } from 'react';
import { SpotifyApiError } from '../api/client';
import { getTopArtists, getTopTracks, type TimeRange } from '../api/spotify';
import type { Artist, Track } from '../api/types';
import { blendRankings, RANGE_WEIGHTS, type Prediction } from './predict';
import { dayKey, loadSnapshots, previousSnapshot, saveSnapshots, withSnapshot } from './snapshots';

/** Spotify updates top lists roughly daily; refreshing more often than this is wasted calls. */
const REFRESH_MS = 10 * 60_000;

/** Oldest first, matching the order of each prediction's `parts`. */
export const RANGES: readonly TimeRange[] = ['long_term', 'medium_term', 'short_term'];

export interface Recap {
  artists: Prediction<Artist>[];
  tracks: Prediction<Track>[];
  /** Yesterday's (or the last earlier day's) order, for movement arrows. */
  previous: { artists: string[]; tracks: string[] } | null;
  updatedAt: number;
}

export type RecapState =
  | { status: 'loading' }
  | { status: 'needs-permission' }
  | { status: 'error'; message: string }
  | { status: 'ready'; recap: Recap };

async function fetchRecap(): Promise<RecapState> {
  try {
    const [artistLists, trackLists] = await Promise.all([
      Promise.all(RANGES.map(getTopArtists)),
      Promise.all(RANGES.map(getTopTracks)),
    ]);
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
    return { status: 'ready', recap: { artists, tracks, previous, updatedAt: now } };
  } catch (err) {
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
