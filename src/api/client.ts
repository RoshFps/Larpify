import { AuthError, getAccessToken, refresh } from '../auth/session';

const API_BASE = 'https://api.spotify.com/v1';
const MAX_RATE_LIMIT_RETRIES = 2;

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
    if (res.status === 429 && attempt < MAX_RATE_LIMIT_RETRIES) {
      const waitSeconds = Number(res.headers.get('Retry-After')) || 2;
      await new Promise((resolve) => setTimeout(resolve, Math.min(waitSeconds, 30) * 1000));
      continue;
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
