import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBackends } from './fakeBackends';

const URL_BASE = 'https://larpify.test/api/access-requests';
const KEY = 'larpify:access-requests';

const post = (body: unknown, ip = '1.2.3.4') =>
  new Request(URL_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  });

const asUser = (method: string, token: string, query = '') =>
  new Request(URL_BASE + query, { method, headers: { Authorization: `Bearer ${token}` } });

describe('/api/access-requests', () => {
  let store: Map<string, unknown>;
  const pending = () => (store.get(KEY) as Map<string, string> | undefined) ?? new Map();

  beforeEach(() => {
    vi.resetModules();
    store = new Map();
    vi.stubGlobal('fetch', fakeBackends(store));
    vi.stubEnv('KV_REST_API_URL', 'https://redis.test');
    vi.stubEnv('KV_REST_API_TOKEN', 'redis-token');
    vi.stubEnv('ADMIN_SPOTIFY_IDS', 'roshan');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('accepts a request from anyone, keyed by lower-cased email', async () => {
    const api = await import('../../api/access-requests');
    const res = await api.POST(post({ name: ' Sam ', email: 'Sam@Example.com ' }));
    expect(res.status).toBe(202);
    expect(JSON.parse(pending().get('sam@example.com')!)).toMatchObject({ name: 'Sam', email: 'sam@example.com' });
  });

  it('asking twice keeps one entry', async () => {
    const api = await import('../../api/access-requests');
    await api.POST(post({ name: 'Sam', email: 'sam@example.com' }));
    await api.POST(post({ name: 'Sam again', email: 'SAM@example.com' }));
    expect(pending().size).toBe(1);
  });

  it('rejects bad input with a message the form can show', async () => {
    const api = await import('../../api/access-requests');
    for (const body of [{ name: '', email: 'a@b.co' }, { name: 'A', email: 'not-an-email' }, { name: 'x'.repeat(61), email: 'a@b.co' }]) {
      const res = await api.POST(post(body));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBeTruthy();
    }
    expect(pending().size).toBe(0);
  });

  it('quietly drops bot submissions that fill the hidden field', async () => {
    const api = await import('../../api/access-requests');
    const res = await api.POST(post({ name: 'Bot', email: 'bot@spam.test', website: 'http://spam.test' }));
    expect(res.status).toBe(202);
    expect(pending().size).toBe(0);
  });

  it('limits each address to 5 requests an hour', async () => {
    const api = await import('../../api/access-requests');
    for (let i = 0; i < 5; i++) expect((await api.POST(post({ name: 'S', email: `s${i}@x.co` }))).status).toBe(202);
    expect((await api.POST(post({ name: 'S', email: 's6@x.co' }))).status).toBe(429);
    expect((await api.POST(post({ name: 'S', email: 's7@x.co' }, '5.6.7.8'))).status).toBe(202);
  });

  it('only the owner can list or clear requests', async () => {
    const api = await import('../../api/access-requests');
    await api.POST(post({ name: 'Sam', email: 'sam@example.com' }));

    expect((await api.GET(new Request(URL_BASE))).status).toBe(403);
    expect((await api.GET(asUser('GET', 'friend-token'))).status).toBe(403);
    expect((await api.DELETE(asUser('DELETE', 'friend-token', '?email=sam@example.com'))).status).toBe(403);
    expect(pending().size).toBe(1);

    const list = await api.GET(asUser('GET', 'good-token'));
    expect((await list.json()).requests).toEqual([expect.objectContaining({ email: 'sam@example.com' })]);

    expect((await api.DELETE(asUser('DELETE', 'good-token', '?email=sam@example.com'))).status).toBe(200);
    expect(pending().size).toBe(0);
  });

  it('nobody is the owner when ADMIN_SPOTIFY_IDS is unset', async () => {
    vi.stubEnv('ADMIN_SPOTIFY_IDS', '');
    const api = await import('../../api/access-requests');
    expect((await api.GET(asUser('GET', 'good-token'))).status).toBe(403);
  });

  it('rejects oversized bodies', async () => {
    const api = await import('../../api/access-requests');
    expect((await api.POST(post({ name: 'S', email: 'a@b.co', pad: 'x'.repeat(3000) }))).status).toBe(413);
  });

  it('setup check tells a logged-in person only their own id and what is missing', async () => {
    const api = await import('../../api/access-requests');
    const friend = new Request('https://x/api/access-requests?check=1', { headers: { authorization: 'Bearer friend-token' } });
    const body = await (await api.GET(friend)).json();
    expect(body).toEqual({ storage: true, adminSet: true, yourId: 'friend', isOwner: false });
    const anon = new Request('https://x/api/access-requests?check=1');
    expect((await api.GET(anon)).status).toBe(401);
  });
});
