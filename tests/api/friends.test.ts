import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBackends } from './fakeBackends';

const recap = {
  displayName: 'Roshan',
  artists: [{ id: 'a1', name: 'SZA' }],
  tracks: [{ id: 't1', name: 'Snooze' }],
  updatedAt: 1,
};

const as = (token: string | null, method = 'GET', body?: unknown, query = '') =>
  new Request(`https://x/api/friends${query}`, {
    method,
    headers: token ? { authorization: `Bearer ${token}` } : {},
    body: body === undefined ? undefined : JSON.stringify(body),
  });

describe('/api/friends', () => {
  let store: Map<string, unknown>;

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

  it('is off until storage is connected', async () => {
    vi.stubEnv('KV_REST_API_URL', '');
    const api = await import('../../api/friends');
    expect((await api.GET(as('good-token'))).status).toBe(501);
  });

  it('needs a Spotify login for everything', async () => {
    const api = await import('../../api/friends');
    expect((await api.GET(as(null))).status).toBe(401);
    expect((await api.PUT(as('bad-token', 'PUT', recap))).status).toBe(401);
    expect((await api.GET(as(null, 'GET', undefined, '?code=ABCDEF'))).status).toBe(401);
  });

  it('shares nothing until you opt in', async () => {
    const api = await import('../../api/friends');
    expect(await (await api.GET(as('good-token'))).json()).toEqual({ sharing: false, code: null });
  });

  it('gives you a stable code and lets a friend look you up with it', async () => {
    const api = await import('../../api/friends');
    const first = await (await api.PUT(as('good-token', 'PUT', recap))).json();
    expect(first.code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    const again = await (await api.PUT(as('good-token', 'PUT', { ...recap, updatedAt: 2 }))).json();
    expect(again.code).toBe(first.code);

    const found = await api.GET(as('friend-token', 'GET', undefined, `?code=${first.code.toLowerCase()}`));
    expect(found.status).toBe(200);
    expect(await found.json()).toMatchObject({ displayName: 'Roshan', artists: [{ id: 'a1', name: 'SZA' }] });
  });

  it('stores only names and ranks, even if more is sent', async () => {
    const api = await import('../../api/friends');
    await api.PUT(as('good-token', 'PUT', { ...recap, email: 'x@y.co', token: 'secret-token' }));
    expect(JSON.stringify([...store.values()])).not.toContain('secret-token');
    expect(JSON.stringify([...store.values()])).not.toContain('x@y.co');
  });

  it('rejects bad input and oversized bodies', async () => {
    const api = await import('../../api/friends');
    expect((await api.PUT(as('good-token', 'PUT', { ...recap, artists: 'no' }))).status).toBe(400);
    expect((await api.PUT(as('good-token', 'PUT', { ...recap, pad: 'x'.repeat(5000) }))).status).toBe(413);
  });

  it('answers the same for a wrong code and for someone who stopped sharing', async () => {
    const api = await import('../../api/friends');
    const { code } = await (await api.PUT(as('good-token', 'PUT', recap))).json();
    await api.DELETE(as('good-token', 'DELETE'));
    const stopped = await api.GET(as('friend-token', 'GET', undefined, `?code=${code}`));
    const wrong = await api.GET(as('friend-token', 'GET', undefined, '?code=ZZZZZZ'));
    expect([stopped.status, wrong.status]).toEqual([404, 404]);
    expect(await stopped.json()).toEqual(await wrong.json());
    expect((await api.GET(as('friend-token', 'GET', undefined, '?code=abc'))).status).toBe(400);
  });

  it('turning sharing back on keeps the same code', async () => {
    const api = await import('../../api/friends');
    const { code } = await (await api.PUT(as('good-token', 'PUT', recap))).json();
    await api.DELETE(as('good-token', 'DELETE'));
    expect(await (await api.GET(as('good-token'))).json()).toEqual({ sharing: false, code: null });
    expect((await (await api.PUT(as('good-token', 'PUT', recap))).json()).code).toBe(code);
  });

  it('limits code guessing to 30 tries an hour', async () => {
    const api = await import('../../api/friends');
    let last = 0;
    for (let i = 0; i < 31; i++) last = (await api.GET(as('friend-token', 'GET', undefined, '?code=ZZZZZZ'))).status;
    expect(last).toBe(429);
  });
});
