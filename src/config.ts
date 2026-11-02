export const SPOTIFY_CLIENT_ID: string = import.meta.env.VITE_SPOTIFY_CLIENT_ID ?? '';

export const REDIRECT_URI: string =
  import.meta.env.VITE_SPOTIFY_REDIRECT_URI || new URL(import.meta.env.BASE_URL, window.location.origin).href;

// Only what the app actually uses. `streaming` plus the two `user-read-*`
// profile scopes are required by the Web Playback SDK.
export const SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state',
  'playlist-read-private',
  'playlist-read-collaborative',
] as const;

export const POLL_INTERVAL_MS = 30_000;
export const MAX_ARTISTS = 5;
export const IDLE_MINUTE_OPTIONS = [1, 5, 10, 20, 30] as const;
