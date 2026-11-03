import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AuthError } from '../auth/session';
import { getPlaybackState, pauseDevice, playOnDevice, searchTracksByArtist, type PlayRequest } from '../api/spotify';
import type { PlaybackState, Track } from '../api/types';
import { POLL_INTERVAL_MS } from '../config';
import { hasSource, type Settings } from '../settings/useSettings';
import { buildArtistMix } from './artistMix';
import { initialState, setEnabled, startFailed, step, type EngineState } from './engine';
import { isQuietTime } from './quietHours';
import { addArtistListening, addListening, readTodayMs } from './stats';

const START_GRACE_MS = 15_000;
const PAGES_PER_ARTIST = 3;
const SEARCH_PAGE_SIZE = 10;
const MIX_CACHE_MS = 6 * 60 * 60_000;

interface Options {
  settings: Settings;
  deviceId: string | null;
  /** Changes whenever the tab's own player changes state; triggers a quick re-check. */
  localStateKey: string;
}

export interface Autopilot {
  phase: EngineState['phase'];
  idleSince: number | null;
  /** Last thing Spotify reported for the whole account. */
  remote: PlaybackState | null;
  todayMs: number;
  error: string | null;
  startNow: () => void;
}

export function useAutopilot({ settings, deviceId, localStateKey }: Options): Autopilot {
  const [engine, setEngine] = useState<EngineState>(initialState);
  const [remote, setRemote] = useState<PlaybackState | null>(null);
  const [todayMs, setTodayMs] = useState(() => readTodayMs());
  const [error, setError] = useState<string | null>(null);

  // The poll loop reads these through refs so it isn't torn down on every render.
  const engineRef = useRef(engine);
  const settingsRef = useRef(settings);
  const deviceRef = useRef(deviceId);
  const lastTickRef = useRef<number | null>(null);
  const mixCacheRef = useRef<{ key: string; uris: string[]; builtAt: number } | null>(null);
  const tickingRef = useRef(false);

  useLayoutEffect(() => {
    settingsRef.current = settings;
    deviceRef.current = deviceId;
  }, [settings, deviceId]);

  const commit = useCallback((next: EngineState) => {
    engineRef.current = next;
    setEngine(next);
  }, []);

  const buildRequest = useCallback(async (): Promise<PlayRequest> => {
    const s = settingsRef.current;
    if (s.source === 'playlist') {
      if (!s.playlist) throw new Error('Pick a playlist for autopilot first.');
      return { context_uri: s.playlist.uri };
    }
    if (s.artists.length === 0) throw new Error('Pick at least one artist for autopilot first.');

    const key = s.artists.map((a) => a.id).join(',');
    const cached = mixCacheRef.current;
    if (cached?.key === key && Date.now() - cached.builtAt < MIX_CACHE_MS) {
      return { uris: cached.uris };
    }

    const tracksByArtist = new Map<string, Track[]>();
    await Promise.all(
      s.artists.map(async (artist) => {
        const pages = await Promise.all(
          Array.from({ length: PAGES_PER_ARTIST }, (_, page) =>
            searchTracksByArtist(artist.name, page * SEARCH_PAGE_SIZE).catch(() => [] as Track[]),
          ),
        );
        tracksByArtist.set(artist.id, pages.flat());
      }),
    );
    const uris = buildArtistMix(tracksByArtist);
    if (uris.length === 0) {
      // Fall back to Spotify's own artist radio-style context.
      const pick = s.artists[Math.floor(Math.random() * s.artists.length)]!;
      return { context_uri: pick.uri };
    }
    mixCacheRef.current = { key, uris, builtAt: Date.now() };
    return { uris };
  }, []);

  const start = useCallback(async () => {
    const device = deviceRef.current;
    try {
      if (!device) throw new Error('The player in this tab is not ready yet.');
      await playOnDevice(device, await buildRequest());
      setError(null);
    } catch (err) {
      commit(startFailed(Date.now()));
      setError(err instanceof Error ? err.message : 'Could not start playback.');
    }
  }, [buildRequest, commit]);

  const tick = useCallback(async () => {
    if (tickingRef.current) return;
    tickingRef.current = true;
    try {
      const playback = await getPlaybackState();
      const now = Date.now();
      setRemote(playback);

      const ours = deviceRef.current;
      const previousTick = lastTickRef.current;
      lastTickRef.current = now;
      if (
        engineRef.current.phase === 'engaged' &&
        playback?.is_playing &&
        ours &&
        playback.device?.id === ours &&
        previousTick !== null
      ) {
        // Cap the gap so a sleeping laptop doesn't count hours it wasn't playing.
        const playedMs = Math.min(now - previousTick, POLL_INTERVAL_MS * 2);
        setTodayMs(addListening(playedMs, now));
        const mainArtist = playback.item?.artists[0];
        if (mainArtist) addArtistListening(mainArtist, playedMs, now);
      }

      const { state, decision } = step(
        engineRef.current,
        {
          now,
          playback: playback ? { isPlaying: playback.is_playing, deviceId: playback.device?.id ?? null } : null,
          ourDeviceId: ours,
          quiet: isQuietTime(new Date(now), settingsRef.current.quietHours),
        },
        { idleMs: settingsRef.current.idleMinutes * 60_000, startGraceMs: START_GRACE_MS },
      );
      commit(state);
      if (decision === 'start') await start();
      if (decision === 'stop' && ours) await pauseDevice(ours);
    } catch (err) {
      // AuthError signs the user out elsewhere; anything else is worth showing.
      if (!(err instanceof AuthError)) setError(err instanceof Error ? err.message : 'Lost contact with Spotify.');
    } finally {
      tickingRef.current = false;
    }
  }, [commit, start]);

  const active = settings.enabled && hasSource(settings);

  useEffect(() => {
    commit(setEnabled(engineRef.current, active, Date.now()));
    if (!active) return;
    lastTickRef.current = null;
    void tick();
    const id = window.setInterval(() => void tick(), POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [active, commit, tick]);

  // The tab's own player changed (paused, skipped, took over): re-check soon
  // instead of waiting for the next poll. Debounced so a burst of events is one call.
  useEffect(() => {
    if (!active) return;
    const id = window.setTimeout(() => void tick(), 2_000);
    return () => window.clearTimeout(id);
  }, [active, localStateKey, tick]);

  // A new artist selection should produce a new mix next time.
  useEffect(() => {
    mixCacheRef.current = null;
  }, [settings.artists]);

  const startNow = useCallback(() => {
    commit({ phase: 'engaged', idleSince: null, engagedAt: Date.now() });
    void start();
  }, [commit, start]);

  return { phase: engine.phase, idleSince: engine.idleSince, remote, todayMs, error, startNow };
}
