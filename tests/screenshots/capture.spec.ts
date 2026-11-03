import { test, type Page } from '@playwright/test';
import { DEVICE_ID, mockSpotify, playingOn, signIn, track, type World } from '../e2e/mockSpotify';

// Sample data only: the Spotify mock from the e2e tests, so no real account is shown.

const OUT = 'docs/screenshots';
const DESKTOP = { width: 1280, height: 800 };
const PHONE = { width: 390, height: 844 };

const settings = {
  enabled: true,
  idleMinutes: 10,
  source: 'playlist',
  playlist: { id: 'pl0', uri: 'spotify:playlist:pl0', name: 'Late Night Drive', imageUrl: 'https://i.scdn.co/image/0' },
  artists: [],
  volume: 0.6,
  quietHours: { enabled: true, start: 2, end: 8 },
};

async function showTabPlaying(page: Page) {
  await page.evaluate(
    (t) =>
      (window as unknown as { __player: { emit(e: string, d: unknown): void } }).__player.emit('player_state_changed', {
        paused: false,
        position: 104_000,
        duration: t.duration_ms,
        shuffle: true,
        track_window: {
          current_track: { ...t, album: { name: 'Blonde', images: [{ url: 'https://i.scdn.co/image/20' }] }, artists: [{ name: 'Frank Ocean', uri: 'x' }] },
        },
      }),
    track,
  );
}

async function openApp(page: Page, world: World, viewport = DESKTOP) {
  await page.setViewportSize(viewport);
  await mockSpotify(page.context(), world);
  await signIn(page.context(), settings, 7 * 24 * 3_600_000);
  await page.addInitScript(() => {
    localStorage.setItem(
      'larpify.recapSnapshots',
      JSON.stringify([{ day: '2000-01-01', artists: ['ar0', 'ar2', 'ar1', 'ex1', 'ex0', 'ex3'], tracks: ['top0', 'top2', 'top1'] }]),
    );
    localStorage.setItem('larpify.stats', JSON.stringify({ day: `${new Date().getFullYear()}-${new Date().getMonth() + 1}-${new Date().getDate()}`, ms: 2.6 * 3_600_000 }));
  });
  // Afternoon, outside the default quiet hours.
  await page.clock.install({ time: new Date(2026, 10, 3, 16, 20) });
  await page.goto('/');
}

const nav = (page: Page) => page.getByRole('navigation', { name: 'Main' }).locator('visible=true');

test('login', async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await page.goto('/');
  await page.getByRole('button', { name: 'Log in with Spotify' }).waitFor();
  await page.screenshot({ path: `${OUT}/login.png` });
});

test('home playing', async ({ page }) => {
  const world: World = { playback: playingOn(DEVICE_ID, 'Larpify (this tab)'), lastPlayRequest: null };
  await openApp(page, world);
  await page.getByText('You’re listening').waitFor();
  // Show the engaged state as autopilot would after taking over.
  await page.getByRole('button', { name: 'Start now' }).click().catch(() => undefined);
  await page.getByText('Playing on this tab').waitFor().catch(() => undefined);
  await showTabPlaying(page);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/home.png` });
});

test('artist mode', async ({ page }) => {
  await openApp(page, { playback: null, lastPlayRequest: null });
  await nav(page).getByRole('button', { name: 'Artists' }).click();
  await page.getByPlaceholder('What artists do you want?').fill('f');
  await page.clock.fastForward(400);
  await page.getByRole('button', { name: /Frank Ocean/ }).click();
  await page.getByRole('button', { name: /FKA twigs/ }).click();
  await page.mouse.move(0, 0);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/artists.png` });
});

test('recap', async ({ page }) => {
  await openApp(page, { playback: null, lastPlayRequest: null }, { width: 1280, height: 1500 });
  await nav(page).getByRole('button', { name: 'Recap' }).click();
  await page.getByRole('region', { name: 'Top artists' }).waitFor();
  await page.getByRole('button', { name: /^#2 / }).hover();
  await page.screenshot({ path: `${OUT}/recap.png` });
});

test('phone', async ({ page }) => {
  const world: World = { playback: playingOn(DEVICE_ID, 'Larpify (this tab)'), lastPlayRequest: null };
  await openApp(page, world, PHONE);
  await page.getByText('You’re listening').waitFor();
  await page.getByRole('button', { name: 'Start now' }).click().catch(() => undefined);
  await showTabPlaying(page);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/phone-home.png` });
  await nav(page).getByRole('button', { name: 'Recap' }).click();
  await page.getByRole('region', { name: 'Top artists' }).waitFor();
  await page.screenshot({ path: `${OUT}/phone-recap.png` });
});
