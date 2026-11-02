import type { ReactNode } from 'react';
import type { UserProfile } from '../api/types';
import type { Autopilot } from '../autopilot/useAutopilot';
import { IDLE_MINUTE_OPTIONS } from '../config';
import { formatDuration, greeting } from '../lib/format';
import { useNow } from '../lib/useNow';
import { hasSource, type Settings } from '../settings/useSettings';
import { Cover } from './Cover';
import { DeviceIcon } from './Icons';
import type { View } from './Sidebar';

interface HomeViewProps {
  me: UserProfile | null;
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  autopilot: Autopilot;
  playerReady: boolean;
  playerError: string | null;
  onNavigate: (view: View) => void;
  onUserGesture: () => void;
}

export function HomeView({
  me,
  settings,
  onChange,
  autopilot,
  playerReady,
  playerError,
  onNavigate,
  onUserGesture,
}: HomeViewProps) {
  const now = useNow(15_000);
  const ready = hasSource(settings);
  const status = describeStatus({ settings, ready, autopilot, playerReady, playerError, now });

  return (
    <div className="view view--home">
      <header className="view-header">
        <h1 className="view-title">
          {greeting()}
          {me?.display_name ? `, ${me.display_name}` : ''}
        </h1>
      </header>

      <section className={`autopilot autopilot--${status.tone}`} aria-labelledby="autopilot-title">
        <div className="autopilot__top">
          <div>
            <p className="eyebrow">Autopilot</p>
            <h2 id="autopilot-title" className="autopilot__status">
              <span className="status-dot" aria-hidden="true" />
              {status.title}
            </h2>
            <p className="autopilot__detail" aria-live="polite">
              {status.detail}
            </p>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              role="switch"
              checked={settings.enabled}
              disabled={!ready}
              onChange={(e) => {
                onUserGesture();
                onChange({ enabled: e.target.checked });
              }}
            />
            <span className="switch__track" aria-hidden="true" />
            <span className="sr-only">Autopilot</span>
          </label>
        </div>

        <div className="autopilot__stats">
          <div className="stat">
            <span className="stat__value">{formatDuration(autopilot.todayMs)}</span>
            <span className="stat__label">played by autopilot today</span>
          </div>
          {settings.enabled && ready && autopilot.phase === 'watching' && playerReady && (
            <button
              className="btn btn--outline"
              onClick={() => {
                onUserGesture();
                autopilot.startNow();
              }}
            >
              Start now
            </button>
          )}
        </div>
      </section>

      <section className="settings-card" aria-label="Autopilot settings">
        <div className="setting">
          <div>
            <h3 className="setting__title">Start after</h3>
            <p className="setting__hint">How long your account has to be quiet first.</p>
          </div>
          <div className="pills" role="radiogroup" aria-label="Idle time before autopilot starts">
            {IDLE_MINUTE_OPTIONS.map((minutes) => (
              <button
                key={minutes}
                role="radio"
                aria-checked={settings.idleMinutes === minutes}
                className={`pill ${settings.idleMinutes === minutes ? 'is-active' : ''}`}
                onClick={() => onChange({ idleMinutes: minutes })}
              >
                {minutes} min
              </button>
            ))}
          </div>
        </div>

        <div className="setting">
          <div>
            <h3 className="setting__title">Play from</h3>
            <p className="setting__hint">A playlist, or only songs by artists you pick.</p>
          </div>
          <div className="pills" role="radiogroup" aria-label="Autopilot source">
            {(['playlist', 'artists'] as const).map((source) => (
              <button
                key={source}
                role="radio"
                aria-checked={settings.source === source}
                className={`pill ${settings.source === source ? 'is-active' : ''}`}
                onClick={() => onChange({ source })}
              >
                {source === 'playlist' ? 'Playlist' : 'Artist mode'}
              </button>
            ))}
          </div>
        </div>

        <SourcePreview settings={settings} onNavigate={onNavigate} />
      </section>

      <p className="tip">
        Keep this tab open; closing it stops the player. In Chrome or Edge, add this site to the “Always keep these
        sites active” list under Performance settings so the browser doesn't put it to sleep.
      </p>
    </div>
  );
}

function SourcePreview({ settings, onNavigate }: Pick<HomeViewProps, 'settings' | 'onNavigate'>) {
  if (settings.source === 'playlist') {
    return (
      <button className="source-preview" onClick={() => onNavigate('playlists')}>
        <Cover src={settings.playlist?.imageUrl ?? null} size={56} />
        <span className="source-preview__text">
          <span className="source-preview__name">{settings.playlist?.name ?? 'No playlist picked'}</span>
          <span className="source-preview__meta">{settings.playlist ? 'Playlist' : 'Choose one to get started'}</span>
        </span>
        <span className="source-preview__action">{settings.playlist ? 'Change' : 'Choose'}</span>
      </button>
    );
  }
  return (
    <button className="source-preview" onClick={() => onNavigate('artists')}>
      <span className="avatar-stack">
        {settings.artists.length === 0 && <Cover src={null} size={56} round />}
        {settings.artists.slice(0, 3).map((artist) => (
          <Cover key={artist.id} src={artist.imageUrl} size={56} round />
        ))}
      </span>
      <span className="source-preview__text">
        <span className="source-preview__name">
          {settings.artists.length ? settings.artists.map((a) => a.name).join(', ') : 'No artists picked'}
        </span>
        <span className="source-preview__meta">
          {settings.artists.length ? 'Only their songs will play' : 'Pick up to 5 artists'}
        </span>
      </span>
      <span className="source-preview__action">{settings.artists.length ? 'Edit' : 'Choose'}</span>
    </button>
  );
}

type Tone = 'off' | 'waiting' | 'live' | 'problem';

function describeStatus({
  settings,
  ready,
  autopilot,
  playerReady,
  playerError,
  now,
}: {
  settings: Settings;
  ready: boolean;
  autopilot: Autopilot;
  playerReady: boolean;
  playerError: string | null;
  now: number;
}): { tone: Tone; title: string; detail: ReactNode } {
  if (!ready) {
    return { tone: 'off', title: 'Not set up', detail: 'Pick a playlist or some artists below, then switch it on.' };
  }
  if (!settings.enabled) {
    return { tone: 'off', title: 'Off', detail: 'Switch it on and Larpify takes over when your account goes quiet.' };
  }
  if (playerError) return { tone: 'problem', title: 'Player problem', detail: playerError };
  if (autopilot.error) return { tone: 'problem', title: 'Will retry', detail: autopilot.error };
  if (!playerReady) return { tone: 'waiting', title: 'Connecting', detail: 'Starting the player in this tab…' };

  if (autopilot.phase === 'engaged') {
    return { tone: 'live', title: 'Playing on this tab', detail: 'Start something on another device and it steps aside.' };
  }
  if (autopilot.idleSince === null) {
    const device = autopilot.remote?.device?.name;
    return {
      tone: 'waiting',
      title: 'You’re listening',
      detail: (
        <>
          {device && (
            <span className="device-chip">
              <DeviceIcon size={16} /> {device}
            </span>
          )}{' '}
          Autopilot waits until you stop.
        </>
      ),
    };
  }
  const remainingMs = settings.idleMinutes * 60_000 - (now - autopilot.idleSince);
  const minutes = Math.max(1, Math.ceil(remainingMs / 60_000));
  return {
    tone: 'waiting',
    title: 'Watching',
    detail: `Nothing's playing. Starts in about ${minutes} min unless you play something.`,
  };
}
