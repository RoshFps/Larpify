// Friends ask to be added to the Spotify app's user list (development mode
// only lets listed accounts in). Anyone may POST a request; only the owner,
// identified by Spotify user id in ADMIN_SPOTIFY_IDS, can list or clear them.

import { parseAccessRequest, type AccessRequest } from '../src/access/shape.js';
import { guarded, json, redis, spotifyUserId, storageConfigured } from './_shared.js';

const KEY = 'larpify:access-requests';
const MAX_PENDING = 200;
const MAX_PER_IP_PER_HOUR = 5;

const adminIds = (process.env.ADMIN_SPOTIFY_IDS ?? '')
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean);

async function isAdmin(request: Request): Promise<boolean> {
  const id = await spotifyUserId(request);
  return id !== null && adminIds.includes(id);
}

function clientIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

async function submit(request: Request): Promise<Response> {
  const raw = await request.text();
  if (raw.length > 2_000) return json({ error: 'Too large.' }, 413);
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: 'Please fill in the form.' }, 400);
  }

  // Hidden field people never see. Bots fill it; pretend it worked.
  if (typeof body === 'object' && body !== null && (body as Record<string, unknown>).website) {
    return json({ ok: true }, 202);
  }

  const parsed = parseAccessRequest(body, Date.now());
  if (typeof parsed === 'string') return json({ error: parsed }, 400);

  const rateKey = `larpify:rl:access:${clientIp(request)}`;
  const count = Number(await redis(['INCR', rateKey]));
  if (count === 1) await redis(['EXPIRE', rateKey, 3600]);
  if (count > MAX_PER_IP_PER_HOUR) return json({ error: 'Too many requests. Try again in an hour.' }, 429);

  const pending = Number(await redis(['HLEN', KEY]));
  if (pending >= MAX_PENDING) return json({ error: 'The waiting list is full right now.' }, 503);

  // Keyed by email, so asking twice just refreshes the request.
  await redis(['HSET', KEY, parsed.email, JSON.stringify(parsed)]);
  return json({ ok: true }, 202);
}

async function list(): Promise<Response> {
  const flat = (await redis(['HGETALL', KEY])) as string[] | null;
  const requests: AccessRequest[] = [];
  for (let i = 1; i < (flat?.length ?? 0); i += 2) {
    try {
      requests.push(JSON.parse(flat![i]!) as AccessRequest);
    } catch {
      // Skip anything unreadable rather than failing the whole list.
    }
  }
  requests.sort((a, b) => b.requestedAt - a.requestedAt);
  return json({ requests });
}

// Lets a logged-in person see why the owner page isn't showing. Reveals only
// their own Spotify id and whether the setup is complete, never anyone else's.
async function check(request: Request): Promise<Response> {
  const id = await spotifyUserId(request);
  if (id === null) return json({ error: 'Log in first.' }, 401);
  return json({ storage: storageConfigured, adminSet: adminIds.length > 0, yourId: id, isOwner: adminIds.includes(id) });
}

async function handle(request: Request): Promise<Response> {
  if (request.method === 'GET' && new URL(request.url).searchParams.has('check')) return check(request);
  if (!storageConfigured) return json({ error: 'Requests are not set up on this site.' }, 501);
  if (request.method === 'POST') return submit(request);

  if (!(await isAdmin(request))) return json({ error: 'Only the owner can see requests.' }, 403);
  if (request.method === 'GET') return list();

  const email = new URL(request.url).searchParams.get('email')?.toLowerCase();
  if (!email) return json({ error: 'Which request?' }, 400);
  await redis(['HDEL', KEY, email]);
  return json({ ok: true });
}

export const GET = guarded(handle);
export const POST = guarded(handle);
export const DELETE = guarded(handle);
