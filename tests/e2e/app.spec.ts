import { expect, test, type Page } from '@playwright/test';
import { DEVICE_ID, mockSpotify, mockSyncServer, playingOn, signIn, type World } from './mockSpotify';

const playlistSettings = {
  enabled: true,
  idleMinutes: 1,
  source: 'playlist',
  playlist: { id: 'pl0', uri: 'spotify:playlist:pl0', name: 'Late Night Drive', imageUrl: null },
  artists: [],
  volume: 0.6,
  // Off by default in tests so results don't depend on what time CI runs.
  quietHours: { enabled: false, start: 2, end: 8 },
};

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => {
    // The mocked token endpoint answers 400 on purpose; everything else is a bug,
    // including Content-Security-Policy violations.
    if (msg.type() === 'error' && !msg.text().includes('400')) errors.push(msg.text());
  });
  return errors;
}

test('login sends the user to Spotify with PKCE and no client secret', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/');
  const button = page.getByRole('button', { name: 'Log in with Spotify' });
  await expect(button).toBeVisible();

  await page.route('https://accounts.spotify.com/authorize**', (route) => route.fulfill({ body: 'ok' }));
  const [request] = await Promise.all([
    page.waitForRequest((r) => r.url().startsWith('https://accounts.spotify.com/authorize')),
    button.click(),
  ]);
  const params = new URL(request.url()).searchParams;
  expect(params.get('response_type')).toBe('code');
  expect(params.get('code_challenge_method')).toBe('S256');
  expect(params.get('code_challenge')).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(params.get('state')).toBeTruthy();
  expect(params.get('show_dialog')).toBe('true');
  expect(params.has('client_secret')).toBe(false);
  expect(errors).toEqual([]);
});

test('autopilot waits while you listen, takes over when idle, and backs off', async ({ page, context }) => {
  const errors = collectErrors(page);
  const world: World = { playback: playingOn('phone', "Roshan's iPhone"), lastPlayRequest: null };
  await mockSpotify(context, world);
  await signIn(context, playlistSettings);
  await page.clock.install();
  await page.goto('/');

  await expect(page.getByText('You’re listening')).toBeVisible();

  world.playback = playingOn('phone', "Roshan's iPhone", false);
  await page.clock.fastForward(31_000);
  await expect(page.getByText('Watching', { exact: true })).toBeVisible();

  await page.clock.fastForward(61_000);
  await expect(page.getByText('Playing on this tab')).toBeVisible();
  await expect.poll(() => world.lastPlayRequest).toEqual({ context_uri: 'spotify:playlist:pl0' });

  // You pick your phone back up: the tab's player goes quiet and autopilot steps aside.
  world.playback = playingOn('phone', "Roshan's iPhone");
  await page.evaluate(() => (window as unknown as { __player: { emit(e: string, d: null): void } }).__player.emit('player_state_changed', null));
  await page.clock.fastForward(31_000);
  await expect(page.getByText('You’re listening')).toBeVisible();
  expect(errors).toEqual([]);
});

test('artist mode only queues tracks by the picked artists', async ({ page, context }) => {
  const world: World = { playback: null, lastPlayRequest: null };
  await mockSpotify(context, world);
  await signIn(context, playlistSettings);
  await page.goto('/');

  const nav = page.getByRole('navigation', { name: 'Main' }).locator('visible=true');
  await nav.getByRole('button', { name: 'Artists' }).click();
  await page.getByPlaceholder('What artists do you want?').fill('f');
  await page.getByRole('button', { name: /Frank Ocean/ }).click();
  await page.getByRole('button', { name: /FKA twigs/ }).click();
  await expect(page.getByRole('list', { name: 'Selected artists' }).getByRole('listitem')).toHaveCount(2);

  await nav.getByRole('button', { name: 'Home' }).click();
  await page.getByRole('button', { name: 'Start now' }).click();
  await expect.poll(() => world.lastPlayRequest?.uris?.length).toBe(30);
  // The mock credits every search result to Frank Ocean only, so FKA twigs
  // contributes nothing and every queued track must be his.
  expect(world.lastPlayRequest?.uris?.every((uri) => uri.startsWith('spotify:track:s'))).toBe(true);
});

test('a revoked session clears tokens and returns to login', async ({ page, context }) => {
  await mockSpotify(context, { playback: null, lastPlayRequest: null });
  await signIn(context, undefined, -1);
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Log in with Spotify' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('larpify.tokens'))).toBeNull();
});

test('logging out leaves nothing behind for the next person', async ({ page, context }) => {
  await mockSpotify(context, { playback: null, lastPlayRequest: null });
  await signIn(context, playlistSettings);
  await page.goto('/');
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page.getByRole('button', { name: 'Log in with Spotify' })).toBeVisible();
  const leftovers = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('larpify.')));
  expect(leftovers).toEqual([]);
});

test('layout fits the screen without sideways scrolling', async ({ page, context }) => {
  await mockSpotify(context, { playback: playingOn(DEVICE_ID, 'Larpify (this tab)'), lastPlayRequest: null });
  await signIn(context, playlistSettings);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Roshan');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});

test('quiet hours keep autopilot from starting overnight', async ({ page, context }) => {
  const world: World = { playback: null, lastPlayRequest: null };
  await mockSpotify(context, world);
  // The fake clock jumps to 3 AM, so the fake session must outlive that jump.
  await signIn(context, { ...playlistSettings, quietHours: { enabled: true, start: 2, end: 8 } }, 7 * 24 * 3_600_000);
  await page.clock.install({ time: new Date(2026, 10, 3, 3, 0) });
  await page.goto('/');

  await expect(page.getByText('Quiet hours', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Autopilot rests until 8 AM.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start now' })).toHaveCount(0);

  // Well past the 1-minute idle time, still inside quiet hours: nothing plays.
  await page.clock.fastForward(5 * 60_000);
  expect(world.lastPlayRequest).toBeNull();
});

test('recap predicts a top 5 and can target an artist with autopilot', async ({ page, context }) => {
  const errors = collectErrors(page);
  await mockSpotify(context, { playback: null, lastPlayRequest: null });
  await signIn(context, playlistSettings);
  await page.goto('/');

  const nav = page.getByRole('navigation', { name: 'Main' }).locator('visible=true');
  await nav.getByRole('button', { name: 'Recap' }).click();

  const artists = page.getByRole('region', { name: 'Top artists' }).getByRole('listitem');
  await expect(artists).toHaveCount(5);
  // FKA twigs leads the 6-month and 4-week lists, which outweigh Frank Ocean's 12-month lead.
  await expect(artists.first()).toContainText('FKA twigs');
  await expect(page.getByRole('region', { name: 'Top songs' }).getByRole('listitem')).toHaveCount(5);

  // The chart explains a ranking on hover/focus.
  await page.getByRole('button', { name: /^#1 FKA twigs/ }).focus();
  await expect(page.getByRole('tooltip')).toContainText('6 months: #1');

  await page.getByRole('radio', { name: /Bon Iver/ }).click();
  await expect(page.getByText(/Bon Iver.*is predicted at/)).toBeVisible();
  await page.getByRole('button', { name: 'Play only Bon Iver on autopilot' }).click();

  await expect(page.getByText('Only their songs will play')).toBeVisible();
  const settings = await page.evaluate(() => JSON.parse(localStorage.getItem('larpify.settings')!));
  expect(settings.source).toBe('artists');
  expect(settings.artists.map((a: { name: string }) => a.name)).toEqual(['Bon Iver']);
  expect(errors).toEqual([]);
});

test('recap asks for the extra permission on older sessions', async ({ page, context }) => {
  await mockSpotify(context, { playback: null, lastPlayRequest: null, topScopeMissing: true });
  await signIn(context, playlistSettings);
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Main' }).locator('visible=true').getByRole('button', { name: 'Recap' }).click();
  await expect(page.getByRole('button', { name: 'Allow access' })).toBeVisible();
});

test('settings changed on one device show up on the other', async ({ browser }) => {
  const world: World = { playback: null, lastPlayRequest: null };
  const server = { doc: null as unknown };

  const openDevice = async () => {
    const context = await browser.newContext();
    await mockSpotify(context, world);
    await mockSyncServer(context, server);
    await signIn(context, playlistSettings);
    const page = await context.newPage();
    await page.clock.install();
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    return page;
  };

  const pc = await openDevice();
  const phone = await openDevice();
  const idleSetting = (page: typeof pc, minutes: number) =>
    page.getByRole('radiogroup', { name: 'Idle time before autopilot starts' }).getByRole('radio', { name: `${minutes} min` });

  await idleSetting(pc, 20).click();
  await pc.clock.fastForward(2_000); // push is debounced
  await expect.poll(() => (server.doc as { settings?: { idleMinutes?: number } })?.settings?.idleMinutes).toBe(20);

  await phone.clock.fastForward(11_000); // next pull
  await expect(idleSetting(phone, 20)).toHaveAttribute('aria-checked', 'true');

  // Volume is per device and must not travel.
  const phoneVolume = await phone.evaluate(() => JSON.parse(localStorage.getItem('larpify.settings')!).volume);
  expect(phoneVolume).toBe(0.6);

  await pc.context().close();
  await phone.context().close();
});
