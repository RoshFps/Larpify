import { useMemo, useState } from 'react';
import { beginLogin } from '../auth/session';
import type { Artist, Track } from '../api/types';
import { readArtistTotals } from '../autopilot/stats';
import { Cover } from '../components/Cover';
import { formatDuration, pickImage } from '../lib/format';
import type { SourceItem } from '../settings/useSettings';
import { movement, type Prediction } from './predict';
import { RecapChart } from './RecapChart';
import { useRecap, type Recap } from './useRecap';

const TOP = 5;

interface RecapViewProps {
  onTargetArtist: (artist: SourceItem) => void;
}

export function RecapView({ onTargetArtist }: RecapViewProps) {
  const state = useRecap();
  const year = new Date().getFullYear();

  return (
    <div className="view">
      <header className="view-header">
        <p className="eyebrow">Experiment</p>
        <h1 className="view-title">Your {year} recap, predicted</h1>
        <p className="view-subtitle">
          A guess from your top artists and songs over the last 4 weeks, 6 months and year. Spotify doesn't publish
          how its recap works, so treat this as a forecast, not a spoiler.
        </p>
      </header>

      {state.status === 'loading' && <div className="recap-skeleton skeleton" aria-busy="true" />}
      {state.status === 'error' && (
        <p className="inline-error" role="alert">
          {state.message}
        </p>
      )}
      {state.status === 'needs-permission' && (
        <div className="callout">
          <p>
            <strong>One more permission.</strong> Predictions need access to your top artists and songs. Log in again
            to allow it.
          </p>
          <button className="btn btn--primary" onClick={() => void beginLogin()}>
            Allow access
          </button>
        </div>
      )}
      {state.status === 'ready' && <RecapContent recap={state.recap} onTargetArtist={onTargetArtist} />}
    </div>
  );
}

function RecapContent({ recap, onTargetArtist }: { recap: Recap } & RecapViewProps) {
  if (recap.artists.length === 0) {
    return <p className="empty">Not enough listening history yet. Play some music and check back tomorrow.</p>;
  }
  const updated = new Date(recap.updatedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  return (
    <>
      <p className="recap-updated">
        <span className="live-dot" aria-hidden="true" /> Live · updated {updated}
        {recap.previous ? ' · arrows show changes since your last visit' : ''}
      </p>

      <div className="recap-grid">
        <TopList
          title="Top artists"
          predictions={recap.artists.slice(0, TOP)}
          previous={recap.previous?.artists ?? null}
          round
          subtitle={() => 'Artist'}
        />
        <TopList
          title="Top songs"
          predictions={recap.tracks.slice(0, TOP)}
          previous={recap.previous?.tracks ?? null}
          subtitle={(track) => (track as Track).artists.map((a) => a.name).join(', ')}
        />
      </div>

      <RecapChart artists={recap.artists} />
      <TargetArtist artists={recap.artists} onTargetArtist={onTargetArtist} />
      <AutopilotContribution />
    </>
  );
}

function TopList<T extends Artist | Track>({
  title,
  predictions,
  previous,
  round = false,
  subtitle,
}: {
  title: string;
  predictions: Prediction<T>[];
  previous: string[] | null;
  round?: boolean;
  subtitle: (item: T) => string;
}) {
  return (
    <section className="top-list" aria-label={title}>
      <h2 className="section-title">{title}</h2>
      <ol>
        {predictions.map(({ item, rank }) => {
          const images = 'album' in item ? item.album.images : item.images;
          return (
            <li key={item.id} className={`top-item ${rank === 1 ? 'top-item--first' : ''}`}>
              <span className="top-item__rank">{rank}</span>
              <Cover src={pickImage(images, rank === 1 ? 120 : 64)} size={rank === 1 ? 72 : 48} round={round} />
              <span className="top-item__text">
                <span className="top-item__name">{item.name}</span>
                <span className="top-item__meta">{subtitle(item)}</span>
              </span>
              <Movement change={movement(item.id, rank, previous)} />
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function Movement({ change }: { change: number | null }) {
  if (change === null) return <span className="movement movement--new">New</span>;
  if (change === 0) return <span className="movement" aria-label="No change">–</span>;
  const up = change > 0;
  return (
    <span className={`movement ${up ? 'movement--up' : 'movement--down'}`} aria-label={`${up ? 'Up' : 'Down'} ${Math.abs(change)}`}>
      {up ? '▲' : '▼'} {Math.abs(change)}
    </span>
  );
}

function TargetArtist({ artists, onTargetArtist }: { artists: Prediction<Artist>[] } & RecapViewProps) {
  const contenders = artists.slice(TOP, 20);
  const [targetId, setTargetId] = useState<string | null>(contenders[0]?.item.id ?? null);
  const target = artists.find((p) => p.item.id === targetId) ?? null;
  const fifth = artists[TOP - 1];

  if (contenders.length === 0 || !fifth) return null;

  const ahead = target ? artists.slice(TOP - 1, target.rank - 1).map((p) => p.item.name) : [];
  const gapPercent = target ? Math.round(((fifth.score - target.score) / fifth.score) * 100) : 0;

  return (
    <section className="target-card" aria-labelledby="target-title">
      <h2 id="target-title" className="section-title">
        Get an artist into your top {TOP}
      </h2>
      <p className="setting__hint">Pick someone just outside your predicted top {TOP}.</p>
      <div className="pills target-card__pills" role="radiogroup" aria-label="Artist to push">
        {contenders.map(({ item, rank }) => (
          <button
            key={item.id}
            role="radio"
            aria-checked={item.id === targetId}
            className={`pill ${item.id === targetId ? 'is-active' : ''}`}
            onClick={() => setTargetId(item.id)}
          >
            #{rank} {item.name}
          </button>
        ))}
      </div>

      {target && (
        <div className="target-card__plan">
          <p>
            <strong>{target.item.name}</strong> is predicted at <strong>#{target.rank}</strong>, about {gapPercent}%
            behind #{TOP} ({fifth.item.name}). To break in they need to pass {formatList(ahead)}.
          </p>
          <p className="setting__hint">
            Your 4-week list reacts fastest. A few days of artist mode with only them usually shows up there first,
            then in the 6-month list.
          </p>
          <button
            className="btn btn--primary"
            onClick={() =>
              onTargetArtist({
                id: target.item.id,
                uri: target.item.uri,
                name: target.item.name,
                imageUrl: pickImage(target.item.images, 160),
              })
            }
          >
            Play only {target.item.name} on autopilot
          </button>
        </div>
      )}
    </section>
  );
}

function formatList(names: string[]): string {
  if (names.length <= 1) return names[0] ?? 'nobody';
  if (names.length <= 3) return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
  return `${names.slice(0, 2).join(', ')} and ${names.length - 2} others`;
}

function AutopilotContribution() {
  const totals = useMemo(() => readArtistTotals(), []);
  if (totals.length === 0) return null;
  const total = totals.reduce((sum, t) => sum + t.ms, 0);

  return (
    <section className="contribution" aria-labelledby="contribution-title">
      <h2 id="contribution-title" className="section-title">
        Autopilot this year
      </h2>
      <p className="stat">
        <span className="stat__value">{formatDuration(total)}</span>
        <span className="stat__label">played by Larpify in this browser</span>
      </p>
      <ol className="contribution__list">
        {totals.slice(0, 5).map((t) => (
          <li key={t.id}>
            <span>{t.name}</span>
            <span className="contribution__time">{formatDuration(t.ms)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
