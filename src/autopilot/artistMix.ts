import type { Track } from '../api/types';

export const MAX_MIX_LENGTH = 100;

/** Fisher–Yates; `random` is injectable so tests are deterministic. */
export function shuffled<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

/**
 * Builds a play queue from per-artist search results. Search matches loosely,
 * so tracks that don't credit the artist are dropped. Artists are interleaved
 * so one prolific artist doesn't drown out the rest.
 */
export function buildArtistMix(
  tracksByArtist: ReadonlyMap<string, readonly Track[]>,
  random: () => number = Math.random,
): string[] {
  const seen = new Set<string>();
  const pools = [...tracksByArtist].map(([artistId, tracks]) =>
    shuffled(
      tracks.filter((track) => {
        if (track.is_playable === false || seen.has(track.uri)) return false;
        if (!track.artists.some((a) => a.id === artistId)) return false;
        seen.add(track.uri);
        return true;
      }),
      random,
    ),
  );

  const mix: string[] = [];
  for (let round = 0; mix.length < MAX_MIX_LENGTH; round++) {
    let added = false;
    for (const pool of pools) {
      const track = pool[round];
      if (track && mix.length < MAX_MIX_LENGTH) {
        mix.push(track.uri);
        added = true;
      }
    }
    if (!added) break;
  }
  return mix;
}
