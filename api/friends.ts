// Share your predicted Recap with friends, and look up a friend's by code.
//
// Opt-in: nothing is stored until someone turns sharing on. Only names and
// ranks are kept (see src/friends/shape.ts), keyed by Spotify user id. Looking
// someone up needs a code they gave you AND a valid Spotify login of your own,
// and lookups are rate limited so codes can't be guessed.
//
// Needs the same Upstash Redis store as sync.

import { MAX_SHARE_BYTES, makeCode, normaliseCode, parseSharedRecap } from '../src/friends/shape.js';
import { guarded, json, redis, spotifyUserId, storageConfigured } from './_shared.js';

const MAX_LOOKUPS_PER_HOUR = 30;
const recapKey = (id: string) => `larpify:recap:${id}`;
const codeOfKey = (id: string) => `larpify:recap-code:${id}`;
const ownerOfKey = (code: string) => `larpify:recap-owner:${code}`;

/** A stable code per person, created the first time they share. */
async function codeFor(userId: string): Promise<string> {
  const existing = await redis(['GET', codeOfKey(userId)]);
  if (typeof existing === 'string') return existing;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = makeCode(() => crypto.getRandomValues(new Uint32Array(1))[0]! / 2 ** 32);
    // NX: never take a code someone else already holds.
    if ((await redis(['SET', ownerOfKey(code), userId, 'NX'])) === 'OK') {
      await redis(['SET', codeOfKey(userId), code]);
      return code;
    }
  }
  throw new Error('Could not make a code.');
}

async function handle(request: Request): Promise<Response> {
  if (!storageConfigured) return json({ error: 'Sharing is not set up on this site.' }, 501);
  const userId = await spotifyUserId(request);
  if (!userId) return json({ error: 'Not signed in to Spotify.' }, 401);

  const url = new URL(request.url);

  if (request.method === 'GET') {
    const lookup = url.searchParams.get('code');
    if (lookup === null) {
      const code = await redis(['GET', codeOfKey(userId)]);
      const sharing = typeof code === 'string' && (await redis(['GET', recapKey(userId)])) !== null;
      return json({ sharing, code: sharing ? code : null });
    }

    const code = normaliseCode(lookup);
    if (!code) return json({ error: 'That code doesn’t look right.' }, 400);

    const rateKey = `larpify:rl:recap:${userId}`;
    const count = Number(await redis(['INCR', rateKey]));
    if (count === 1) await redis(['EXPIRE', rateKey, 3600]);
    if (count > MAX_LOOKUPS_PER_HOUR) return json({ error: 'Too many tries. Wait a bit and try again.' }, 429);

    const owner = await redis(['GET', ownerOfKey(code)]);
    const stored = typeof owner === 'string' ? await redis(['GET', recapKey(owner)]) : null;
    // Same answer whether the code never existed or the friend stopped sharing.
    if (typeof stored !== 'string') return json({ error: 'No one is sharing with that code.' }, 404);
    const recap = parseSharedRecap(JSON.parse(stored), Date.now());
    return recap ? json(recap) : json({ error: 'No one is sharing with that code.' }, 404);
  }

  if (request.method === 'PUT') {
    const raw = await request.text();
    if (raw.length > MAX_SHARE_BYTES) return json({ error: 'Too large.' }, 413);
    let recap;
    try {
      recap = parseSharedRecap(JSON.parse(raw), Date.now());
    } catch {
      recap = null;
    }
    if (!recap) return json({ error: 'Invalid Recap.' }, 400);
    await redis(['SET', recapKey(userId), JSON.stringify(recap)]);
    return json({ code: await codeFor(userId) });
  }

  // DELETE: stop sharing. The code is kept so turning it back on gives friends the same one.
  await redis(['DEL', recapKey(userId)]);
  return json({ ok: true });
}

export const GET = guarded(handle);
export const PUT = guarded(handle);
export const DELETE = guarded(handle);
