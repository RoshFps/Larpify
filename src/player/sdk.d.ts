// Minimal typings for https://sdk.scdn.co/spotify-player.js, covering what Larpify uses.

declare namespace Spotify {
  interface Image {
    url: string;
  }

  interface Track {
    uri: string;
    id: string | null;
    name: string;
    duration_ms: number;
    album: { name: string; images: Image[] };
    artists: { name: string; uri: string }[];
  }

  interface PlaybackState {
    paused: boolean;
    position: number;
    duration: number;
    shuffle: boolean;
    track_window: { current_track: Track | null };
  }

  interface Error {
    message: string;
  }

  type ErrorType = 'initialization_error' | 'authentication_error' | 'account_error' | 'playback_error';

  interface PlayerInit {
    name: string;
    getOAuthToken: (callback: (token: string) => void) => void;
    volume?: number;
  }

  class Player {
    constructor(options: PlayerInit);
    connect(): Promise<boolean>;
    disconnect(): void;
    activateElement(): Promise<void>;
    togglePlay(): Promise<void>;
    nextTrack(): Promise<void>;
    previousTrack(): Promise<void>;
    seek(positionMs: number): Promise<void>;
    setVolume(volume: number): Promise<void>;
    getCurrentState(): Promise<PlaybackState | null>;
    addListener(event: 'ready' | 'not_ready', cb: (data: { device_id: string }) => void): boolean;
    addListener(event: 'player_state_changed', cb: (state: PlaybackState | null) => void): boolean;
    addListener(event: ErrorType, cb: (error: Error) => void): boolean;
    addListener(event: 'autoplay_failed', cb: () => void): boolean;
  }
}

interface Window {
  onSpotifyWebPlaybackSDKReady?: () => void;
  Spotify?: typeof Spotify;
}
