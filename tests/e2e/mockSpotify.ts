import type { BrowserContext } from '@playwright/test';

// A stand-in for Spotify: the Web API, the image CDN and the Web Playback SDK.
// Tests change `world.playback` to simulate what other devices are doing.

export const DEVICE_ID = 'tab-device';
const ACCESS_TOKEN = 'fake-access';

const cover = (seed: number) => [{ url: `https://i.scdn.co/image/${seed}`, width: 300, height: 300 }];

export const playlists = ['Late Night Drive', 'Gym Rotation', 'Lo-fi Focus', 'Throwbacks 2016', 'Rainy Day', 'Indie Mix'].map(
  (name, i) => ({
    id: `pl${i}`,
    uri: `spotify:playlist:pl${i}`,
    name,
    images: cover(i * 40),
    owner: { display_name: 'Roshan' },
  }),
);

export const artists = ['Frank Ocean', 'Fred again..', 'FKA twigs'].map((name, i) => ({
  id: `ar${i}`,
  uri: `spotify:artist:ar${i}`,
  name,
  images: cover(200 + i * 40),
}));

const extraArtists = ['Mitski', 'Tame Impala', 'SZA', 'Bon Iver', 'Phoebe Bridgers', 'Kendrick Lamar', 'Clairo', 'Steve Lacy', 'Bon Iver Live', 'Arca', 'Japanese Breakfast', 'Beach House', 'Rosalía'].map(
  (name, i) => ({ id: `ex${i}`, uri: `spotify:artist:ex${i}`, name, images: cover(100 + i * 25) }),
);

export const track = {
  id: 't1',
  uri: 'spotify:track:t1',
  name: 'Nights',
  duration_ms: 307_000,
  artists: [{ id: 'ar0', name: 'Frank Ocean' }],
  album: { name: 'Blonde', images: cover(20) },
};

export function playingOn(deviceId: string, deviceName: string, isPlaying = true) {
  return {
    is_playing: isPlaying,
    progress_ms: 1000,
    device: { id: deviceId, name: deviceName, type: 'Smartphone', volume_percent: 50 },
    item: track,
  };
}

export interface World {
  playback: ReturnType<typeof playingOn> | null;
  /** Simulates a session from before the Recap feature asked for top-items access. */
  topScopeMissing?: boolean;
  /** Simulates an account the owner hasn't added in the Spotify dashboard yet. */
  notAllowlisted?: boolean;
  lastPlayRequest: { context_uri?: string; uris?: string[] } | null;
  /** While set, every Web API call answers 429 with this Retry-After. */
  rateLimitSeconds?: number;
  /** Web API calls received, to check the app backs off. */
  requestCount?: number;
  /** How many times any tab asked Spotify to start playback. */
  playCount?: number;
}

const fakeSdk = (deviceId: string) => `
  window.Spotify = { Player: class {
    constructor(options) { this.options = options; this.listeners = {}; window.__player = this; }
    addListener(event, cb) { (this.listeners[event] ||= []).push(cb); return true; }
    emit(event, data) { (this.listeners[event] || []).forEach((cb) => cb(data)); }
    connect() {
      this.options.getOAuthToken(() => {});
      setTimeout(() => this.emit('ready', { device_id: '${deviceId}' }), 50);
      return Promise.resolve(true);
    }
    disconnect() {}
    activateElement() { return Promise.resolve(); }
    togglePlay() { return Promise.resolve(); }
    nextTrack() { return Promise.resolve(); }
    previousTrack() { return Promise.resolve(); }
    seek() { return Promise.resolve(); }
    setVolume() { return Promise.resolve(); }
    getCurrentState() { return Promise.resolve(null); }
  }};
  window.onSpotifyWebPlaybackSDKReady?.();
`;

/** `deviceId` lets several tabs on one account show up as separate players. */
export async function mockSpotify(context: BrowserContext, world: World, deviceId = DEVICE_ID): Promise<void> {
  await context.route('https://i.scdn.co/**', (route) => {
    const hue = Number(route.request().url().split('/').pop()) % 360;
    route.fulfill({
      contentType: 'image/svg+xml',
      body: `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect width="300" height="300" fill="hsl(${hue},55%,40%)"/></svg>`,
    });
  });

  await context.route('https://sdk.scdn.co/spotify-player.js', (route) =>
    route.fulfill({ contentType: 'application/javascript', body: fakeSdk(deviceId) }),
  );

  await context.route('https://accounts.spotify.com/api/token', (route) =>
    route.fulfill({ status: 400, contentType: 'application/json', body: '{"error":"invalid_grant"}' }),
  );

  await context.route('https://api.spotify.com/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const json = (body: unknown) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });

    if (request.headers().authorization !== `Bearer ${ACCESS_TOKEN}`) return route.fulfill({ status: 401 });
    world.requestCount = (world.requestCount ?? 0) + 1;
    if (world.rateLimitSeconds) {
      return route.fulfill({ status: 429, headers: { 'Retry-After': String(world.rateLimitSeconds) }, body: 'Too many requests' });
    }

    switch (url.pathname) {
      case '/v1/me':
        if (world.notAllowlisted) {
          return route.fulfill({ status: 403, contentType: 'application/json', body: '{"error":{"status":403,"message":"User not registered in the Developer Dashboard"}}' });
        }
        return json({ id: 'u1', display_name: 'Roshan', images: cover(300) });
      case '/v1/me/playlists':
        return json({ items: playlists, next: null, total: playlists.length });
      case '/v1/search': {
        if (url.searchParams.get('type') === 'artist') return json({ artists: { items: artists, next: null, total: 3 } });
        const offset = Number(url.searchParams.get('offset'));
        const items = Array.from({ length: 10 }, (_, i) => ({ ...track, id: `s${offset + i}`, uri: `spotify:track:s${offset + i}` }));
        return json({ tracks: { items, next: null, total: 30 } });
      }
      case '/v1/me/top/artists':
      case '/v1/me/top/tracks': {
        if (world.topScopeMissing) return route.fulfill({ status: 403, body: '{"error":{"message":"Insufficient client scope"}}' });
        const range = url.searchParams.get('time_range');
        const isArtists = url.pathname.endsWith('artists');
        // Frank Ocean leads long-term; FKA twigs leads lately, so the blend has something to weigh.
        const order = range === 'long_term' ? [0, 1, 2] : range === 'medium_term' ? [2, 0, 1] : [2, 1, 0];
        const ranked = isArtists ? [...artists, ...extraArtists] : [...artists, ...extraArtists].map((a, i) => ({ ...track, id: `top${i}`, uri: `spotify:track:top${i}`, name: `Song by ${a.name}`, artists: [{ id: a.id, name: a.name }] }));
        const head = order.map((i) => ranked[i]!);
        return json({ items: [...head, ...ranked.slice(3)], next: null, total: ranked.length });
      }
      case '/v1/me/player':
        return world.playback ? json(world.playback) : route.fulfill({ status: 204 });
      case '/v1/me/player/play':
        world.lastPlayRequest = request.postDataJSON();
        world.playCount = (world.playCount ?? 0) + 1;
        world.playback = playingOn(url.searchParams.get('device_id') ?? deviceId, 'Larpify (this tab)');
        return route.fulfill({ status: 204 });
      case '/v1/me/player/shuffle':
        return route.fulfill({ status: 204 });
      default:
        return route.fulfill({ status: 404 });
    }
  });
}

/** Stands in for /api/settings. Pass the same store to two contexts to act as two devices. */
export async function mockSyncServer(context: BrowserContext, store: { doc: unknown }): Promise<void> {
  await context.route('**/api/settings', async (route) => {
    const request = route.request();
    if (request.headers().authorization !== `Bearer ${ACCESS_TOKEN}`) return route.fulfill({ status: 401 });
    if (request.method() === 'GET') {
      return store.doc
        ? route.fulfill({ contentType: 'application/json', body: JSON.stringify(store.doc) })
        : route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
    }
    const incoming = request.postDataJSON() as { updatedAt: number };
    const current = store.doc as { updatedAt: number } | null;
    if (!current || incoming.updatedAt > current.updatedAt) store.doc = incoming;
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify(store.doc) });
  });
}

/** Signs the browser in with fake tokens, once per test (not again on reload). */
export async function signIn(context: BrowserContext, settings?: object, expiresInMs = 3_600_000): Promise<void> {
  await context.addInitScript(
    ([tokens, savedSettings]) => {
      if (sessionStorage.getItem('e2e.seeded')) return;
      sessionStorage.setItem('e2e.seeded', '1');
      localStorage.setItem('larpify.tokens', tokens);
      if (savedSettings) localStorage.setItem('larpify.settings', savedSettings);
    },
    [
      JSON.stringify({ accessToken: ACCESS_TOKEN, refreshToken: 'fake-refresh', expiresAt: Date.now() + expiresInMs }),
      settings ? JSON.stringify(settings) : null,
    ] as const,
  );
}

/** Stands in for Web3Forms, which emails access requests to the owner. */
export async function mockAccessForm(context: BrowserContext, sent: Record<string, string>[]): Promise<void> {
  await context.route('https://api.web3forms.com/submit', async (route) => {
    sent.push(route.request().postDataJSON() as Record<string, string>);
    await route.fulfill({ contentType: 'application/json', body: '{"success":true}' });
  });
}

export interface FriendsStore {
  /** Recaps by code, as a friend would have shared them. */
  byCode: Record<string, unknown>;
  mine: { code: string; recap: unknown } | null;
}

/** Stands in for /api/friends. */
export async function mockFriends(context: BrowserContext, store: FriendsStore): Promise<void> {
  await context.route('**/api/friends**', async (route) => {
    const request = route.request();
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (request.headers().authorization !== `Bearer ${ACCESS_TOKEN}`) return json({ error: 'no' }, 401);
    const code = new URL(request.url()).searchParams.get('code');
    if (request.method() === 'PUT') {
      store.mine = { code: 'MINE22', recap: request.postDataJSON() };
      return json({ code: 'MINE22' });
    }
    if (request.method() === 'DELETE') {
      store.mine = null;
      return json({ ok: true });
    }
    if (code === null) return json({ sharing: store.mine !== null, code: store.mine?.code ?? null });
    const found = store.byCode[code];
    return found ? json(found) : json({ error: 'No one is sharing with that code.' }, 404);
  });
}
