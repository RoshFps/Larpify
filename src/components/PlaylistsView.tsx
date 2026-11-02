import type { Playlist } from '../api/types';
import { pickImage } from '../lib/format';
import { Cover } from './Cover';
import { CheckIcon } from './Icons';

interface PlaylistsViewProps {
  playlists: Playlist[] | null;
  error: string | null;
  selectedId: string | null;
  onPick: (playlist: Playlist) => void;
}

export function PlaylistsView({ playlists, error, selectedId, onPick }: PlaylistsViewProps) {
  return (
    <div className="view">
      <header className="view-header">
        <p className="eyebrow">Autopilot source</p>
        <h1 className="view-title">Your playlists</h1>
        <p className="view-subtitle">Pick the one autopilot should play. It shuffles from there.</p>
      </header>

      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      {playlists?.length === 0 && <p className="empty">You don't have any playlists yet. Make one in Spotify first.</p>}

      <ul className="card-grid">
        {playlists === null &&
          !error &&
          Array.from({ length: 8 }, (_, i) => <li key={i} className="card skeleton" aria-hidden="true" />)}
        {playlists?.map((playlist) => {
          const selected = playlist.id === selectedId;
          return (
            <li key={playlist.id}>
              <button
                className={`card ${selected ? 'is-selected' : ''}`}
                aria-pressed={selected}
                onClick={() => onPick(playlist)}
              >
                <span className="card__art">
                  <Cover src={pickImage(playlist.images, 300)} size={180} />
                  <span className="card__badge" aria-hidden="true">
                    <CheckIcon size={20} />
                  </span>
                </span>
                <span className="card__title">{playlist.name}</span>
                <span className="card__meta">By {playlist.owner.display_name ?? 'Spotify'}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
