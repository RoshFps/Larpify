import type { Playlist } from '../api/types';
import { pickImage } from '../lib/format';
import { Cover } from './Cover';
import { ChartIcon, HomeIcon, LibraryIcon, LogoMark, MicIcon } from './Icons';

export type View = 'home' | 'playlists' | 'artists' | 'recap';

interface SidebarProps {
  view: View;
  onNavigate: (view: View) => void;
  playlists: Playlist[] | null;
  selectedPlaylistId: string | null;
  onPickPlaylist: (playlist: Playlist) => void;
}

const NAV: { view: View; label: string; Icon: typeof HomeIcon }[] = [
  { view: 'home', label: 'Home', Icon: HomeIcon },
  { view: 'playlists', label: 'Playlists', Icon: LibraryIcon },
  { view: 'artists', label: 'Artists', Icon: MicIcon },
  { view: 'recap', label: 'Recap', Icon: ChartIcon },
];

export function Sidebar({ view, onNavigate, playlists, selectedPlaylistId, onPickPlaylist }: SidebarProps) {
  return (
    <aside className="sidebar">
      <nav className="panel sidebar__nav" aria-label="Main">
        <div className="brand">
          <LogoMark size={28} />
          <span>Larpify</span>
        </div>
        {NAV.map(({ view: target, label, Icon }) => (
          <button
            key={target}
            className={`nav-link ${view === target ? 'is-active' : ''}`}
            aria-current={view === target ? 'page' : undefined}
            onClick={() => onNavigate(target)}
          >
            <Icon />
            {label}
          </button>
        ))}
      </nav>

      <section className="panel sidebar__library" aria-label="Your Library">
        <h2 className="sidebar__heading">
          <LibraryIcon />
          Your Library
        </h2>
        <ul className="library-list">
          {playlists === null &&
            Array.from({ length: 6 }, (_, i) => <li key={i} className="library-item skeleton" aria-hidden="true" />)}
          {playlists?.map((playlist) => (
            <li key={playlist.id}>
              <button
                className={`library-item ${playlist.id === selectedPlaylistId ? 'is-selected' : ''}`}
                onClick={() => onPickPlaylist(playlist)}
                title={`Use “${playlist.name}” for autopilot`}
              >
                <Cover src={pickImage(playlist.images, 48)} size={48} />
                <span className="library-item__text">
                  <span className="library-item__name">{playlist.name}</span>
                  <span className="library-item__meta">Playlist · {playlist.owner.display_name ?? 'Spotify'}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}

export function MobileNav({ view, onNavigate }: Pick<SidebarProps, 'view' | 'onNavigate'>) {
  return (
    <nav className="mobile-nav" aria-label="Main">
      {NAV.map(({ view: target, label, Icon }) => (
        <button
          key={target}
          className={`mobile-nav__link ${view === target ? 'is-active' : ''}`}
          aria-current={view === target ? 'page' : undefined}
          onClick={() => onNavigate(target)}
        >
          <Icon />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
