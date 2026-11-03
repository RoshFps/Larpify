import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const doc = (updatedAt: number, enabled = true) => ({
  updatedAt,
  settings: {
    enabled,
    idleMinutes: 10,
    source: 'playlist',
    playlist: { id: 'p', uri: 'spotify:playlist:p', name: 'Mix', imageUrl: null },
    artists: [],
    quietHours: { enabled: true, start: 2, end: 8 },
  },
});

/** Fakes Spotify's /me and the Upstash REST API. */
function fakeBackends(store: Map<string, string>) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    if (url === 'https://api.spotify.com/v1/me') {
      const auth = new Headers(init?.headers).get('authorization');
      return auth === 'Bearer good-token'
        ? Response.json({ id: 'roshan' })
        : new Response('{}', { status: 401 });
    }
    const [command, key, value] = JSON.parse(String(init?.body)) as string[];
    if (command === 'GET') return Response.json({ result: store.get(key!) ?? null });
    store.set(key!, value!);
    return Response.json({ result: 'OK' });
  });
}

const request = (method: string, body?: unknown, token = 'good-token') =>
  new Request('https://larpify.test/api/settings', {
    method,
    headers: { Authorization: `Bearer ${token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

describe('/api/settings', () => {
  let store: Map<string, string>;

  beforeEach(() => {
    vi.resetModules();
    store = new Map();
    vi.stubGlobal('fetch', fakeBackends(store));
    vi.stubEnv('KV_REST_API_URL', 'https://redis.test');
    vi.stubEnv('KV_REST_API_TOKEN', 'redis-token');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('saves and returns settings for the Spotify account', async () => {
    const api = await import('../../api/settings');
    expect((await api.GET(request('GET'))).status).toBe(404);

    const put = await api.PUT(request('PUT', doc(100)));
    expect(put.status).toBe(200);
    expect(store.has('larpify:settings:roshan')).toBe(true);

    const get = await api.GET(request('GET'));
    expect(await get.json()).toEqual(doc(100));
  });

  it('keeps the newer edit when an older one arrives late', async () => {
    const api = await import('../../api/settings');
    await api.PUT(request('PUT', doc(200, true)));
    const stale = await api.PUT(request('PUT', doc(100, false)));
    expect((await stale.json()).updatedAt).toBe(200);
    expect(JSON.parse(store.get('larpify:settings:roshan')!).settings.enabled).toBe(true);
  });

  it('rejects callers Spotify does not recognise', async () => {
    const api = await import('../../api/settings');
    expect((await api.GET(request('GET', undefined, 'stolen'))).status).toBe(401);
    expect((await api.PUT(request('PUT', doc(1), 'stolen'))).status).toBe(401);
    expect(store.size).toBe(0);
  });

  it('rejects invalid or oversized documents', async () => {
    const api = await import('../../api/settings');
    expect((await api.PUT(request('PUT', { hello: 'world' }))).status).toBe(400);
    const huge = doc(1) as Record<string, unknown>;
    huge.padding = 'x'.repeat(10_000);
    expect((await api.PUT(request('PUT', huge))).status).toBe(413);
  });

  it('says so when storage is not connected', async () => {
    vi.stubEnv('KV_REST_API_URL', '');
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
    const api = await import('../../api/settings');
    expect((await api.GET(request('GET'))).status).toBe(501);
  });
});
