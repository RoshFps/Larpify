// Stores each person's Larpify settings so their phone and computer stay in
// step. Identity comes from Spotify: the caller's access token is checked
// against Spotify's /me on each request and is never stored.
//
// Needs Upstash Redis connected in Vercel (Storage tab), which provides
// KV_REST_API_URL / KV_REST_API_TOKEN (or the UPSTASH_REDIS_* equivalents).

import { MAX_DOCUMENT_BYTES, parseSyncDocument } from '../src/sync/shape.js';

const REDIS_URL = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

async function redis(command: (string | number)[]): Promise<unknown> {
  const res = await fetch(REDIS_URL!, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
    body: JSON.stringify(command),
  });
  if (!res.ok) throw new Error(`Storage error ${res.status}`);
  return ((await res.json()) as { result: unknown }).result;
}

/** Spotify user id for the bearer token, or null if Spotify doesn't accept it. */
async function spotifyUserId(request: Request): Promise<string | null> {
  const auth = request.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const res = await fetch('https://api.spotify.com/v1/me', { headers: { Authorization: auth } });
  if (!res.ok) return null;
  const me = (await res.json()) as { id?: unknown };
  return typeof me.id === 'string' && me.id.length > 0 ? me.id : null;
}

async function handle(request: Request): Promise<Response> {
  if (!REDIS_URL || !REDIS_TOKEN) return json({ error: 'Sync storage is not configured.' }, 501);

  const userId = await spotifyUserId(request);
  if (!userId) return json({ error: 'Not signed in to Spotify.' }, 401);
  const key = `larpify:settings:${userId}`;

  if (request.method === 'GET') {
    const stored = await redis(['GET', key]);
    if (typeof stored !== 'string') return json({ error: 'Nothing saved yet.' }, 404);
    const doc = parseSyncDocument(JSON.parse(stored));
    return doc ? json(doc) : json({ error: 'Nothing saved yet.' }, 404);
  }

  const raw = await request.text();
  if (raw.length > MAX_DOCUMENT_BYTES) return json({ error: 'Too large.' }, 413);
  let incoming;
  try {
    incoming = parseSyncDocument(JSON.parse(raw));
  } catch {
    incoming = null;
  }
  if (!incoming) return json({ error: 'Invalid settings.' }, 400);

  // Last edit wins: a slow request from an older edit can't overwrite a newer one.
  const stored = await redis(['GET', key]);
  const current = typeof stored === 'string' ? parseSyncDocument(JSON.parse(stored)) : null;
  if (current && current.updatedAt >= incoming.updatedAt) return json(current);

  await redis(['SET', key, JSON.stringify(incoming)]);
  return json(incoming);
}

async function safely(request: Request): Promise<Response> {
  try {
    return await handle(request);
  } catch {
    return json({ error: 'Sync is temporarily unavailable.' }, 503);
  }
}

export const GET = safely;
export const PUT = safely;
