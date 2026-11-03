import { vi } from 'vitest';

/**
 * Fakes Spotify's /me (token "good-token" is user "roshan", "friend-token" is
 * user "friend") and the subset of the Upstash REST API the routes use.
 */
export function fakeBackends(redis: Map<string, unknown>) {
  const users: Record<string, string> = { 'Bearer good-token': 'roshan', 'Bearer friend-token': 'friend' };
  const hash = (key: string) => {
    if (!redis.has(key)) redis.set(key, new Map<string, string>());
    return redis.get(key) as Map<string, string>;
  };

  return vi.fn(async (url: string, init?: RequestInit) => {
    if (url === 'https://api.spotify.com/v1/me') {
      const id = users[new Headers(init?.headers).get('authorization') ?? ''];
      return id ? Response.json({ id }) : new Response('{}', { status: 401 });
    }
    const [command, key, ...args] = JSON.parse(String(init?.body)) as string[];
    const result = (() => {
      switch (command) {
        case 'GET':
          return redis.get(key!) ?? null;
        case 'SET':
          redis.set(key!, args[0]);
          return 'OK';
        case 'INCR': {
          const next = Number(redis.get(key!) ?? 0) + 1;
          redis.set(key!, next);
          return next;
        }
        case 'EXPIRE':
          return 1;
        case 'HLEN':
          return hash(key!).size;
        case 'HSET':
          hash(key!).set(args[0]!, args[1]!);
          return 1;
        case 'HGETALL':
          return [...hash(key!)].flat();
        case 'HDEL':
          return hash(key!).delete(args[0]!) ? 1 : 0;
        default:
          throw new Error(`Unexpected command ${command}`);
      }
    })();
    return Response.json({ result });
  });
}
