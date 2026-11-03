import { useState } from 'react';
import type { Artist } from '../api/types';
import { RANGE_WEIGHTS, type Prediction } from './predict';
import { RANGES } from './useRecap';

const LABELS = { long_term: '12 months', medium_term: '6 months', short_term: '4 weeks' } as const;

/** Position in a window's top 50, recovered from the points it contributed. */
function windowRank(points: number, weight: number): number | null {
  if (points <= 0) return null;
  return Math.round(50 - (points / weight) * 50) + 1;
}

function describe(prediction: Prediction<Artist>): string {
  return RANGES.map((range, i) => {
    const rank = windowRank(prediction.parts[i] ?? 0, RANGE_WEIGHTS[range]);
    return `${LABELS[range]}: ${rank ? `#${rank}` : 'not in top 50'}`;
  }).join(' · ');
}

/**
 * Stacked bars showing where each artist's predicted score comes from: a long
 * history (12 months), the core of the year (6 months) or a recent run (4 weeks).
 */
export function RecapChart({ artists }: { artists: Prediction<Artist>[] }) {
  const [active, setActive] = useState<string | null>(null);
  const top = artists.slice(0, 10);
  const max = top[0]?.score ?? 1;

  return (
    <figure className="recap-chart">
      <figcaption className="recap-chart__head">
        <h3 className="recap-chart__title">Why they rank there</h3>
        <ul className="legend" aria-label="Legend">
          {RANGES.map((range, i) => (
            <li key={range}>
              <span className={`legend__swatch series-${i + 1}`} aria-hidden="true" />
              {LABELS[range]}
            </li>
          ))}
        </ul>
      </figcaption>

      <ol className="recap-chart__rows">
        {top.map((prediction) => {
          const open = active === prediction.item.id;
          return (
            <li key={prediction.item.id}>
              <button
                className={`bar-row ${open ? 'is-active' : ''}`}
                aria-label={`#${prediction.rank} ${prediction.item.name}. ${describe(prediction)}`}
                aria-expanded={open}
                onMouseEnter={() => setActive(prediction.item.id)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(prediction.item.id)}
                onBlur={() => setActive(null)}
                onClick={() => setActive(open ? null : prediction.item.id)}
              >
                <span className="bar-row__label">
                  <span className="bar-row__rank">{prediction.rank}</span>
                  <span className="bar-row__name">{prediction.item.name}</span>
                </span>
                <span className="bar-row__track">
                  {prediction.parts.map((points, i) =>
                    points > 0 ? (
                      <span
                        key={RANGES[i]}
                        className={`bar-row__segment series-${i + 1}`}
                        style={{ flexBasis: `${(points / max) * 100}%` }}
                      />
                    ) : null,
                  )}
                </span>
                {open && (
                  <span className="bar-row__tooltip" role="tooltip">
                    {describe(prediction)}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </figure>
  );
}
