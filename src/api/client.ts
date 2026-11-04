import { AuthError, getAccessToken, refresh } from '../auth/session';

const API_BASE = 'https://api.spotify.com/v1';
const COOLDOWN_KEY = 'larpify.spotifyCooldownUntil';
/** Short waits are retried in place; anything longer pauses every call until it's over. */
const MAX_INLINE_WAIT_S = 5;
const MIN_COOLDOWN_S = 30;
/** Spotify sometimes asks for hours; never lock the app out longer than this. */
const MAX_COOLDOWN_S = 30 * 60;

// Kept in memory too, for when storage is unavailable.
let memoryUntil = 0;

function cooldownUntil(): number {
  try {
    return Math.max(memoryUntil, Number(localStorage.getItem(COOLDOWN_KEY)) || 0);
  } catch {
    return memoryUntil;
  }
}

function startCooldown(seconds: number): void {
  const wait = Math.min(Math.max(seconds, MIN_COOLDOWN_S), MAX_COOLDOWN_S);
  memoryUntil = Date.now() + wait * 1000;
  try {
    localStorage.setItem(COOLDOWN_KEY, String(memoryUntil));
  } catch {
    // Private mode: the next call just tries again.
  }
}

/** Milliseconds left before Larpify talks to Spotify again (0 when it can). */
export function rateLimitRemainingMs(): number {
  return Math.max(0, cooldownUntil() - Date.now());
}

function rateLimitError(): SpotifyApiError {
  const minutes = Math.max(1, Math.ceil(rateLimitRemainingMs() / 60_000));
  return new SpotifyApiError(429, `Spotify asked Larpify to slow down. Trying again in about ${minutes} min.`);
}

export class SpotifyApiError extends Error {
  override name = 'SpotifyApiError';
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

type Method = 'GET' | 'PUT' | 'POST';

/**
 * Calls the Web API. Resolves to null for empty responses, which several
 * player endpoints return on success.
 */
export async function spotifyFetch<T>(path: string, method: Method = 'GET', body?: unknown): Promise<T | null> {
  let retriedAuth = false;
  for (let attempt = 0; ; attempt++) {
    // Calling during a cooldown only makes Spotify extend it.
    if (rateLimitRemainingMs() > 0) throw rateLimitError();
    const res = await fetch(API_BASE + path, {
      method,
      headers: {
        Authorization: `Bearer ${await getAccessToken()}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (res.status === 401 && !retriedAuth) {
      retriedAuth = true;
      await refresh();
      continue;
    }
    if (res.status === 429) {
      const waitSeconds = Number(res.headers.get('Retry-After')) || 2;
      if (attempt === 0 && waitSeconds <= MAX_INLINE_WAIT_S) {
        await new Promise((resolve) => setTimeout(resolve, waitSeconds * 1000));
        continue;
      }
      startCooldown(waitSeconds);
      throw rateLimitError();
    }
    if (res.status === 401) throw new AuthError('Spotify rejected the session. Please log in again.');
    if (!res.ok) throw new SpotifyApiError(res.status, await errorMessage(res));

    const text = await res.text();
    return text ? (JSON.parse(text) as T) : null;
  }
}

async function errorMessage(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: { message?: string } };
    if (data.error?.message) return data.error.message;
  } catch {
    // Body was not JSON.
  }
  return `Spotify request failed (${res.status}).`;
}
