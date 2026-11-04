import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../auth/session', () => ({
  AuthError: class AuthError extends Error {},
  getAccessToken: () => Promise.resolve('token'),
  refresh: () => Promise.resolve(),
}));

describe('spotifyFetch rate limiting', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers({ toFake: ['Date'] });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('stops calling Spotify during a long Retry-After, then resumes', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response('', { status: 429, headers: { 'Retry-After': '120' } }));
    vi.stubGlobal('fetch', fetchMock);
    const { spotifyFetch, rateLimitRemainingMs } = await import('./client');

    await expect(spotifyFetch('/me')).rejects.toMatchObject({ status: 429 });
    expect(rateLimitRemainingMs()).toBe(120_000);

    // Further calls fail fast without touching the network.
    await expect(spotifyFetch('/me/player')).rejects.toMatchObject({ status: 429 });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.setSystemTime(Date.now() + 121_000);
    fetchMock.mockResolvedValueOnce(new Response('{"id":"u1"}', { status: 200 }));
    await expect(spotifyFetch('/me')).resolves.toEqual({ id: 'u1' });
  });

  it('caps a huge Retry-After at 30 minutes', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 429, headers: { 'Retry-After': '86400' } })));
    const { spotifyFetch, rateLimitRemainingMs } = await import('./client');
    await expect(spotifyFetch('/me/top/artists')).rejects.toMatchObject({ status: 429 });
    expect(rateLimitRemainingMs()).toBe(30 * 60_000);
  });
});
