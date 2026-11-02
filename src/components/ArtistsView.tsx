import { useEffect, useState } from 'react';
import { searchArtists } from '../api/spotify';
import type { Artist } from '../api/types';
import { MAX_ARTISTS } from '../config';
import { pickImage } from '../lib/format';
import type { SourceItem } from '../settings/useSettings';
import { Cover } from './Cover';
import { CheckIcon, CloseIcon, SearchIcon } from './Icons';

interface ArtistsViewProps {
  selected: SourceItem[];
  onChange: (artists: SourceItem[]) => void;
}

const SEARCH_DEBOUNCE_MS = 300;

export function ArtistsView({ selected, onChange }: ArtistsViewProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Artist[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = query.trim();

  useEffect(() => {
    if (!trimmed) return;
    let stale = false;
    const id = window.setTimeout(() => {
      setSearching(true);
      searchArtists(trimmed)
        .then((artists) => !stale && (setResults(artists), setError(null)))
        .catch(() => !stale && setError('Search failed. Try again in a moment.'))
        .finally(() => !stale && setSearching(false));
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      stale = true;
      window.clearTimeout(id);
    };
  }, [trimmed]);

  const selectedIds = new Set(selected.map((a) => a.id));
  const full = selected.length >= MAX_ARTISTS;

  function toggle(artist: Artist) {
    if (selectedIds.has(artist.id)) {
      onChange(selected.filter((a) => a.id !== artist.id));
    } else if (!full) {
      onChange([
        ...selected,
        { id: artist.id, uri: artist.uri, name: artist.name, imageUrl: pickImage(artist.images, 160) },
      ]);
    }
  }

  return (
    <div className="view">
      <header className="view-header">
        <p className="eyebrow">Artist mode</p>
        <h1 className="view-title">Only these artists</h1>
        <p className="view-subtitle">
          Pick up to {MAX_ARTISTS}. Autopilot mixes their songs together and nothing else.
        </p>
      </header>

      {selected.length > 0 && (
        <ul className="chips" aria-label="Selected artists">
          {selected.map((artist) => (
            <li key={artist.id} className="chip">
              <Cover src={artist.imageUrl} size={28} round />
              {artist.name}
              <button
                className="chip__remove"
                aria-label={`Remove ${artist.name}`}
                onClick={() => onChange(selected.filter((a) => a.id !== artist.id))}
              >
                <CloseIcon size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <label className="search">
        <SearchIcon className="search__icon" />
        <span className="sr-only">Search artists</span>
        <input
          type="search"
          placeholder="What artists do you want?"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
      </label>

      {full && <p className="view-subtitle">That's the maximum. Remove one to add another.</p>}
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}

      <ul className={`card-grid ${searching ? 'is-loading' : ''}`} aria-busy={searching}>
        {trimmed &&
          results.map((artist) => {
            const isSelected = selectedIds.has(artist.id);
            return (
              <li key={artist.id}>
                <button
                  className={`card card--artist ${isSelected ? 'is-selected' : ''}`}
                  aria-pressed={isSelected}
                  disabled={!isSelected && full}
                  onClick={() => toggle(artist)}
                >
                  <span className="card__art">
                    <Cover src={pickImage(artist.images, 160)} size={160} round />
                    <span className="card__badge" aria-hidden="true">
                      <CheckIcon size={20} />
                    </span>
                  </span>
                  <span className="card__title">{artist.name}</span>
                  <span className="card__meta">Artist</span>
                </button>
              </li>
            );
          })}
      </ul>
      {trimmed && !searching && results.length === 0 && !error && (
        <p className="empty">No artists found for “{trimmed}”.</p>
      )}
    </div>
  );
}
