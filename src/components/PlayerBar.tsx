import type { PlaybackState } from '../api/types';
import { formatClock, pickImage } from '../lib/format';
import { useNow } from '../lib/useNow';
import type { LocalState } from '../player/useWebPlayback';
import { Cover } from './Cover';
import { DeviceIcon, NextIcon, PauseIcon, PlayIcon, PrevIcon, VolumeIcon } from './Icons';

interface PlayerBarProps {
  player: Spotify.Player | null;
  local: LocalState | null;
  remote: PlaybackState | null;
  volume: number;
  onVolume: (volume: number) => void;
}

export function PlayerBar({ player, local, remote, volume, onVolume }: PlayerBarProps) {
  const playingHere = local !== null;
  const track = local?.track_window.current_track ?? null;

  const title = track?.name ?? remote?.item?.name ?? null;
  const artists = track
    ? track.artists.map((a) => a.name).join(', ')
    : (remote?.item?.artists.map((a) => a.name).join(', ') ?? '');
  const art = track ? (track.album.images[0]?.url ?? null) : pickImage(remote?.item?.album.images, 64);

  return (
    <footer className="player-bar" aria-label="Now playing">
      <div className="player-bar__track">
        {title ? (
          <>
            <Cover src={art} size={56} />
            <div className="player-bar__text">
              <span className="player-bar__title">{title}</span>
              <span className="player-bar__artists">{artists}</span>
            </div>
          </>
        ) : (
          <span className="player-bar__idle">Nothing playing</span>
        )}
      </div>

      <div className="player-bar__center">
        <div className="player-bar__controls">
          <button
            className="icon-btn"
            aria-label="Previous"
            disabled={!playingHere}
            onClick={() => player?.previousTrack()}
          >
            <PrevIcon size={20} />
          </button>
          <button
            className="play-btn"
            aria-label={local && !local.paused ? 'Pause' : 'Play'}
            disabled={!playingHere}
            onClick={() => player?.togglePlay()}
          >
            {local && !local.paused ? <PauseIcon size={18} /> : <PlayIcon size={18} />}
          </button>
          <button className="icon-btn" aria-label="Next" disabled={!playingHere} onClick={() => player?.nextTrack()}>
            <NextIcon size={20} />
          </button>
        </div>
        {local ? (
          <Progress local={local} player={player} />
        ) : (
          remote?.device && (
            <p className="player-bar__elsewhere">
              <DeviceIcon size={16} />
              {remote.is_playing ? 'Playing on' : 'Paused on'} {remote.device.name}
            </p>
          )
        )}
      </div>

      <div className="player-bar__volume">
        <VolumeIcon size={20} />
        <input
          type="range"
          className="slider"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          aria-label="Volume"
          onChange={(e) => onVolume(Number(e.target.value))}
        />
      </div>
    </footer>
  );
}

function Progress({ local, player }: { local: LocalState; player: Spotify.Player | null }) {
  // Re-render once a second only while something is actually moving.
  const now = useNow(local.paused ? 60_000 : 1_000);
  const position = Math.min(local.duration, local.position + (local.paused ? 0 : now - local.receivedAt));

  return (
    <div className="progress">
      <span className="progress__time">{formatClock(position)}</span>
      <input
        type="range"
        className="slider"
        min={0}
        max={local.duration || 1}
        step={1000}
        value={position}
        aria-label="Seek"
        onChange={(e) => player?.seek(Number(e.target.value))}
      />
      <span className="progress__time">{formatClock(local.duration)}</span>
    </div>
  );
}
