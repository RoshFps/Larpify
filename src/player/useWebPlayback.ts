import { useEffect, useRef, useState } from 'react';
import { getAccessToken } from '../auth/session';

const SDK_URL = 'https://sdk.scdn.co/spotify-player.js';
const PLAYER_NAME = 'Larpify (this tab)';

let sdkReady: Promise<void> | null = null;

function loadSdk(): Promise<void> {
  sdkReady ??= new Promise<void>((resolve, reject) => {
    if (window.Spotify) return resolve();
    window.onSpotifyWebPlaybackSDKReady = () => resolve();
    const script = document.createElement('script');
    script.src = SDK_URL;
    script.async = true;
    script.onerror = () => {
      sdkReady = null;
      reject(new Error('Could not load the Spotify player. Check your connection or ad blocker.'));
    };
    document.head.append(script);
  });
  return sdkReady;
}

const ERROR_MESSAGES: Record<Spotify.ErrorType, string> = {
  initialization_error: "This browser can't play Spotify. Try a recent Chrome, Edge, Firefox or Safari.",
  authentication_error: 'Spotify rejected the session. Log out and back in.',
  account_error: 'Playback in the browser needs Spotify Premium.',
  playback_error: 'Spotify could not play that. It will try again on the next idle period.',
};

export type LocalState = Spotify.PlaybackState & { receivedAt: number };

export interface WebPlayback {
  player: Spotify.Player | null;
  deviceId: string | null;
  /** State of the player in this tab; null when another device has playback. */
  state: LocalState | null;
  error: string | null;
  /** Browsers block audio until the page has had a click; call this from one. */
  unlockAudio: () => void;
}

export function useWebPlayback(volume: number): WebPlayback {
  const [player, setPlayer] = useState<Spotify.Player | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [state, setState] = useState<LocalState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const initialVolume = useRef(volume);

  useEffect(() => {
    let cancelled = false;
    let instance: Spotify.Player | null = null;

    loadSdk()
      .then(() => {
        if (cancelled || !window.Spotify) return;
        instance = new window.Spotify.Player({
          name: PLAYER_NAME,
          volume: initialVolume.current,
          getOAuthToken: (callback) => {
            getAccessToken().then(callback, () => setError(ERROR_MESSAGES.authentication_error));
          },
        });
        instance.addListener('ready', ({ device_id }) => {
          setDeviceId(device_id);
          setError(null);
        });
        instance.addListener('not_ready', () => setDeviceId(null));
        instance.addListener('player_state_changed', (next) =>
          setState(next ? { ...next, receivedAt: Date.now() } : null),
        );
        for (const type of Object.keys(ERROR_MESSAGES) as Spotify.ErrorType[]) {
          instance.addListener(type, () => setError(ERROR_MESSAGES[type]));
        }
        instance.addListener('autoplay_failed', () =>
          setError('Your browser blocked autoplay. Click anywhere on the page once to allow it.'),
        );
        instance.connect();
        setPlayer(instance);
      })
      .catch((err: Error) => !cancelled && setError(err.message));

    return () => {
      cancelled = true;
      instance?.disconnect();
    };
  }, []);

  useEffect(() => {
    player?.setVolume(volume).catch(() => undefined);
  }, [player, volume]);

  return {
    player,
    deviceId,
    state,
    error,
    unlockAudio: () => {
      player?.activateElement().catch(() => undefined);
    },
  };
}
