// Helpers shared by the API routes. Vercel doesn't expose files starting with
// an underscore as routes.

const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

export const storageConfigured = Boolean(REDIS_URL && REDIS_TOKEN);

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

export async function redis(command: (string | number)[]): Promise<unknown> {
  const res = await fetch(REDIS_URL!, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
    body: JSON.stringify(command),
  });
  if (!res.ok) throw new Error(`Storage error ${res.status}`);
  return ((await res.json()) as { result: unknown }).result;
}

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Long enough to cover a Spotify access token's 1 hour life without re-asking each sync. */
const IDENTITY_TTL_S = 50 * 60;

/**
 * Spotify user id for the request's bearer token, or null if Spotify doesn't accept it.
 * The answer is cached under a hash of the token (never the token itself), so
 * syncing doesn't spend the app's shared Spotify rate limit on repeated /me calls.
 */
export async function spotifyUserId(request: Request): Promise<string | null> {
  const auth = request.headers.get('authorization');
  if (!auth?.startsWith('Bearer ') || auth.length > 2048) return null;
  const cacheKey = storageConfigured ? `larpify:who:${await sha256(auth)}` : null;
  if (cacheKey) {
    const cached = await redis(['GET', cacheKey]);
    if (typeof cached === 'string' && cached) return cached;
  }
  const res = await fetch('https://api.spotify.com/v1/me', { headers: { Authorization: auth } });
  if (!res.ok) return null;
  const me = (await res.json()) as { id?: unknown };
  const id = typeof me.id === 'string' && me.id.length > 0 ? me.id : null;
  if (id && cacheKey) await redis(['SET', cacheKey, id, 'EX', IDENTITY_TTL_S]);
  return id;
}

/** Runs a handler, turning unexpected failures into a plain 503 without leaking details. */
export function guarded(handler: (request: Request) => Promise<Response>) {
  return async (request: Request): Promise<Response> => {
    try {
      return await handler(request);
    } catch {
      return json({ error: 'Temporarily unavailable.' }, 503);
    }
  };
}
