import { spotifyFetch } from './client';
import type { Artist, Paging, PlaybackState, Playlist, Track, UserProfile } from './types';

const MAX_PLAYLISTS = 200;

export function getMe(): Promise<UserProfile | null> {
  return spotifyFetch<UserProfile>('/me');
}

export async function getMyPlaylists(): Promise<Playlist[]> {
  const playlists: Playlist[] = [];
  let offset = 0;
  while (playlists.length < MAX_PLAYLISTS) {
    const page = await spotifyFetch<Paging<Playlist | null>>(`/me/playlists?limit=50&offset=${offset}`);
    if (!page) break;
    // Spotify occasionally returns null entries for playlists that were removed.
    playlists.push(...page.items.filter((p): p is Playlist => p !== null));
    if (!page.next) break;
    offset += page.items.length;
  }
  return playlists;
}

export async function searchArtists(query: string): Promise<Artist[]> {
  const params = new URLSearchParams({ q: query, type: 'artist', limit: '10' });
  const data = await spotifyFetch<{ artists: Paging<Artist> }>(`/search?${params}`);
  return data?.artists.items ?? [];
}

export async function searchTracksByArtist(artistName: string, offset: number): Promise<Track[]> {
  const params = new URLSearchParams({
    q: `artist:"${artistName.replace(/"/g, '')}"`,
    type: 'track',
    limit: '10',
    offset: String(offset),
  });
  const data = await spotifyFetch<{ tracks: Paging<Track> }>(`/search?${params}`);
  return data?.tracks.items ?? [];
}

export function getPlaybackState(): Promise<PlaybackState | null> {
  return spotifyFetch<PlaybackState>('/me/player');
}

export type PlayRequest = { context_uri: string } | { uris: string[] };

export async function playOnDevice(deviceId: string, request: PlayRequest): Promise<void> {
  const device = encodeURIComponent(deviceId);
  await spotifyFetch(`/me/player/play?device_id=${device}`, 'PUT', request);
  // Shuffle after starting: a device that has never played rejects it.
  // It's a nice-to-have, so a failure here shouldn't fail the whole start.
  await spotifyFetch(`/me/player/shuffle?state=true&device_id=${device}`, 'PUT').catch(() => undefined);
}

export async function pauseDevice(deviceId: string): Promise<void> {
  await spotifyFetch(`/me/player/pause?device_id=${encodeURIComponent(deviceId)}`, 'PUT');
}
