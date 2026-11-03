import { useCallback, useEffect, useState } from 'react';
import { AuthError, completeLoginFromUrl, isSignedIn, onSignOut, signOut } from './auth/session';
import { getMe, getMyPlaylists } from './api/spotify';
import type { Playlist, UserProfile } from './api/types';
import { useAutopilot } from './autopilot/useAutopilot';
import { ArtistsView } from './components/ArtistsView';
import { Cover } from './components/Cover';
import { HomeView } from './components/HomeView';
import { LoginScreen } from './components/LoginScreen';
import { PlayerBar } from './components/PlayerBar';
import { PlaylistsView } from './components/PlaylistsView';
import { MobileNav, Sidebar, type View } from './components/Sidebar';
import { pickImage } from './lib/format';
import { useSelfHeal } from './player/useSelfHeal';
import { useWebPlayback } from './player/useWebPlayback';
import { useWakeLock } from './lib/useWakeLock';
import { RecapView } from './recap/RecapView';
import { useSettings } from './settings/useSettings';
import { useSettingsSync } from './sync/useSettingsSync';

type AuthStatus = 'checking' | 'signed-out' | 'signed-in';

export default function App() {
  const [status, setStatus] = useState<AuthStatus>('checking');
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    completeLoginFromUrl()
      .then(() => setStatus(isSignedIn() ? 'signed-in' : 'signed-out'))
      .catch((err: Error) => {
        setLoginError(err.message);
        setStatus('signed-out');
      });
    return onSignOut(() => setStatus('signed-out'));
  }, []);

  if (status === 'checking') return <div className="boot" aria-busy="true" />;
  if (status === 'signed-out') return <LoginScreen error={loginError} />;
  return <SignedInApp />;
}

function SignedInApp() {
  const [view, setView] = useState<View>('home');
  const [settings, updateSettings, applyRemoteSettings] = useSettings();
  const syncStatus = useSettingsSync(settings, applyRemoteSettings);
  const [me, setMe] = useState<UserProfile | null>(null);
  const [playlists, setPlaylists] = useState<Playlist[] | null>(null);
  const [playlistError, setPlaylistError] = useState<string | null>(null);

  const playback = useWebPlayback(settings.volume);
  const localStateKey = playback.state
    ? `${playback.state.paused}:${playback.state.track_window.current_track?.uri ?? ''}`
    : 'none';
  const autopilot = useAutopilot({ settings, deviceId: playback.deviceId, localStateKey });
  useWakeLock(settings.enabled);
  useSelfHeal(settings.enabled, playback.deviceId !== null);

  useEffect(() => {
    getMe().then(setMe, () => undefined);
    getMyPlaylists().then(setPlaylists, (err: unknown) => {
      if (!(err instanceof AuthError)) setPlaylistError('Could not load your playlists.');
      setPlaylists([]);
    });
  }, []);

  const pickPlaylist = useCallback(
    (playlist: Playlist) =>
      updateSettings({
        source: 'playlist',
        playlist: {
          id: playlist.id,
          uri: playlist.uri,
          name: playlist.name,
          imageUrl: pickImage(playlist.images, 160),
        },
      }),
    [updateSettings],
  );

  const navigate = useCallback((next: View) => {
    setView(next);
    document.querySelector('.main')?.scrollTo({ top: 0 });
  }, []);

  return (
    // Any click counts as the gesture browsers want before they allow audio.
    <div className="app" onPointerDown={playback.unlockAudio}>
      <Sidebar
        view={view}
        onNavigate={navigate}
        playlists={playlists}
        selectedPlaylistId={settings.source === 'playlist' ? (settings.playlist?.id ?? null) : null}
        onPickPlaylist={pickPlaylist}
      />

      <main className="main panel">
        <div className="topbar">
          {me && (
            <div className="account">
              {syncStatus === 'synced' && <span className="sync-chip">Synced across devices</span>}
              {syncStatus === 'offline' && <span className="sync-chip sync-chip--offline">Sync offline</span>}
              <Cover src={pickImage(me.images, 32)} size={32} round alt="" />
              <button className="btn btn--ghost" onClick={signOut}>
                Log out
              </button>
            </div>
          )}
        </div>

        {view === 'home' && (
          <HomeView
            me={me}
            settings={settings}
            onChange={updateSettings}
            autopilot={autopilot}
            playerReady={playback.deviceId !== null}
            playerError={playback.error}
            onNavigate={navigate}
            onUserGesture={playback.unlockAudio}
          />
        )}
        {view === 'playlists' && (
          <PlaylistsView
            playlists={playlists}
            error={playlistError}
            selectedId={settings.source === 'playlist' ? (settings.playlist?.id ?? null) : null}
            onPick={(playlist) => {
              pickPlaylist(playlist);
              navigate('home');
            }}
          />
        )}
        {view === 'artists' && (
          <ArtistsView
            selected={settings.artists}
            onChange={(artists) => updateSettings({ artists, source: 'artists' })}
          />
        )}
        {view === 'recap' && (
          <RecapView
            onTargetArtist={(artist) => {
              updateSettings({ source: 'artists', artists: [artist] });
              navigate('home');
            }}
          />
        )}
      </main>

      <PlayerBar
        player={playback.player}
        local={playback.state}
        remote={autopilot.remote}
        volume={settings.volume}
        onVolume={(volume) => updateSettings({ volume })}
      />
      <MobileNav view={view} onNavigate={navigate} />
    </div>
  );
}
