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

/** Spotify user id for the request's bearer token, or null if Spotify doesn't accept it. */
export async function spotifyUserId(request: Request): Promise<string | null> {
  const auth = request.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const res = await fetch('https://api.spotify.com/v1/me', { headers: { Authorization: auth } });
  if (!res.ok) return null;
  const me = (await res.json()) as { id?: unknown };
  return typeof me.id === 'string' && me.id.length > 0 ? me.id : null;
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
