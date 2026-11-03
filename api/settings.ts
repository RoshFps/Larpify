// Stores each person's Larpify settings so their phone and computer stay in
// step. Identity comes from Spotify: the caller's access token is checked
// against Spotify's /me on each request and is never stored.
//
// Needs Upstash Redis connected in Vercel (Storage tab), which provides
// KV_REST_API_URL / KV_REST_API_TOKEN (or the UPSTASH_REDIS_* equivalents).

import { MAX_DOCUMENT_BYTES, parseSyncDocument } from '../src/sync/shape.js';
import { guarded, json, redis, spotifyUserId, storageConfigured } from './_shared.js';

async function handle(request: Request): Promise<Response> {
  if (!storageConfigured) return json({ error: 'Sync storage is not configured.' }, 501);

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

export const GET = guarded(handle);
export const PUT = guarded(handle);
